import { z } from "zod";

// Chat Message Schema
export const messageSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  timestamp: z.string(),
});

export type Message = z.infer<typeof messageSchema>;

// Vendor Schema
export const vendorSchema = z.object({
  id: z.string(),
  name: z.string(),
  address: z.string(),
  phone: z.string(),
  distance: z.number(),
  rating: z.number().optional(),
  placeId: z.string().optional(),
});

export type Vendor = z.infer<typeof vendorSchema>;

// Call Status Schema
export const callStatusSchema = z.enum([
  "initiating",
  "ringing",
  "in-progress",
  "negotiating",
  "completed",
  "no-answer",
  "hung-up",
  "timeout",
  "failed",
]);

export type CallStatus = z.infer<typeof callStatusSchema>;

// Conversation Stage Schema
export const conversationStageSchema = z.enum([
  "greeting",
  "askRequirements",
  "negotiatePrice",
  "counterOffer",
  "finalAgreement",
  "noSaree",
  "ended",
]);

export type ConversationStage = z.infer<typeof conversationStageSchema>;

// Conversation State Schema
export const conversationStateSchema = z.object({
  stage: conversationStageSchema,
  quantity: z.number().optional(),
  initialPrice: z.number().optional(),
  vendorPrice: z.number().optional(),
  finalPrice: z.number().optional(),
  attempts: z.number().default(0),
});

export type ConversationState = z.infer<typeof conversationStateSchema>;

// Call Schema
export const callSchema = z.object({
  id: z.string(),
  vendorId: z.string(),
  status: callStatusSchema,
  duration: z.number().optional(),
  negotiatedPrice: z.number().optional(),
  transcript: z.string().optional(),
  conversationState: conversationStateSchema.optional(),
  startedAt: z.string().optional(),
  completedAt: z.string().optional(),
});

export type Call = z.infer<typeof callSchema>;

// Transaction Status Schema
export const transactionStatusSchema = z.enum([
  "pending",
  "processing",
  "completed",
  "failed",
]);

export type TransactionStatus = z.infer<typeof transactionStatusSchema>;

// Transaction Schema
export const transactionSchema = z.object({
  id: z.string(),
  vendorId: z.string(),
  amount: z.number(),
  currency: z.string(),
  status: transactionStatusSchema,
  locusTransactionHash: z.string().optional(),
  stripePayoutId: z.string().optional(),
  createdAt: z.string(),
  completedAt: z.string().optional(),
});

export type Transaction = z.infer<typeof transactionSchema>;

// Journey Status Schema
export const journeyStatusSchema = z.enum([
  "chatting",
  "searching-vendors",
  "selecting-vendor",
  "calling-vendor",
  "processing-payment",
  "completed",
]);

export type JourneyStatus = z.infer<typeof journeyStatusSchema>;

// Session Schema
export const sessionSchema = z.object({
  id: z.string(),
  messages: z.array(messageSchema),
  selectedVendor: vendorSchema.optional(),
  vendors: z.array(vendorSchema),
  currentCall: callSchema.optional(),
  transaction: transactionSchema.optional(),
  journeyStatus: journeyStatusSchema,
  createdAt: z.string(),
});

export type Session = z.infer<typeof sessionSchema>;

// API Request/Response Schemas

// Chat Request
export const chatRequestSchema = z.object({
  message: z.string(),
  sessionId: z.string().optional(),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;

// Chat Response
export const chatResponseSchema = z.object({
  sessionId: z.string(),
  message: messageSchema,
  vendors: z.array(vendorSchema).optional(),
  journeyStatus: journeyStatusSchema,
});

export type ChatResponse = z.infer<typeof chatResponseSchema>;

// Vendor Search Request
export const vendorSearchRequestSchema = z.object({
  location: z.string(),
  query: z.string().optional(),
});

export type VendorSearchRequest = z.infer<typeof vendorSearchRequestSchema>;

// Vendor Select Request
export const vendorSelectRequestSchema = z.object({
  sessionId: z.string(),
  vendorId: z.string(),
});

export type VendorSelectRequest = z.infer<typeof vendorSelectRequestSchema>;

// Call Initiate Request
export const callInitiateRequestSchema = z.object({
  sessionId: z.string(),
  vendorId: z.string(),
  userBudget: z.number(),
});

export type CallInitiateRequest = z.infer<typeof callInitiateRequestSchema>;

// Payment Process Request
export const paymentProcessRequestSchema = z.object({
  sessionId: z.string(),
  amount: z.number(),
  vendorPhone: z.string(),
});

export type PaymentProcessRequest = z.infer<typeof paymentProcessRequestSchema>;

// TTS Request
export const ttsRequestSchema = z.object({
  text: z.string(),
  voice: z.string().optional(),
});

export type TTSRequest = z.infer<typeof ttsRequestSchema>;
