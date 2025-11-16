import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { randomUUID } from "crypto";
import {
  chatRequestSchema,
  vendorSelectRequestSchema,
  callInitiateRequestSchema,
  paymentProcessRequestSchema,
  paymentApprovalRequestSchema,
  paymentApprovalResponseSchema,
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
import * as coinbase from "./services/coinbase";

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

      // MOCK CALL FOR TESTING - Bypass Twilio errors
      const USE_MOCK_CALL = true; // Set to false to use real Twilio calls
      
      if (!USE_MOCK_CALL) {
        try {
          // Initiate Twilio call
          const twilioCall = await twilio.initiateCall({
            to: vendor.phone,
            twimlUrl,
            statusCallback: `${req.protocol}://${req.get("host")}/api/calls/webhook/${sessionId}/${call.id}`,
          });

          await storage.updateCall(sessionId, {
            status: "ringing",
          });

          res.json({ success: true, call, callSid: twilioCall.callSid });
        } catch (twilioError: any) {
          console.warn("Twilio call failed, falling back to mock:", twilioError.message);
          // Fall through to mock implementation
        }
      }
      
      // Mock call implementation for happy flow testing
      console.log("Using mock call implementation for vendor:", vendor.name);
      
      await storage.updateCall(sessionId, {
        status: "ringing",
      });

      // Simulate call progression with shorter delays for better UX
      setTimeout(async () => {
        try {
          await storage.updateCall(sessionId, {
            status: "in-progress",
          });
          
          // Add message about negotiating
          const negotiatingMsg: Message = {
            id: randomUUID(),
            role: "assistant",
            content: `I'm now speaking with ${vendor.name} in Hindi to negotiate the best price for your Banarasi saree...`,
            timestamp: new Date().toISOString(),
          };
          await storage.addMessage(sessionId, negotiatingMsg);

          // Simulate negotiation phase after 3 seconds
          setTimeout(async () => {
            try {
              await storage.updateCall(sessionId, {
                status: "negotiating",
              });
              
              // Simulate completed negotiation after another 3 seconds
              setTimeout(async () => {
                try {
                  // Generate a realistic negotiated price (10-30% discount from initial)
                  const basePrice = 12000;
                  const discount = Math.floor(Math.random() * 20) + 10; // 10-30% discount
                  const negotiatedPrice = Math.floor(basePrice * (1 - discount/100));
                  
                  await storage.updateCall(sessionId, {
                    status: "completed",
                    duration: 45,
                    negotiatedPrice,
                    completedAt: new Date().toISOString(),
                  });

                  // Create transaction awaiting approval
                  const transaction: Transaction = {
                    id: randomUUID(),
                    vendorId: vendor.id,
                    amount: negotiatedPrice,
                    currency: "INR",
                    status: "awaiting-approval",
                    createdAt: new Date().toISOString(),
                    completedAt: undefined,
                  };
                  
                  // Use setTransaction which takes sessionId as a parameter
                  await storage.setTransaction(sessionId, transaction);
                  await storage.updateSession(sessionId, { 
                    transaction,
                    journeyStatus: "processing-payment" 
                  });

                  const successMsg: Message = {
                    id: randomUUID(),
                    role: "assistant",
                    content: `Great news! I've successfully negotiated with ${vendor.name}. They've agreed to a price of ₹${negotiatedPrice.toLocaleString()} for a premium Banarasi saree.\n\nOriginal price: ₹${basePrice.toLocaleString()}\nNegotiated price: ₹${negotiatedPrice.toLocaleString()}\nYou saved: ₹${(basePrice - negotiatedPrice).toLocaleString()} (${discount}% discount)\n\nWould you like to proceed with this purchase?`,
                    timestamp: new Date().toISOString(),
                  };
                  await storage.addMessage(sessionId, successMsg);
                } catch (err) {
                  console.error("Error completing mock call:", err);
                }
              }, 3000);
            } catch (err) {
              console.error("Error updating mock negotiation:", err);
            }
          }, 3000);
        } catch (err) {
          console.error("Error updating mock call:", err);
        }
      }, 2000);

      res.json({ success: true, call, callSid: "mock-call-" + call.id });
    } catch (error: any) {
      console.error("Call initiation error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // TwiML endpoint for conversation stages with attempt tracking
  app.all("/api/calls/twiml/:sessionId/:callId/:stage", async (req, res) => {
    const { sessionId, callId, stage } = req.params;
    
    // Helper function to return error TwiML
    const returnErrorTwiML = (errorMessage?: string) => {
      console.error(`[TwiML Error] ${errorMessage || "Unknown error"} - SessionId: ${sessionId}, CallId: ${callId}, Stage: ${stage}`);
      const errorTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Google.hi-IN-Standard-A" language="hi-IN">
    क्षमा करें, कुछ तकनीकी समस्या हुई है। कृपया कुछ देर बाद फिर से कोशिश करें।
  </Say>
  <Hangup/>
</Response>`;
      res.type("text/xml");
      res.send(errorTwiml);
    };
    
    try {
      console.log(`[TwiML Request] SessionId: ${sessionId}, CallId: ${callId}, Stage: ${stage}`);
      
      const attempt = parseInt(req.query.attempt as string) || 1;
      
      // Get session and call data with error handling
      let session;
      try {
        session = await storage.getSession(sessionId);
      } catch (storageError: any) {
        return returnErrorTwiML(`Failed to get session: ${storageError.message}`);
      }
      
      if (!session || !session.currentCall) {
        return returnErrorTwiML("Session or current call not found");
      }

      // Ensure conversation state is properly initialized
      const conversationState = session.currentCall.conversationState || {
        stage: "greeting",
        attempts: 0,
        quantity: 5,
        initialPrice: 8000
      };

      const baseUrl = `${req.protocol}://${req.get("host")}`;
      
      let twiml;
      try {
        twiml = twilio.generateConversationalTwiML(
          callId,
          sessionId,
          stage,
          baseUrl,
          conversationState,
          attempt
        );
      } catch (twimlError: any) {
        console.error(`[TwiML Generation Error] ${twimlError.message}`);
        return returnErrorTwiML(`Failed to generate TwiML: ${twimlError.message}`);
      }

      res.type("text/xml");
      res.send(twiml);
    } catch (error: any) {
      console.error(`[TwiML Critical Error] Unexpected error: ${error.message}`);
      console.error(`[TwiML Stack Trace]`, error.stack);
      
      // Always return valid TwiML, never 500 with text
      const fallbackTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Google.hi-IN-Standard-A" language="hi-IN">
    क्षमा करें, कुछ तकनीकी समस्या हुई है। कृपया कुछ देर बाद फिर से कोशिश करें।
  </Say>
  <Hangup/>
</Response>`;
      
      res.type("text/xml");
      res.send(fallbackTwiml);
    }
  });

  // Gather endpoint for handling user responses with attempt tracking
  app.post("/api/calls/gather/:sessionId/:callId/:stage", async (req, res) => {
    const { sessionId, callId, stage } = req.params;
    
    // Helper function to return error TwiML
    const returnErrorTwiML = (errorMessage?: string) => {
      console.error(`[Gather Error] ${errorMessage || "Unknown error"} - SessionId: ${sessionId}, CallId: ${callId}, Stage: ${stage}`);
      const baseUrl = `${req.protocol}://${req.get("host")}`;
      const errorTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Google.hi-IN-Standard-A" language="hi-IN">
    क्षमा करें, कुछ तकनीकी समस्या हुई है। फिर से कोशिश कर रहे हैं।
  </Say>
  <Redirect method="GET">${baseUrl}/api/calls/twiml/${sessionId}/${callId}/greeting</Redirect>
</Response>`;
      res.type("text/xml");
      res.send(errorTwiml);
    };

    try {
      // Log incoming request details
      console.log(`[Gather Request] SessionId: ${sessionId}, CallId: ${callId}, Stage: ${stage}`);
      console.log(`[Gather Input] SpeechResult: "${req.body.SpeechResult}", Digits: "${req.body.Digits}"`);
      
      const speechResult = req.body.SpeechResult?.toLowerCase() || "";
      const digits = req.body.Digits || "";
      const attempt = parseInt(req.query.attempt as string) || 1;
      
      // Validate stage parameter
      const validStages = ["greeting", "askRequirements", "negotiatePrice", "counterOffer", "finalAgreement", "noSaree", "ended", "timeout"];
      if (!validStages.includes(stage)) {
        return returnErrorTwiML(`Invalid stage: ${stage}`);
      }
      
      // Get session and call data with error handling
      let session;
      try {
        session = await storage.getSession(sessionId);
      } catch (storageError: any) {
        return returnErrorTwiML(`Failed to get session: ${storageError.message}`);
      }
      
      if (!session || !session.currentCall) {
        return returnErrorTwiML("Session or current call not found");
      }

      let nextStage = stage;
      
      // Ensure conversation state is fully initialized with all required fields
      const conversationState = {
        stage: session.currentCall.conversationState?.stage || "greeting",
        attempts: session.currentCall.conversationState?.attempts || 0,
        quantity: session.currentCall.conversationState?.quantity || 5,
        initialPrice: session.currentCall.conversationState?.initialPrice || 8000,
        vendorPrice: session.currentCall.conversationState?.vendorPrice,
        finalPrice: session.currentCall.conversationState?.finalPrice
      };

      // Track attempts using the single attempts field
      const maxAttempts = 3;
      
      // Check if we got no input (timeout scenario)
      const hasInput = speechResult || digits;
      
      if (!hasInput && conversationState.attempts >= maxAttempts) {
        // No response after max attempts - timeout scenario
        console.log(`Timeout after ${maxAttempts} attempts on stage ${stage}`);
        
        // Update call status to timeout
        await storage.updateCall(sessionId, {
          status: "timeout",
          completedAt: new Date().toISOString(),
        });
        
        // Reset journey for retry
        await storage.updateSession(sessionId, {
          journeyStatus: "selecting-vendor",
        });
        
        // Add timeout message
        const msg: Message = {
          id: randomUUID(),
          role: "assistant",
          content: "The vendor was not responsive during the call. Would you like to try another vendor?",
          timestamp: new Date().toISOString(),
        };
        await storage.addMessage(sessionId, msg);
        
        // Return timeout TwiML
        const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Google.hi-IN-Standard-A" language="hi-IN">
    क्षमा करें, मैं आपकी बात सुन नहीं पा रहा हूं। कृपया बाद में कॉल करें। धन्यवाद।
  </Say>
  <Hangup/>
</Response>`;
        
        res.type("text/xml");
        return res.send(twiml);
      }
      
      // Handle different stages with proper attempt tracking
      switch(stage) {
        case "greeting":
          // Check if vendor has sarees (yes = 1, हाँ)
          if (digits === "1" || speechResult.includes("हाँ") || speechResult.includes("yes") || speechResult.includes("haan")) {
            nextStage = "askRequirements";
            conversationState.attempts = 0; // Reset attempts when moving to new stage
          } else if (digits === "2" || speechResult.includes("नहीं") || speechResult.includes("no") || speechResult.includes("nahi")) {
            nextStage = "noSaree";
            conversationState.attempts = 0; // Reset attempts when moving to new stage
          } else {
            // Invalid or no response - retry same stage
            conversationState.attempts = (conversationState.attempts || 0) + 1;
            if (conversationState.attempts >= maxAttempts) {
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
            nextStage = "negotiatePrice";
            conversationState.attempts = 0; // Reset attempts when moving to new stage
          } else if (!hasInput) {
            // No response - retry
            conversationState.attempts = (conversationState.attempts || 0) + 1;
            if (conversationState.attempts >= maxAttempts) {
              // Timeout after max attempts
              nextStage = "timeout";
            }
          } else {
            // Got some response but couldn't parse - move forward with defaults
            nextStage = "negotiatePrice";
            conversationState.attempts = 0; // Reset attempts when moving to new stage
          }
          break;
          
        case "negotiatePrice":
          // Check vendor's response on initial price
          if (speechResult.includes("हाँ") || speechResult.includes("yes") || digits === "1") {
            conversationState.finalPrice = conversationState.initialPrice;
            nextStage = "finalAgreement";
            conversationState.attempts = 0; // Reset attempts when moving to new stage
          } else if (!hasInput) {
            // No response - retry
            conversationState.attempts = (conversationState.attempts || 0) + 1;
            if (conversationState.attempts >= maxAttempts) {
              nextStage = "timeout";
            }
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
            conversationState.attempts = 0; // Reset attempts when moving to new stage
          }
          break;
          
        case "counterOffer":
          // Check if vendor agrees to counter offer
          if (speechResult.includes("हाँ") || speechResult.includes("yes") || 
              speechResult.includes("ठीक") || speechResult.includes("चलेगा") || digits === "1") {
            nextStage = "finalAgreement";
            conversationState.attempts = 0; // Reset attempts when moving to new stage
          } else if (!hasInput) {
            // No response - retry
            conversationState.attempts = (conversationState.attempts || 0) + 1;
            if (conversationState.attempts >= maxAttempts) {
              nextStage = "timeout";
            }
          } else {
            // Try one more counter
            conversationState.finalPrice = (conversationState.finalPrice || 9000) + 500;
            nextStage = "finalAgreement";
            conversationState.attempts = 0; // Reset attempts when moving to new stage
          }
          break;
          
        default:
          nextStage = "ended";
      }
      
      // Handle timeout stage
      if (nextStage === "timeout") {
        // Update call status to timeout
        await storage.updateCall(sessionId, {
          status: "timeout",
          completedAt: new Date().toISOString(),
        });
        
        // Reset journey for retry
        await storage.updateSession(sessionId, {
          journeyStatus: "selecting-vendor",
        });
        
        // Add timeout message
        const msg: Message = {
          id: randomUUID(),
          role: "assistant",
          content: "The vendor was not responsive. Would you like to try another vendor?",
          timestamp: new Date().toISOString(),
        };
        await storage.addMessage(sessionId, msg);
        
        // Return timeout TwiML
        const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Google.hi-IN-Standard-A" language="hi-IN">
    क्षमा करें, मैं आपकी बात सुन नहीं पा रहा हूं। कृपया बाद में कॉल करें। धन्यवाद।
  </Say>
  <Hangup/>
</Response>`;
        
        res.type("text/xml");
        return res.send(twiml);
      }

      // Update conversation state with error handling
      conversationState.stage = nextStage as any;
      
      console.log(`[Gather] Updating conversation state - Next stage: ${nextStage}, Final price: ${conversationState.finalPrice}`);
      
      try {
        await storage.updateCall(sessionId, {
          conversationState: conversationState,
          negotiatedPrice: conversationState.finalPrice
        });
      } catch (updateError: any) {
        console.error(`[Gather Error] Failed to update call state: ${updateError.message}`);
        return returnErrorTwiML(`Failed to update call state: ${updateError.message}`);
      }

      // Generate response TwiML with error handling
      let twiml;
      try {
        const baseUrl = `${req.protocol}://${req.get("host")}`;
        console.log(`[Gather] Generating TwiML for next stage: ${nextStage}`);
        
        twiml = twilio.generateConversationalTwiML(
          callId,
          sessionId,
          nextStage,
          baseUrl,
          conversationState
        );
        
        console.log(`[Gather Success] TwiML generated successfully for stage: ${nextStage}`);
      } catch (twimlError: any) {
        console.error(`[Gather Error] Failed to generate TwiML: ${twimlError.message}`);
        return returnErrorTwiML(`Failed to generate TwiML: ${twimlError.message}`);
      }

      res.type("text/xml");
      res.send(twiml);
    } catch (error: any) {
      // This should never be reached now, but keep as ultimate fallback
      console.error(`[Gather Critical Error] Unexpected error: ${error.message}`);
      console.error(`[Gather Stack Trace]`, error.stack);
      
      // Always return valid TwiML, never 500 with text
      const baseUrl = `${req.protocol}://${req.get("host")}`;
      const fallbackTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Google.hi-IN-Standard-A" language="hi-IN">
    क्षमा करें, कुछ तकनीकी समस्या हुई है। फिर से कोशिश कर रहे हैं।
  </Say>
  <Redirect method="GET">${baseUrl}/api/calls/twiml/${sessionId}/${callId}/greeting</Redirect>
</Response>`;
      
      res.type("text/xml");
      res.send(fallbackTwiml);
    }
  });

  // GET handler for gather endpoint - redirects to TwiML endpoint when Twilio makes GET requests
  app.get("/api/calls/gather/:sessionId/:callId/:stage", async (req, res) => {
    const { sessionId, callId, stage } = req.params;
    const attempt = req.query.attempt || "1";
    
    console.log(`[Gather GET] Redirect request received - SessionId: ${sessionId}, CallId: ${callId}, Stage: ${stage}, Attempt: ${attempt}`);
    
    // Redirect to the TwiML endpoint which handles GET properly
    const redirectUrl = `${req.protocol}://${req.get("host")}/api/calls/twiml/${sessionId}/${callId}/${stage}?attempt=${attempt}`;
    
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Redirect method="GET">${redirectUrl}</Redirect>
</Response>`;
    
    console.log(`[Gather GET] Redirecting to: ${redirectUrl}`);
    res.type("text/xml");
    res.send(twiml);
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

  // Twilio webhook - Now includes sessionId for better tracking
  app.post("/api/calls/webhook/:sessionId/:callId", async (req, res) => {
    try {
      const { sessionId, callId } = req.params;
      const callStatus = req.body.CallStatus;
      const duration = req.body.CallDuration ? parseInt(req.body.CallDuration) : 0;
      const answeredBy = req.body.AnsweredBy; // Can be "human", "machine", or null for no answer

      // Get the session
      const session = await storage.getSession(sessionId);
      if (!session || !session.currentCall) {
        console.warn(`Session or call not found for webhook: ${sessionId}/${callId}`);
        return res.sendStatus(200); // Twilio expects 200 even if we can't process
      }

      // Map Twilio statuses to our statuses
      let mappedStatus: any = "failed";
      let userMessage: string | null = null;
      let shouldResetJourney = false;

      // Handle different call scenarios
      if (callStatus === "no-answer" || callStatus === "busy") {
        mappedStatus = "no-answer";
        userMessage = "The vendor didn't answer the call. Would you like to try another vendor?";
        shouldResetJourney = true;
      } else if (callStatus === "failed") {
        mappedStatus = "failed";
        userMessage = "The call could not be connected. Would you like to try another vendor?";
        shouldResetJourney = true;
      } else if (callStatus === "canceled") {
        mappedStatus = "hung-up";
        userMessage = "The call was canceled. Would you like to try another vendor?";
        shouldResetJourney = true;
      } else if (callStatus === "completed") {
        // Check duration to determine if it was a hangup or successful completion
        if (duration < 10) {
          // Less than 10 seconds - treat as hangup
          mappedStatus = "hung-up";
          userMessage = "The vendor hung up the call. Would you like to try another vendor?";
          shouldResetJourney = true;
        } else if (!session.currentCall.negotiatedPrice && duration < 60) {
          // No negotiated price and less than 60 seconds - incomplete call
          mappedStatus = "hung-up";
          userMessage = "The call ended before negotiation could complete. Would you like to try another vendor?";
          shouldResetJourney = true;
        } else if (session.currentCall.negotiatedPrice) {
          // Successful negotiation
          mappedStatus = "completed";
          const negotiatedPrice = session.currentCall.negotiatedPrice;
          userMessage = `Great news! I've negotiated a price of ₹${negotiatedPrice.toLocaleString()} for your Banarasi saree. Ready to proceed with payment?`;
          await storage.updateSession(sessionId, {
            journeyStatus: "processing-payment",
          });
        } else {
          // Call completed but no clear outcome
          mappedStatus = "completed";
          userMessage = "The call has ended. Would you like to try another vendor or proceed differently?";
          shouldResetJourney = true;
        }
      } else if (callStatus === "ringing") {
        mappedStatus = "ringing";
      } else if (callStatus === "in-progress" || callStatus === "answered") {
        mappedStatus = "in-progress";
      } else if (callStatus === "initiated" || callStatus === "queued") {
        mappedStatus = "initiating";
      }

      // Update call status
      await storage.updateCall(sessionId, {
        status: mappedStatus,
        duration: duration,
        completedAt: ["completed", "hung-up", "no-answer", "failed", "timeout"].includes(mappedStatus) 
          ? new Date().toISOString() 
          : undefined,
      });

      // Reset journey if needed
      if (shouldResetJourney) {
        await storage.updateSession(sessionId, {
          journeyStatus: "selecting-vendor",
        });
      }

      // Add user message if applicable
      if (userMessage) {
        const msg: Message = {
          id: randomUUID(),
          role: "assistant",
          content: userMessage,
          timestamp: new Date().toISOString(),
        };
        await storage.addMessage(sessionId, msg);
      }

      res.sendStatus(200);
    } catch (error: any) {
      console.error("Webhook error:", error);
      res.sendStatus(200); // Always return 200 to Twilio to avoid retries
    }
  });

  // Request payment approval
  app.post("/api/payments/request-approval", async (req, res) => {
    try {
      const { sessionId, amount, vendorPhone } = paymentApprovalRequestSchema.parse(req.body);

      const session = await storage.getSession(sessionId);
      if (!session || !session.selectedVendor) {
        return res.status(404).json({ error: "Session not found or vendor not selected" });
      }

      // Calculate USDC costs using Coinbase exchange rate
      const costCalculation = coinbase.calculateTotalCost(
        amount, 
        "USDC", 
        "INR"
      );

      // Create transaction with awaiting-approval status
      const transaction: Transaction = {
        id: randomUUID(),
        vendorId: session.selectedVendor.id,
        amount: amount,
        currency: "INR",
        status: "awaiting-approval",
        exchangeRate: costCalculation.exchangeRate,
        offRampingFee: costCalculation.fee,
        totalUSDC: costCalculation.totalUSDC,
        createdAt: new Date().toISOString(),
      };

      await storage.setTransaction(sessionId, transaction);

      // Add message asking for approval
      const msg: Message = {
        id: randomUUID(),
        role: "assistant",
        content: `I've negotiated a price of ₹${amount.toLocaleString()} for your Banarasi saree. This will cost ${costCalculation.totalUSDC.toFixed(2)} USDC (including a $${costCalculation.fee} currency conversion fee). Please approve the payment to proceed.`,
        timestamp: new Date().toISOString(),
      };
      await storage.addMessage(sessionId, msg);

      res.json({ 
        success: true, 
        transaction,
        costBreakdown: {
          amountINR: amount,
          amountUSDC: costCalculation.amountUSDC,
          offRampingFee: costCalculation.fee,
          totalUSDC: costCalculation.totalUSDC,
          exchangeRate: costCalculation.exchangeRate
        }
      });
    } catch (error: any) {
      console.error("Payment approval request error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Approve or reject payment
  app.post("/api/payments/approve", async (req, res) => {
    try {
      const { sessionId, approved } = paymentApprovalResponseSchema.parse(req.body);

      const session = await storage.getSession(sessionId);
      if (!session || !session.transaction) {
        return res.status(404).json({ error: "Session or transaction not found" });
      }

      if (session.transaction.status !== "awaiting-approval") {
        return res.status(400).json({ error: "Transaction is not awaiting approval" });
      }

      if (approved) {
        // Update transaction status to approved
        await storage.updateTransaction(sessionId, {
          status: "approved"
        });

        // Add approval message
        const msg: Message = {
          id: randomUUID(),
          role: "assistant",
          content: "Payment approved! Processing your transaction now...",
          timestamp: new Date().toISOString(),
        };
        await storage.addMessage(sessionId, msg);

        // Trigger payment processing
        try {
          const processResponse = await fetch(`${req.protocol}://${req.get("host")}/api/payments/process`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              sessionId: sessionId,
              amount: session.transaction.amount,
              vendorPhone: session.selectedVendor?.phone
            })
          });

          if (!processResponse.ok) {
            throw new Error("Payment processing failed");
          }

          res.json({ success: true, message: "Payment approved and processing started" });
        } catch (processError: any) {
          console.error("Error triggering payment process:", processError);
          
          // Update transaction status to failed
          await storage.updateTransaction(sessionId, {
            status: "failed"
          });
          
          res.status(500).json({ error: "Payment approved but processing failed" });
        }
      } else {
        // Update transaction status to rejected
        await storage.updateTransaction(sessionId, {
          status: "rejected"
        });

        // Reset journey to vendor selection
        await storage.updateSession(sessionId, {
          journeyStatus: "selecting-vendor"
        });

        // Add rejection message
        const msg: Message = {
          id: randomUUID(),
          role: "assistant",
          content: "Payment cancelled. Would you like to select a different vendor or negotiate again?",
          timestamp: new Date().toISOString(),
        };
        await storage.addMessage(sessionId, msg);

        res.json({ success: true, message: "Payment rejected" });
      }
    } catch (error: any) {
      console.error("Payment approval error:", error);
      res.status(500).json({ error: error.message });
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

      // Check if transaction exists and is approved
      if (!session.transaction) {
        // Create new transaction if it doesn't exist (backward compatibility)
        const transaction: Transaction = {
          id: randomUUID(),
          vendorId: session.selectedVendor.id,
          amount,
          currency: "INR",
          status: "processing",
          createdAt: new Date().toISOString(),
        };
        await storage.setTransaction(sessionId, transaction);
      } else if (session.transaction.status !== "approved") {
        return res.status(400).json({ 
          error: "Payment must be approved before processing",
          currentStatus: session.transaction.status 
        });
      } else {
        // Update status to processing
        await storage.updateTransaction(sessionId, {
          status: "processing"
        });
      }

      // Step 1: Convert USDC to vendor's currency via Coinbase (offramping)
      const coinbaseConversion = await coinbase.offRampUSDC({
        amount: session.transaction?.totalUSDC || amount / 83, // Use stored USDC amount or calculate
        fromCurrency: "USDC",
        toCurrency: "INR",
        destinationAccount: {
          phone: vendorPhone, // Vendor's phone for mobile money transfer
        },
        metadata: {
          sessionId,
          vendorId: session.selectedVendor.id,
        },
      });

      await storage.updateTransaction(sessionId, {
        coinbaseConversionId: coinbaseConversion.conversionId,
      });

      // Add message about Coinbase conversion
      const conversionMsg: Message = {
        id: randomUUID(),
        role: "assistant",
        content: `Converting ${coinbaseConversion.amountUSDC.toFixed(2)} USDC to ₹${coinbaseConversion.amountFiat.toFixed(2)} INR via Coinbase...`,
        timestamp: new Date().toISOString(),
      };
      await storage.addMessage(sessionId, conversionMsg);

      // Step 2: Send USDC from Locus wallet
      const locusPayment = await locus.sendUSDC({
        amount: session.transaction?.totalUSDC || amount / 83, // Use total USDC including fees
        currency: "USDC",
        recipientAddress: "0x1234567890abcdef", // In production, map phone to wallet
        metadata: {
          sessionId,
          vendorId: session.selectedVendor.id,
          vendorPhone,
          coinbaseConversionId: coinbaseConversion.conversionId,
        },
      });

      await storage.updateTransaction(sessionId, {
        locusTransactionHash: locusPayment.transactionHash,
      });

      // Step 3: Create Stripe payout to vendor
      const stripePayout = await stripe.createPayout({
        amount: coinbaseConversion.amountFiat, // Use the converted INR amount
        currency: "INR",
        destination: vendorPhone,
        metadata: {
          sessionId,
          vendorId: session.selectedVendor.id,
          coinbaseConversionId: coinbaseConversion.conversionId,
          locusTransactionHash: locusPayment.transactionHash,
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

      // Add completion message with full payment flow details
      const msg: Message = {
        id: randomUUID(),
        role: "assistant",
        content: `Payment successful! 
✅ Converted ${coinbaseConversion.amountUSDC.toFixed(2)} USDC to ₹${coinbaseConversion.amountFiat.toFixed(2)} INR
✅ Offramping fee: $${coinbaseConversion.fee.toFixed(2)}
✅ Funds sent to vendor via Stripe
✅ Transaction hash: ${locusPayment.transactionHash.substring(0, 10)}...

The vendor will contact you shortly to arrange delivery.`,
        timestamp: new Date().toISOString(),
      };
      await storage.addMessage(sessionId, msg);

      res.json({ 
        success: true, 
        transaction: session.transaction,
        paymentDetails: {
          coinbaseConversionId: coinbaseConversion.conversionId,
          locusTransactionHash: locusPayment.transactionHash,
          stripePayoutId: stripePayout.payoutId,
          amountUSDC: coinbaseConversion.amountUSDC,
          amountINR: coinbaseConversion.amountFiat,
          offRampingFee: coinbaseConversion.fee
        }
      });
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
