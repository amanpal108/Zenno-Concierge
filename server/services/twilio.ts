import twilio from "twilio";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

// Only initialize Twilio client if credentials are properly configured
let client: ReturnType<typeof twilio> | null = null;

if (accountSid && authToken) {
  try {
    // Check if accountSid starts with AC (actual account SID)
    if (accountSid.startsWith("AC")) {
      client = twilio(accountSid, authToken);
    } else {
      console.warn("Twilio Account SID should start with 'AC'. Call functionality may be limited.");
    }
  } catch (error: any) {
    console.error("Failed to initialize Twilio client:", error.message);
  }
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
