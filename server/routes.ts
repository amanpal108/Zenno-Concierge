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

      // Extract user intent
      const intent = await anthropic.extractUserIntent(userMessage);

      // Search for vendors if needed
      let vendors: Vendor[] = [];
      if (intent.wantToSearch) {
        const places = await googlePlaces.searchPlaces(
          "Banarasi saree",
          intent.location
        );

        vendors = places.map((place, index) => ({
          id: place.placeId || `vendor-${index}`,
          name: place.name,
          address: place.address,
          phone: place.phone,
          distance: googlePlaces.calculateDistance(
            25.3176, // Varanasi coordinates as reference
            82.9739,
            place.location.lat,
            place.location.lng
          ),
          rating: place.rating,
          placeId: place.placeId,
        }));

        await storage.setVendors(session.id, vendors);
        await storage.updateSession(session.id, {
          journeyStatus: "selecting-vendor",
        });
      }

      // Get fresh session to include the user message we just added
      const freshSession = await storage.getSession(session.id);
      if (!freshSession) {
        throw new Error("Session not found");
      }

      // Generate AI response with updated conversation history
      const conversationHistory = freshSession.messages.map(m => ({
        role: m.role,
        content: m.content,
      }));

      const aiResponse = await anthropic.generateResponse({
        userMessage,
        conversationHistory,
        currentStatus: freshSession.journeyStatus,
        vendors: vendors.length > 0 ? vendors : freshSession.vendors,
      });

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

      // Generate negotiation script
      const script = await anthropic.generateNegotiationScript(
        vendor.name,
        userBudget,
        "Traditional Banarasi silk saree"
      );

      // Create call record
      const call: Call = {
        id: randomUUID(),
        vendorId: vendor.id,
        status: "initiating",
        startedAt: new Date().toISOString(),
      };

      await storage.setCurrentCall(sessionId, call);

      // Generate TwiML
      const twiml = twilio.generateTwiML(script);

      // Create a temporary endpoint for TwiML
      const twimlUrl = `${req.protocol}://${req.get("host")}/api/calls/twiml/${call.id}`;

      // Store TwiML temporarily (in production, use proper storage)
      (app as any).twimlStore = (app as any).twimlStore || {};
      (app as any).twimlStore[call.id] = twiml;

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

  // TwiML endpoint
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
