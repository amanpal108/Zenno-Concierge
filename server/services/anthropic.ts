import Anthropic from "@anthropic-ai/sdk";

const API_KEY = process.env.ANTHROPIC_API_KEY;
const client = API_KEY ? new Anthropic({ apiKey: API_KEY }) : null;

export interface ConversationContext {
  userMessage: string;
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>;
  currentStatus: string;
  vendors?: Array<{ name: string; address: string; phone: string }>;
}

export async function generateResponse(context: ConversationContext): Promise<string> {
  // Fallback response if API key not configured
  if (!client) {
    if (context.vendors && context.vendors.length > 0) {
      return `I found ${context.vendors.length} Banarasi saree vendors near you! Please select one from the list and I'll negotiate the best price for you.`;
    }
    return "Hello! I'm Zenno, your AI shopping assistant. I help you find and purchase authentic Banarasi sarees. Tell me what you're looking for!";
  }
  
  try {
    const systemPrompt = `You are Zenno, a friendly AI concierge assistant helping users find and purchase authentic Banarasi sarees in India. 

Your role:
- Help users find Banarasi saree vendors near their location
- Understand their preferences (color, style, budget, occasion)
- Guide them through the vendor selection process
- Keep responses conversational, warm, and helpful
- Ask clarifying questions when needed

Current journey status: ${context.currentStatus}

${context.vendors ? `Available vendors: ${context.vendors.map(v => v.name).join(", ")}` : "No vendors found yet."}

Keep responses concise (2-3 sentences max) and natural.`;

    const messages: Anthropic.MessageParam[] = [
      ...context.conversationHistory.map(msg => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      })),
      {
        role: "user",
        content: context.userMessage,
      },
    ];

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      system: systemPrompt,
      messages,
    });

    const textContent = response.content.find(block => block.type === "text");
    return textContent && "text" in textContent ? textContent.text : "";
  } catch (error: any) {
    console.error("Anthropic API error:", error.message);
    // Fallback response for rate limits or other errors
    if (context.vendors && context.vendors.length > 0) {
      return `Great! I found ${context.vendors.length} excellent Banarasi saree vendors in your area. Each vendor is known for their authentic craftsmanship and quality. Please select one from the list to proceed with your purchase.`;
    }
    
    // Check if user is searching
    const lowerMessage = context.userMessage.toLowerCase();
    if (lowerMessage.includes("saree") || lowerMessage.includes("vendor")) {
      return "Perfect! I'm searching for the best Banarasi saree vendors in Varanasi for you. I'll find authentic sellers with quality products.";
    }
    
    return "Welcome! I'm Zenno, your AI shopping assistant. I help you find and purchase authentic Banarasi sarees. Tell me what kind of saree you're looking for!";
  }
}

