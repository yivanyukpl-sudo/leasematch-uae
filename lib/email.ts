// Real email send + receive for external-listing outreach, via Mailgun
// (chosen because one account gives both a send API and inbound "Routes" —
// a webhook that fires when mail arrives at an address under your domain —
// so the whole reply loop lives with one provider, and Mailgun's free
// sandbox domain works for testing before you own a verified domain).
//
// Outbound: sendExternalInquiryEmail() sends a real email to the contact
// address on an external listing, with a per-inquiry Reply-To alias so a
// human reply lands back on LeaseMatch instead of the tenant's own inbox.
//
// Inbound: verifyMailgunSignature() checks the HMAC Mailgun signs inbound
// webhook payloads with, so app/api/inbound/email/route.ts can trust that a
// "reply" really came from Mailgun and not an attacker spoofing the
// endpoint. See MAILGUN_API_KEY / MAILGUN_DOMAIN / MAILGUN_INBOUND_DOMAIN in
// .env.local.example for setup.

import crypto from "node:crypto";

export function isEmailConfigured(): boolean {
  return Boolean(process.env.MAILGUN_API_KEY && process.env.MAILGUN_DOMAIN);
}

// The domain replies come back to — usually the same as MAILGUN_DOMAIN, but
// kept separate in case you send from your main domain while routing
// inbound mail through Mailgun's sandbox domain during testing.
function inboundDomain(): string | null {
  return process.env.MAILGUN_INBOUND_DOMAIN || process.env.MAILGUN_DOMAIN || null;
}

export function replyToAddressFor(inquiryId: string): string | null {
  const domain = inboundDomain();
  if (!domain) return null;
  return `inquiry-${inquiryId}@${domain}`;
}

export async function sendExternalInquiryEmail(input: {
  inquiryId: string;
  toEmail: string;
  tenantName: string;
  propertyTitle: string;
  sourceSite: string;
  body: string;
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.MAILGUN_API_KEY;
  const domain = process.env.MAILGUN_DOMAIN;
  if (!apiKey || !domain) {
    return { ok: false, error: "Email isn't connected yet (MAILGUN_API_KEY / MAILGUN_DOMAIN)." };
  }

  const replyTo = replyToAddressFor(input.inquiryId);
  const footer = `\n\n—\nSent via LeaseMatch (leasematchuae.com) on behalf of a prospective tenant, ${input.tenantName}. LeaseMatch is not the listing agent for "${input.propertyTitle}" (found on ${input.sourceSite}) and has not verified this listing. Reply to this email to reach the tenant directly.`;

  const form = new URLSearchParams();
  form.set("from", `LeaseMatch <inquiries@${domain}>`);
  form.set("to", input.toEmail);
  if (replyTo) form.set("h:Reply-To", replyTo);
  form.set("subject", `Inquiry about "${input.propertyTitle}" via LeaseMatch`);
  form.set("text", input.body.trim() + footer);

  try {
    const res = await fetch(`https://api.mailgun.net/v3/${domain}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`api:${apiKey}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, error: `Mailgun error (${res.status}): ${text.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Network error sending email." };
  }
}

// Transactional email (alerts). Without Mailgun, development logs the
// message to the server console; production reports failure.
export async function sendEmail(input: { to: string; subject: string; text: string }): Promise<{ ok: boolean }> {
  const apiKey = process.env.MAILGUN_API_KEY;
  const domain = process.env.MAILGUN_DOMAIN;
  if (!apiKey || !domain) {
    if (process.env.NODE_ENV !== "production") console.info(`[email:dev] to=${input.to} subject=${input.subject}\n${input.text}\n`);
    return { ok: process.env.NODE_ENV !== "production" };
  }
  const form = new URLSearchParams({ from: `LeaseMatch <no-reply@${domain}>`, to: input.to, subject: input.subject, text: input.text });
  try {
    const res = await fetch(`https://api.mailgun.net/v3/${domain}/messages`, {
      method: "POST",
      headers: { Authorization: `Basic ${Buffer.from(`api:${apiKey}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });
    return { ok: res.ok };
  } catch {
    return { ok: false };
  }
}

// Verifies Mailgun's inbound webhook signature: HMAC-SHA256 of
// `${timestamp}${token}` using the Mailgun API key (the "signing key" for
// webhooks is the account's API key), compared to the signature Mailgun
// sends. Rejects anything that doesn't match so a spoofed POST can't inject
// fake "replies" into a tenant's inbox.
export function verifyMailgunSignature(input: {
  timestamp: string;
  token: string;
  signature: string;
}): boolean {
  const apiKey = process.env.MAILGUN_API_KEY;
  if (!apiKey) return false;
  const expected = crypto
    .createHmac("sha256", apiKey)
    .update(input.timestamp + input.token)
    .digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(input.signature));
  } catch {
    return false; // length mismatch etc. — treat as invalid
  }
}

// Extracts the inquiry id from an inbound recipient address like
// "inquiry-<id>@yourdomain" — returns null if it doesn't match that shape.
export function inquiryIdFromRecipient(recipient: string): string | null {
  const match = /^inquiry-([a-zA-Z0-9-]+)@/.exec(recipient.trim());
  return match ? match[1] : null;
}
