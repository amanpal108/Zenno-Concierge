import twilio from "twilio";
import type { ConversationState } from "@shared/schema";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

// Only initialize Twilio client if credentials are properly configured
let client: ReturnType<typeof twilio> | null = null;

if (accountSid && authToken) {
  try {
    // Initialize Twilio client regardless of SID format for testing
    client = twilio(accountSid, authToken);
    
    // Warn if it doesn't look like a production SID
    if (!accountSid.startsWith("AC")) {
      console.warn("Twilio Account SID should start with 'AC' for production. Using test credentials.");
    } else {
      console.log("Twilio client initialized successfully");
    }
  } catch (error: any) {
    console.error("Failed to initialize Twilio client:", error.message);
  }
} else {
  console.warn("Twilio credentials not found. Calls will not work without TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.");
}

export interface CallOptions {
  to: string;
  twimlUrl: string;
  statusCallback?: string;
}

export async function initiateCall(options: CallOptions) {
  if (!client) {
    throw new Error("Twilio client not initialized. Please check your Twilio credentials.");
  }
  
  try {
    const call = await client.calls.create({
      to: options.to,
      from: twilioPhoneNumber!,
      url: options.twimlUrl,
      statusCallback: options.statusCallback,
      statusCallbackMethod: "POST",
      statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
    });

    return {
      callSid: call.sid,
      status: call.status,
    };
  } catch (error: any) {
    throw new Error(`Twilio error: ${error.message}`);
  }
}

export async function getCallStatus(callSid: string) {
  if (!client) {
    throw new Error("Twilio client not initialized. Please check your Twilio credentials.");
  }
  
  try {
    const call = await client.calls(callSid).fetch();
    return {
      status: call.status,
      duration: call.duration,
      startTime: call.startTime,
      endTime: call.endTime,
    };
  } catch (error: any) {
    throw new Error(`Twilio error: ${error.message}`);
  }
}

export function generateTwiML(message: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="woman" language="hi-IN">${message}</Say>
  <Record maxLength="120" transcribe="true" />
</Response>`;
}

// Hindi negotiation scripts for different stages
export const NEGOTIATION_SCRIPTS = {
  greeting: {
    message: "नमस्ते, मैं ज़ेन्नो कॉन्सीयज से बात कर रहा हूं। क्या आपके पास बनारसी साड़ी उपलब्ध है? हाँ के लिए एक दबाएं या हाँ बोलें।",
    fallback: "क्षमा करें, मैं आपकी बात सुन नहीं पाया। कृपया फिर से बोलें।"
  },
  askRequirements: {
    message: "बहुत अच्छा! कृपया बताएं, आपको कितनी साड़ियों की आवश्यकता है और किस रेंज में चाहिए?",
    fallback: "कृपया फिर से बताएं कि आपको कितनी साड़ियों की आवश्यकता है।"
  },
  negotiatePrice: {
    message: "हमें $$QUANTITY$$ साड़ियों की आवश्यकता है। क्या आप $$PRICE$$ रुपये प्रति साड़ी में दे सकते हैं?",
    fallback: "कृपया अपनी कीमत फिर से बताएं।"
  },
  counterOffer: {
    message: "आपकी कीमत $$VENDOR_PRICE$$ रुपये है। क्या आप $$COUNTER_PRICE$$ रुपये में फाइनल कर सकते हैं?",
    fallback: "कृपया हाँ या ना बताएं।"
  },
  finalAgreement: {
    message: "बहुत अच्छा! तो फाइनल डील $$FINAL_PRICE$$ रुपये प्रति साड़ी पर हुई। हमारा प्रतिनिधि जल्द ही आपसे संपर्क करेगा। धन्यवाद!",
    fallback: ""
  },
  noSaree: {
    message: "कोई बात नहीं। धन्यवाद! आपका दिन शुभ हो।",
    fallback: ""
  }
};

export function generateConversationalTwiML(
  callId: string,
  sessionId: string,
  stage: string,
  baseUrl: string,
  conversationData?: Partial<ConversationState>,
  attempt: number = 1
): string {
  const scripts = NEGOTIATION_SCRIPTS;
  let currentScript = scripts.greeting;
  let processedMessage = "";
  const maxAttempts = 3;
  
  switch(stage) {
    case 'greeting':
      currentScript = scripts.greeting;
      processedMessage = currentScript.message;
      break;
      
    case 'askRequirements':
      currentScript = scripts.askRequirements;
      processedMessage = currentScript.message;
      break;
      
    case 'negotiatePrice':
      currentScript = scripts.negotiatePrice;
      processedMessage = currentScript.message
        .replace('$$QUANTITY$$', conversationData?.quantity?.toString() || '5')
        .replace('$$PRICE$$', conversationData?.initialPrice?.toString() || '8000');
      break;
      
    case 'counterOffer':
      currentScript = scripts.counterOffer;
      processedMessage = currentScript.message
        .replace('$$VENDOR_PRICE$$', conversationData?.vendorPrice?.toString() || '10000')
        .replace('$$COUNTER_PRICE$$', conversationData?.finalPrice?.toString() || '9000');
      break;
      
    case 'finalAgreement':
      currentScript = scripts.finalAgreement;
      processedMessage = currentScript.message
        .replace('$$FINAL_PRICE$$', conversationData?.finalPrice?.toString() || '9000');
      break;
      
    case 'noSaree':
      currentScript = scripts.noSaree;
      processedMessage = currentScript.message;
      break;
      
    default:
      processedMessage = scripts.greeting.message;
  }
  
  // Generate TwiML with Gather for conversation
  if (stage === 'finalAgreement' || stage === 'noSaree' || stage === 'ended') {
    // Final stages don't need Gather
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Google.hi-IN-Standard-A" language="hi-IN">${processedMessage}</Say>
  <Hangup/>
</Response>`;
  }
  
  // All other stages need Gather for user input with attempt tracking
  const actionUrl = `${baseUrl}/api/calls/gather/${sessionId}/${callId}/${stage}?attempt=${attempt}`;
  const nextAttempt = attempt + 1;
  
  // If we've reached max attempts, say goodbye and hang up
  if (attempt >= maxAttempts) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech dtmf" timeout="5" speechTimeout="3" language="hi-IN" 
          action="${actionUrl}" method="POST" numDigits="10">
    <Say voice="Google.hi-IN-Standard-A" language="hi-IN">${processedMessage}</Say>
  </Gather>
  <Say voice="Google.hi-IN-Standard-A" language="hi-IN">
    क्षमा करें, मैं आपकी बात सुन नहीं पा रहा हूं। कृपया बाद में कॉल करें। धन्यवाद।
  </Say>
  <Hangup/>
</Response>`;
  }
  
  // Regular attempt with redirect for retry
  const redirectUrl = `${baseUrl}/api/calls/twiml/${sessionId}/${callId}/${stage}?attempt=${nextAttempt}`;
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech dtmf" timeout="5" speechTimeout="3" language="hi-IN" 
          action="${actionUrl}" method="POST" numDigits="10">
    <Say voice="Google.hi-IN-Standard-A" language="hi-IN">${processedMessage}</Say>
  </Gather>
  <Say voice="Google.hi-IN-Standard-A" language="hi-IN">${currentScript.fallback}</Say>
  <Redirect method="GET">${redirectUrl}</Redirect>
</Response>`;
}