export async function extractUserIntent(message: string): Promise<{
  wantToSearch: boolean;
  location?: string;
  preferences?: string;
}> {
  // Simple keyword-based fallback
  const lowerMessage = message.toLowerCase();
  const wantsSearch =
    lowerMessage.includes("find") ||
    lowerMessage.includes("search") ||
    lowerMessage.includes("looking for") ||
    lowerMessage.includes("saree") ||
    lowerMessage.includes("vendor") ||
    lowerMessage.includes("shop");

  if (!client) {
    return {
      wantToSearch: wantsSearch,
      location: lowerMessage.includes("varanasi") ? "Varanasi" : undefined,
    };
  }

  try {
    const prompt = `Analyze this user message about Banarasi sarees and extract:
1. Does the user want to search for vendors? (yes/no)
2. What location did they mention? (city name or "not specified")
3. Any preferences? (color, style, budget, occasion - or "none")

User message: "${message}"

Respond in JSON format:
{
  "wantToSearch": boolean,
  "location": "string or null",
  "preferences": "string or null"
}`;

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 200,
      messages: [{ role: "user", content: prompt }],
    });

    const textContent = response.content.find(block => block.type === "text");
    if (!textContent || !("text" in textContent)) {
      return { wantToSearch: wantsSearch };
    }

    // Strip markdown code blocks if present
    let jsonText = textContent.text.trim();
    if (jsonText.startsWith("```json")) {
      jsonText = jsonText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    } else if (jsonText.startsWith("```")) {
      jsonText = jsonText.replace(/```\n?/g, "").trim();
    }

    const parsed = JSON.parse(jsonText);
    return {
      wantToSearch: parsed.wantToSearch,
      location: parsed.location === "not specified" ? undefined : parsed.location,
      preferences: parsed.preferences === "none" ? undefined : parsed.preferences,
    };
  } catch (error: any) {
    console.error("Intent extraction error (using fallback):", error.message);
    // Use keyword-based fallback for intent extraction
    return {
      wantToSearch: wantsSearch,
      location: lowerMessage.includes("varanasi") ? "Varanasi" : "Varanasi", // Default to Varanasi
      preferences: "authentic Banarasi sarees"
    };
  }
}

// Combined function that returns both response and intent in one API call
export async function generateResponseWithIntent(context: ConversationContext): Promise<{
  response: string;
  intent: {
    wantToSearch: boolean;
    location?: string;
    preferences?: string;
  };
}> {
  const userMessageLower = context.userMessage.toLowerCase();
  
  // Keyword-based intent extraction fallback
  const fallbackIntent = {
    wantToSearch: userMessageLower.includes("find") ||
      userMessageLower.includes("search") ||
      userMessageLower.includes("looking for") ||
      userMessageLower.includes("saree") ||
      userMessageLower.includes("vendor") ||
      userMessageLower.includes("shop") ||
      userMessageLower.includes("buy"),
    location: userMessageLower.includes("varanasi") ? "Varanasi" : "Varanasi", // Default to Varanasi
    preferences: "authentic Banarasi sarees"
  };

  // Fallback responses when API is unavailable
  const getFallbackResponse = () => {
    if (context.vendors && context.vendors.length > 0) {
      return `I found ${context.vendors.length} excellent Banarasi saree vendors in your area! Each vendor specializes in authentic craftsmanship and quality. Please select one from the list to proceed.`;
    }
    
    if (fallbackIntent.wantToSearch) {
      return "Perfect! I'm searching for the best Banarasi saree vendors in Varanasi for you. I'll find authentic sellers with quality products.";
    }
    
    return "Hello! I'm Zenno, your AI shopping assistant. I help you find and purchase authentic Banarasi sarees. Tell me what you're looking for!";
  };

  // Return fallback if no API key
  if (!client) {
    return {
      response: getFallbackResponse(),
      intent: fallbackIntent
    };
  }
  
  try {
    const systemPrompt = `You are Zenno, a friendly AI concierge assistant helping users find and purchase authentic Banarasi sarees in India.

Your role:
- Help users find Banarasi saree vendors near their location
- Understand their preferences (color, style, budget, occasion)
- Guide them through the vendor selection process
- Keep responses conversational, warm, and helpful

Current journey status: ${context.currentStatus}
${context.vendors ? `Available vendors: ${context.vendors.map(v => v.name).join(", ")}` : "No vendors found yet."}

IMPORTANT: You must respond in valid JSON format with exactly this structure:
{
  "response": "your conversational response here (2-3 sentences max)",
  "intent": {
    "wantToSearch": boolean (true if user wants to find/search for vendors),
    "location": "city name or null",
    "preferences": "user preferences or null"
  }
}

Analyze the user's message to determine if they want to search for vendors. Set wantToSearch to true if they mention finding, searching, looking for sarees or vendors, or express buying intent.`;

    const messages: Anthropic.MessageParam[] = [
      ...context.conversationHistory.map(msg => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      })),
      {
        role: "user",
        content: context.userMessage,
      },
    ];

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      system: systemPrompt,
      messages,
    });

    const textContent = response.content.find(block => block.type === "text");
    if (!textContent || !("text" in textContent)) {
      console.warn("No text content in API response, using fallback");
      return {
        response: getFallbackResponse(),
        intent: fallbackIntent
      };
    }

    try {
      // Try to parse the JSON response
      let jsonText = textContent.text.trim();
      
      // Remove markdown code blocks if present
      if (jsonText.startsWith("```json")) {
        jsonText = jsonText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      } else if (jsonText.startsWith("```")) {
        jsonText = jsonText.replace(/```\n?/g, "").trim();
      }
      
      const parsed = JSON.parse(jsonText);
      
      // Validate the structure
      if (!parsed.response || typeof parsed.response !== "string") {
        throw new Error("Invalid response structure");
      }
      
      return {
        response: parsed.response,
        intent: {
          wantToSearch: parsed.intent?.wantToSearch || false,
          location: parsed.intent?.location === "null" || !parsed.intent?.location ? undefined : parsed.intent.location,
          preferences: parsed.intent?.preferences === "null" || !parsed.intent?.preferences ? undefined : parsed.intent.preferences
        }
      };
    } catch (parseError) {
      console.warn("Failed to parse JSON response, falling back to text extraction:", parseError);
      
      // If JSON parsing fails, extract the conversational part and use fallback intent
      const responseText = textContent.text.split(/\{/)[0].trim() || getFallbackResponse();
      return {
        response: responseText,
        intent: fallbackIntent
      };
    }
  } catch (error: any) {
    console.error("Anthropic API error:", error.message);
    
    // Return fallback response with intent detection
    return {
      response: getFallbackResponse(),
      intent: fallbackIntent
    };
  }
}

export async function generateNegotiationScript(
  vendorName: string,
  userBudget: number,
  preferences: string
): Promise<string> {
  const fallbackScript = `Namaste, main ${vendorName} ke liye call kar raha hoon. Mujhe ek customer ke liye Banarasi saree chahiye, budget around ₹${userBudget}. Kya aap bata sakte hain kya available hai?`;

  if (!client) {
    return fallbackScript;
  }

  try {
    const prompt = `Generate a brief Hindi negotiation script for calling a Banarasi saree vendor.

Vendor: ${vendorName}
User's budget: ₹${userBudget}
Preferences: ${preferences}

Create a friendly 2-3 sentence Hindi script that:
1. Introduces yourself as calling on behalf of a customer
2. Asks about Banarasi saree availability
3. Mentions the budget range

Keep it natural and conversational.`;

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 300,
      messages: [{ role: "user", content: prompt }],
    });

    const textContent = response.content.find(block => block.type === "text");
    return textContent && "text" in textContent ? textContent.text : fallbackScript;
  } catch (error) {
    console.error("Script generation error:", error);
    return fallbackScript;
  }
}
