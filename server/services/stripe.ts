import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-10-29.clover",
});

// Test defaults for Stripe payouts (can be overridden by environment variables)
// These are test values for development and testing purposes only
const TEST_PAYOUT_DEFAULTS = {
  routingNumber: process.env.STRIPE_TEST_ROUTING_NUMBER || "HDFC0000261",
  accountNumber: process.env.STRIPE_TEST_ACCOUNT_NUMBER || "000123456789",
};

export interface PayoutRequest {
  amount: number;
  currency: string;
  destination: string;
  metadata?: Record<string, any>;
  routingNumber?: string; // Optional, will use test default if not provided
  accountNumber?: string; // Optional, will use test default if not provided
}

export interface PayoutResult {
  payoutId: string;
  status: string;
  amount: number;
  currency: string;
  arrivalDate: number;
}

export async function createPayout(request: PayoutRequest): Promise<PayoutResult> {
  try {
    // Use test defaults if not provided in request
    const routingNumber = request.routingNumber || TEST_PAYOUT_DEFAULTS.routingNumber;
    const accountNumber = request.accountNumber || TEST_PAYOUT_DEFAULTS.accountNumber;
    
    // Add test bank details to metadata for reference (in production, these would be used for actual payouts)
    const enhancedMetadata = {
      ...request.metadata,
      testRoutingNumber: routingNumber,
      testAccountNumber: accountNumber,
      isTestPayout: "true",
    };

    // In test mode, Stripe requires a connected account
    // For MVP, we'll create a transfer simulation instead
    const transfer = await stripe.transfers.create({
      amount: Math.round(request.amount * 100), // Convert to cents
      currency: request.currency.toLowerCase(),
      destination: "acct_test", // Test mode placeholder
      metadata: enhancedMetadata,
    });

    return {
      payoutId: transfer.id,
      status: "pending",
      amount: request.amount,
      currency: request.currency,
      arrivalDate: Date.now() + 86400000, // 24 hours from now
    };
  } catch (error: any) {
    // If transfer fails in test mode, create a payout intent instead
    console.warn("Transfer creation failed, creating payout intent:", error.message);

    const payoutIntent = await stripe.payouts.create({
      amount: Math.round(request.amount * 100),
      currency: request.currency.toLowerCase(),
      metadata: request.metadata,
    });

    return {
      payoutId: payoutIntent.id,
      status: payoutIntent.status,
      amount: request.amount,
      currency: request.currency,
      arrivalDate: payoutIntent.arrival_date || Date.now() + 86400000,
    };
  }
}

export async function getPayoutStatus(payoutId: string): Promise<{
  status: string;
  arrivalDate: number;
}> {
  try {
    const payout = await stripe.payouts.retrieve(payoutId);

    return {
      status: payout.status,
      arrivalDate: payout.arrival_date || Date.now() + 86400000,
    };
  } catch {
    // If payout not found, try as transfer
    const transfer = await stripe.transfers.retrieve(payoutId);

    return {
      status: "paid",
      arrivalDate: Date.now(),
    };
  }
}
