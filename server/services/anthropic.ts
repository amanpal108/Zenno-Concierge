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
    console.error("Anthropic API error:", error);
    // Fallback response
    if (context.vendors && context.vendors.length > 0) {
      return `I found ${context.vendors.length} vendors for you. Select one to proceed!`;
    }
    return "I'm here to help! Tell me about the Banarasi saree you're looking for.";
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

    const parsed = JSON.parse(textContent.text);
    return {
      wantToSearch: parsed.wantToSearch,
      location: parsed.location === "not specified" ? undefined : parsed.location,
      preferences: parsed.preferences === "none" ? undefined : parsed.preferences,
    };
  } catch (error) {
    console.error("Intent extraction error:", error);
    return { wantToSearch: wantsSearch };
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
