// Real external payment redirect via Stripe Checkout.
//
// Stripe is used here (rather than a UAE-specific gateway like Telr or
// PayTabs) because it can be wired up with a free test-mode account in
// minutes, needs no business verification to start, and its Checkout
// Sessions genuinely redirect the payer to a Stripe-hosted page
// (checkout.stripe.com) to pay — i.e. this is a real external payment
// provider redirect, not a simulation, once real keys are configured.
// AED is a supported settlement currency.
//
// To go live: create a Stripe account, grab the test (or live) secret
// key from the dashboard, and set STRIPE_SECRET_KEY in the environment
// (.env.local for local dev). Until that's set, checkout falls back to
// an explanatory page instead of pretending to charge anyone.

import Stripe from "stripe";

let stripeClient: Stripe | null | undefined;

export function getStripe(): Stripe | null {
  if (stripeClient !== undefined) return stripeClient;
  const key = process.env.STRIPE_SECRET_KEY;
  stripeClient = key ? new Stripe(key) : null;
  return stripeClient;
}

export function isPaymentProviderConfigured(): boolean {
  return getStripe() !== null;
}

export async function createLeaseCheckoutSession(input: {
  leaseId: string;
  propertyTitle: string;
  amountAed: number;
  tenantEmail: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<string | null> {
  const stripe = getStripe();
  if (!stripe) return null;

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: input.tenantEmail,
    line_items: [
      {
        price_data: {
          currency: "aed",
          unit_amount: Math.round(input.amountAed * 100),
          product_data: {
            name: `Lease payment — ${input.propertyTitle}`,
          },
        },
        quantity: 1,
      },
    ],
    metadata: { leaseId: input.leaseId },
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
  });

  return session.url;
}

export async function retrieveCheckoutSession(sessionId: string) {
  const stripe = getStripe();
  if (!stripe) return null;
  return stripe.checkout.sessions.retrieve(sessionId);
}

// Real crypto payment redirect via NOWPayments — same pattern as Stripe
// above: a genuine external, hosted checkout page (NOWPayments' own invoice
// page, where the tenant picks BTC/ETH/USDT/etc. and pays to a real address),
// not a simulation. Chosen over Coinbase Commerce because it doesn't require
// a US-style business verification step to get a working sandbox key.
//
// To go live: sign up at nowpayments.io, grab an API key from the dashboard
// (or a sandbox key from sandbox-account.nowpayments.io for testing without
// real funds), and set NOWPAYMENTS_API_KEY (and NOWPAYMENTS_SANDBOX=true for
// the sandbox host) in the environment. Until a key is set, this returns
// null and the lease page falls back the same way it does without Stripe.
//
// Note: confirm which fiat pricing currencies your NOWPayments account has
// enabled (AED support can vary by account) before relying on this in
// production — swap "aed" for "usd" here if needed.

const NOWPAYMENTS_BASE = process.env.NOWPAYMENTS_SANDBOX === "true"
  ? "https://api-sandbox.nowpayments.io/v1"
  : "https://api.nowpayments.io/v1";

export function isCryptoPaymentConfigured(): boolean {
  return Boolean(process.env.NOWPAYMENTS_API_KEY);
}

export async function createCryptoInvoice(input: {
  leaseId: string;
  propertyTitle: string;
  amountAed: number;
  successUrl: string;
  cancelUrl: string;
}): Promise<string | null> {
  const apiKey = process.env.NOWPAYMENTS_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch(`${NOWPAYMENTS_BASE}/invoice`, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        price_amount: input.amountAed,
        price_currency: "aed",
        order_id: input.leaseId,
        order_description: `Lease payment — ${input.propertyTitle}`,
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        is_fixed_rate: true,
      }),
    });
    if (!res.ok) return null;
    const data: unknown = await res.json();
    const invoiceUrl =
      data && typeof data === "object" && "invoice_url" in data
        ? (data as { invoice_url?: unknown }).invoice_url
        : undefined;
    return typeof invoiceUrl === "string" ? invoiceUrl : null;
  } catch {
    return null;
  }
}
