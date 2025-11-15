import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { randomUUID } from "crypto";
import {
  chatRequestSchema,
  vendorSelectRequestSchema,
  callInitiateRequestSchema,
  paymentProcessRequestSchema,
  ttsRequestSchema,
  type Message,
  type Vendor,
  type Call,
  type Transaction,
} from "@shared/schema";
import * as anthropic from "./services/anthropic";
import * as elevenlabs from "./services/elevenlabs";
import * as twilio from "./services/twilio";
import * as googlePlaces from "./services/google-places";
import * as locus from "./services/locus";
import * as stripe from "./services/stripe";

// Default test phone number for vendors (can be overridden by environment variable)
const DEFAULT_VENDOR_PHONE = process.env.DEFAULT_VENDOR_PHONE || "+16179466711";

// Mock vendors for testing when APIs are unavailable
function getMockVendors(): Vendor[] {
  return [
    {
      id: "mock-vendor-1",
      name: "Kashi Silk Emporium",
      address: "D-12/15, Lalpur, Varanasi, Uttar Pradesh 221001",
      phone: DEFAULT_VENDOR_PHONE, // Test default phone number
      distance: 2.5,
      rating: 4.8,
      placeId: "mock-place-1",
    },
    {
      id: "mock-vendor-2",
      name: "Banaras Saree Palace",
      address: "K-37/42, Thatheri Bazar, Varanasi, Uttar Pradesh 221001",
      phone: DEFAULT_VENDOR_PHONE, // Test default phone number
      distance: 3.1,
      rating: 4.6,
      placeId: "mock-place-2",
    },
    {
      id: "mock-vendor-3",
      name: "Royal Heritage Silks",
      address: "S-8/175, Godowlia, Varanasi, Uttar Pradesh 221001",
      phone: DEFAULT_VENDOR_PHONE, // Test default phone number
      distance: 1.8,
      rating: 4.9,
      placeId: "mock-place-3",
    },
  ];
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Get session
  app.get("/api/session/:sessionId", async (req, res) => {
    try {
      const session = await storage.getSession(req.params.sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      res.json(session);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Chat endpoint
  app.post("/api/chat", async (req, res) => {
    try {
      const { message: userMessage, sessionId } = chatRequestSchema.parse(req.body);

      // Get or create session
      let session = sessionId ? await storage.getSession(sessionId) : null;
      if (!session) {
        session = await storage.createSession();
      }

      // Add user message
      const userMsg: Message = {
        id: randomUUID(),
        role: "user",
        content: userMessage,
        timestamp: new Date().toISOString(),
      };
      await storage.addMessage(session.id, userMsg);

      // Get fresh session to include the user message we just added
      const freshSession = await storage.getSession(session.id);
      if (!freshSession) {
        throw new Error("Session not found");
      }

      // Get conversation history for context
      const conversationHistory = freshSession.messages.map(m => ({
        role: m.role,
        content: m.content,
      }));

      // Generate AI response and extract intent in one API call
      const { response: aiResponse, intent } = await anthropic.generateResponseWithIntent({
        userMessage,
        conversationHistory,
        currentStatus: freshSession.journeyStatus,
        vendors: freshSession.vendors,
      });

      // Search for vendors if needed
      let vendors: Vendor[] = [];
      if (intent.wantToSearch) {
        // Try to search with Google Places API
        try {
          const places = await googlePlaces.searchPlaces(
            "Banarasi saree",
            intent.location || "India"
          );

          vendors = places.map((place, index) => ({
            id: place.placeId || `vendor-${index}`,
            name: place.name,
            address: place.address,
            phone: place.phone || DEFAULT_VENDOR_PHONE, // Use test default if no phone from API
            distance: googlePlaces.calculateDistance(
              25.3176, // Varanasi coordinates as reference
              82.9739,
              place.location.lat,
              place.location.lng
            ),
            rating: place.rating,
            placeId: place.placeId,
          }));
        } catch (placesError) {
          console.error("Google Places API error, using mock vendors:", placesError);
          // Fall back to mock vendors if Google Places fails
          vendors = getMockVendors();
        }

        // Use mock vendors if no results from API
        if (vendors.length === 0) {
          vendors = getMockVendors();
        }

        await storage.setVendors(session.id, vendors);
        await storage.updateSession(session.id, {
          journeyStatus: "selecting-vendor",
        });
      }

      // Add AI message
      const aiMsg: Message = {
        id: randomUUID(),
        role: "assistant",
        content: aiResponse,
        timestamp: new Date().toISOString(),
      };
      await storage.addMessage(session.id, aiMsg);

      res.json({
        sessionId: session.id,
        message: aiMsg,
        vendors: vendors.length > 0 ? vendors : undefined,
        journeyStatus: session.journeyStatus,
      });
    } catch (error: any) {
      console.error("Chat error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Select vendor
  app.post("/api/vendors/select", async (req, res) => {
    try {
      const { sessionId, vendorId } = vendorSelectRequestSchema.parse(req.body);

      const session = await storage.getSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      const vendor = session.vendors.find(v => v.id === vendorId);
      if (!vendor) {
        return res.status(404).json({ error: "Vendor not found" });
      }

      await storage.setSelectedVendor(sessionId, vendor);
      await storage.updateSession(sessionId, {
        journeyStatus: "calling-vendor",
      });

      // Add system message
      const msg: Message = {
        id: randomUUID(),
        role: "assistant",
        content: `Great choice! I'll contact ${vendor.name} to negotiate the best price for you. Please wait while I make the call...`,
        timestamp: new Date().toISOString(),
      };
      await storage.addMessage(sessionId, msg);

      res.json({ success: true, vendor });
    } catch (error: any) {
      console.error("Select vendor error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Initiate call
  app.post("/api/calls/initiate", async (req, res) => {
    try {
      const { sessionId, vendorId, userBudget } = callInitiateRequestSchema.parse(req.body);

      const session = await storage.getSession(sessionId);
      if (!session || !session.selectedVendor) {
        return res.status(404).json({ error: "Vendor not selected" });
      }

      const vendor = session.selectedVendor;

      // Create call record with conversation state
      const call: Call = {
        id: randomUUID(),
        vendorId: vendor.id,
        status: "initiating",
        conversationState: {
          stage: "greeting",
          quantity: 5, // Default quantity
          initialPrice: userBudget,
          attempts: 0,
        },
        startedAt: new Date().toISOString(),
      };

      await storage.setCurrentCall(sessionId, call);

      // Create conversation context in app storage
      (app as any).callSessions = (app as any).callSessions || {};
      (app as any).callSessions[call.id] = sessionId;

      // Generate initial conversational TwiML
      const baseUrl = `${req.protocol}://${req.get("host")}`;
      const twiml = twilio.generateConversationalTwiML(
        call.id,
        sessionId,
        "greeting",
        baseUrl,
        call.conversationState
      );

      // Create a temporary endpoint for TwiML
      const twimlUrl = `${baseUrl}/api/calls/twiml/${sessionId}/${call.id}/greeting`;

      // Store TwiML temporarily (in production, use proper storage)
      (app as any).twimlStore = (app as any).twimlStore || {};
      (app as any).twimlStore[`${sessionId}-${call.id}-greeting`] = twiml;

      try {
        // Initiate Twilio call
        const twilioCall = await twilio.initiateCall({
          to: vendor.phone,
          twimlUrl,
          statusCallback: `${req.protocol}://${req.get("host")}/api/calls/webhook/${call.id}`,
        });

        await storage.updateCall(sessionId, {
          status: "ringing",
        });

        res.json({ success: true, call, callSid: twilioCall.callSid });
      } catch (twilioError: any) {
        // Simulate call for development if Twilio fails
        console.warn("Twilio call failed, simulating call:", twilioError.message);

        await storage.updateCall(sessionId, {
          status: "ringing",
        });

        // Simulate call progression
        setTimeout(async () => {
          try {
            await storage.updateCall(sessionId, {
              status: "in-progress",
            });

            // Simulate completed call after 5 seconds
            setTimeout(async () => {
              try {
                const negotiatedPrice = Math.floor(Math.random() * 5000) + 8000;
                await storage.updateCall(sessionId, {
                  status: "completed",
                  duration: 45,
                  negotiatedPrice,
                  completedAt: new Date().toISOString(),
                });

                await storage.updateSession(sessionId, {
                  journeyStatus: "processing-payment",
                });

                const msg: Message = {
                  id: randomUUID(),
                  role: "assistant",
                  content: `Great news! I've negotiated a price of ₹${negotiatedPrice.toLocaleString()} for your Banarasi saree. Processing payment now...`,
                  timestamp: new Date().toISOString(),
                };
                await storage.addMessage(sessionId, msg);
              } catch (err) {
                console.error("Error completing simulated call:", err);
              }
            }, 5000);
          } catch (err) {
            console.error("Error updating simulated call:", err);
          }
        }, 2000);

        res.json({ success: true, call, callSid: "simulated-call-" + call.id });
      }
    } catch (error: any) {
      console.error("Call initiation error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // TwiML endpoint for conversation stages
  app.all("/api/calls/twiml/:sessionId/:callId/:stage", async (req, res) => {
    try {
      const { sessionId, callId, stage } = req.params;
      
      // Get session and call data
      const session = await storage.getSession(sessionId);
      if (!session || !session.currentCall) {
        return res.status(404).send("Session not found");
      }

      const baseUrl = `${req.protocol}://${req.get("host")}`;
      const twiml = twilio.generateConversationalTwiML(
        callId,
        sessionId,
        stage,
        baseUrl,
        session.currentCall.conversationState
      );

      res.type("text/xml");
      res.send(twiml);
    } catch (error: any) {
      console.error("TwiML generation error:", error);
      res.status(500).send("Error generating TwiML");
    }
  });

  // Gather endpoint for handling user responses
  app.post("/api/calls/gather/:sessionId/:callId/:stage", async (req, res) => {
    try {
      const { sessionId, callId, stage } = req.params;
      const speechResult = req.body.SpeechResult?.toLowerCase() || "";
      const digits = req.body.Digits || "";
      
      // Get session and call data
      const session = await storage.getSession(sessionId);
      if (!session || !session.currentCall) {
        return res.status(404).send("Session not found");
      }

      let nextStage = stage;
      const conversationState = session.currentCall.conversationState || {
        stage: "greeting",
        attempts: 0,
        quantity: 5,
        initialPrice: 8000
      };

      // Handle different stages
      switch(stage) {
        case "greeting":
          // Check if vendor has sarees (yes = 1, हाँ)
          if (digits === "1" || speechResult.includes("हाँ") || speechResult.includes("yes") || speechResult.includes("haan")) {
            nextStage = "askRequirements";
          } else if (digits === "2" || speechResult.includes("नहीं") || speechResult.includes("no") || speechResult.includes("nahi")) {
            nextStage = "noSaree";
          } else {
            // Retry same stage
            conversationState.attempts++;
            if (conversationState.attempts > 2) {
              nextStage = "noSaree";
            }
          }
          break;
          
        case "askRequirements":
          // Extract quantity and price from speech
          const numbers = speechResult.match(/\d+/g);
          if (numbers && numbers.length > 0) {
            conversationState.quantity = parseInt(numbers[0]) || 5;
            if (numbers.length > 1) {
              conversationState.vendorPrice = parseInt(numbers[1]);
            }
          }
          nextStage = "negotiatePrice";
          break;
          
        case "negotiatePrice":
          // Check vendor's response on initial price
          if (speechResult.includes("हाँ") || speechResult.includes("yes") || digits === "1") {
            conversationState.finalPrice = conversationState.initialPrice;
            nextStage = "finalAgreement";
          } else {
            // Extract vendor's counter price
            const priceMatch = speechResult.match(/\d+/);
            if (priceMatch) {
              conversationState.vendorPrice = parseInt(priceMatch[0]);
            } else {
              conversationState.vendorPrice = (conversationState.initialPrice || 8000) + 2000;
            }
            conversationState.finalPrice = Math.round(
              ((conversationState.initialPrice || 8000) + conversationState.vendorPrice) / 2
            );
            nextStage = "counterOffer";
          }
          break;
          
        case "counterOffer":
          // Check if vendor agrees to counter offer
          if (speechResult.includes("हाँ") || speechResult.includes("yes") || 
              speechResult.includes("ठीक") || speechResult.includes("चलेगा") || digits === "1") {
            nextStage = "finalAgreement";
          } else {
            // Try one more counter
            conversationState.finalPrice = (conversationState.finalPrice || 9000) + 500;
            nextStage = "finalAgreement";
          }
          break;
          
        default:
          nextStage = "ended";
      }

      // Update conversation state
      conversationState.stage = nextStage as any;
      await storage.updateCall(sessionId, {
        conversationState: conversationState,
        negotiatedPrice: conversationState.finalPrice
      });

      // Generate response TwiML
      const baseUrl = `${req.protocol}://${req.get("host")}`;
      const twiml = twilio.generateConversationalTwiML(
        callId,
        sessionId,
        nextStage,
        baseUrl,
        conversationState
      );

      res.type("text/xml");
      res.send(twiml);
    } catch (error: any) {
      console.error("Gather handling error:", error);
      res.status(500).send("Error processing response");
    }
  });

  // Legacy TwiML endpoint for backwards compatibility
  app.get("/api/calls/twiml/:callId", (req, res) => {
    const twiml = (app as any).twimlStore?.[req.params.callId];
    if (!twiml) {
      return res.status(404).send("TwiML not found");
    }
    res.type("text/xml");
    res.send(twiml);
  });

  // Twilio webhook
  app.post("/api/calls/webhook/:callId", async (req, res) => {
    try {
      const callStatus = req.body.CallStatus;
      const duration = req.body.CallDuration;

      // Find session with this call
      // In production, use proper session lookup
      const sessions = (storage as any).sessions;
      let targetSessionId: string | null = null;

      for (const [sessionId, session] of sessions) {
        if (session.currentCall?.id === req.params.callId) {
          targetSessionId = sessionId;
          break;
        }
      }

      if (targetSessionId) {
        const statusMap: Record<string, any> = {
          "initiated": "initiating",
          "ringing": "ringing",
          "in-progress": "in-progress",
          "completed": "completed",
          "failed": "failed",
        };

        await storage.updateCall(targetSessionId, {
          status: statusMap[callStatus] || callStatus,
          duration: duration ? parseInt(duration) : undefined,
          completedAt: callStatus === "completed" ? new Date().toISOString() : undefined,
        });

        // If call completed successfully, simulate negotiated price
        if (callStatus === "completed") {
          const negotiatedPrice = Math.floor(Math.random() * 5000) + 8000; // ₹8000-13000
          await storage.updateCall(targetSessionId, {
            negotiatedPrice,
          });

          await storage.updateSession(targetSessionId, {
            journeyStatus: "processing-payment",
          });

          // Add message about successful negotiation
          const msg: Message = {
            id: randomUUID(),
            role: "assistant",
            content: `Great news! I've negotiated a price of ₹${negotiatedPrice.toLocaleString()} for your Banarasi saree. Ready to proceed with payment?`,
            timestamp: new Date().toISOString(),
          };
          await storage.addMessage(targetSessionId, msg);
        }
      }

      res.sendStatus(200);
    } catch (error: any) {
      console.error("Webhook error:", error);
      res.sendStatus(500);
    }
  });

  // Process payment
  app.post("/api/payments/process", async (req, res) => {
    try {
      const { sessionId, amount, vendorPhone } = paymentProcessRequestSchema.parse(req.body);

      const session = await storage.getSession(sessionId);
      if (!session || !session.selectedVendor) {
        return res.status(404).json({ error: "Session not found" });
      }

      // Create transaction record
      const transaction: Transaction = {
        id: randomUUID(),
        vendorId: session.selectedVendor.id,
        amount,
        currency: "USDC",
        status: "processing",
        createdAt: new Date().toISOString(),
      };

      await storage.setTransaction(sessionId, transaction);

      // Process Locus payment
      const locusPayment = await locus.sendUSDC({
        amount,
        currency: "USDC",
        recipientAddress: "0x1234567890abcdef", // In production, map phone to wallet
        metadata: {
          sessionId,
          vendorId: session.selectedVendor.id,
          vendorPhone,
        },
      });

      await storage.updateTransaction(sessionId, {
        locusTransactionHash: locusPayment.transactionHash,
      });

      // Process Stripe payout
      const stripePayout = await stripe.createPayout({
        amount,
        currency: "INR",
        destination: vendorPhone,
        metadata: {
          sessionId,
          vendorId: session.selectedVendor.id,
        },
      });

      await storage.updateTransaction(sessionId, {
        stripePayoutId: stripePayout.payoutId,
        status: "completed",
        completedAt: new Date().toISOString(),
      });

      await storage.updateSession(sessionId, {
        journeyStatus: "completed",
      });

      // Add completion message
      const msg: Message = {
        id: randomUUID(),
        role: "assistant",
        content: `Payment successful! Your transaction has been completed. The vendor will contact you shortly to arrange delivery.`,
        timestamp: new Date().toISOString(),
      };
      await storage.addMessage(sessionId, msg);

      res.json({ success: true, transaction });
    } catch (error: any) {
      console.error("Payment error:", error);

      // Update transaction as failed
      try {
        const session = await storage.getSession(req.body.sessionId);
        if (session?.transaction) {
          await storage.updateTransaction(req.body.sessionId, {
            status: "failed",
          });
        }
      } catch {}

      res.status(500).json({ error: error.message });
    }
  });

  // Generate TTS
  app.post("/api/tts/generate", async (req, res) => {
    try {
      const { text, voice } = ttsRequestSchema.parse(req.body);

      const audioBuffer = await elevenlabs.generateSpeech(text, voice);

      res.setHeader("Content-Type", "audio/mpeg");
      res.send(audioBuffer);
    } catch (error: any) {
      console.error("TTS error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
