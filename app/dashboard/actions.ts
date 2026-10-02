"use server";

import { revalidatePath, unstable_noStore } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getSession } from "@/lib/auth";
import {
  applicationSchema,
  leaseMessageSchema,
  preferencesSchema,
  signatureSchema,
} from "@/lib/schemas";
import {
  addExternalInquiryMessage,
  addLeaseMessage,
  confirmPayment,
  createApplication,
  createLeaseFromApplication,
  getApplicationById,
  getExternalInquiryById,
  getLeaseById,
  getProfileById,
  getPropertyById,
  markExternalInquirySent,
  setApplicationStatus,
  setPropertyStatus,
  signLease,
  submitPayment,
  updateExternalInquiryDraft,
  upsertTenantPreferences,
} from "@/lib/db";
import {
  createCryptoInvoice,
  createLeaseCheckoutSession,
  isCryptoPaymentConfigured,
  isPaymentProviderConfigured,
} from "@/lib/payments";
import { draftNegotiationMessage } from "@/lib/ai";
import { comparablesFor } from "@/lib/comparables";
import { isEmailConfigured, sendExternalInquiryEmail } from "@/lib/email";
import { externalInquiryReplySchema } from "@/lib/schemas";

const PROVIDER_ROLES = new Set(["owner", "broker", "pm"]);

async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export async function publishProperty(formData: FormData) {
  const session = await requireSession();
  const propertyId = String(formData.get("propertyId") || "");
  const property = getPropertyById(propertyId);
  if (!property || property.provider_id !== session.sub) return;
  setPropertyStatus(propertyId, "live");
  revalidatePath("/dashboard");
}

export async function savePreferences(formData: FormData) {
  const session = await requireSession();
  if (session.role !== "tenant") return;

  const parsed = preferencesSchema.safeParse({
    propertyTypes: formData.getAll("propertyTypes").map(String),
    locations: formData.getAll("locations").map(String),
    budget: String(formData.get("budget") || ""),
    furnished: String(formData.get("furnished") || ""),
    notes: String(formData.get("notes") || ""),
  });
  if (!parsed.success) return;

  upsertTenantPreferences({
    profileId: session.sub,
    propertyTypes: parsed.data.propertyTypes,
    locations: parsed.data.locations,
    budget: parsed.data.budget ?? null,
    furnished: parsed.data.furnished || null,
    notes: parsed.data.notes ?? null,
  });
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/preferences");
}

export async function submitApplication(formData: FormData) {
  const session = await requireSession();
  if (session.role !== "tenant") return;

  const propertyId = String(formData.get("propertyId") || "");
  const property = getPropertyById(propertyId);
  if (!property) return;

  const parsed = applicationSchema.safeParse({
    occupation: String(formData.get("occupation") || ""),
    monthlyIncome: String(formData.get("monthlyIncome") || ""),
    moveIn: String(formData.get("moveIn") || ""),
    note: String(formData.get("note") || ""),
  });
  if (!parsed.success) return;

  createApplication({
    propertyId,
    tenantId: session.sub,
    occupation: parsed.data.occupation,
    monthlyIncome: parsed.data.monthlyIncome ?? null,
    moveIn: parsed.data.moveIn || null,
    note: parsed.data.note || null,
  });
  revalidatePath(`/properties/${propertyId}`);
  revalidatePath("/dashboard/applications");
}

export async function approveApplication(formData: FormData) {
  const session = await requireSession();
  if (!PROVIDER_ROLES.has(session.role)) return;

  const applicationId = String(formData.get("applicationId") || "");
  const application = getApplicationById(applicationId);
  if (!application) return;
  const property = getPropertyById(application.property_id);
  if (!property || property.provider_id !== session.sub) return;

  setApplicationStatus(applicationId, "approved");
  const lease = createLeaseFromApplication(applicationId);
  setPropertyStatus(property.id, "under_offer");
  revalidatePath(`/properties/${property.id}/applicants`);
  redirect(`/dashboard/leases/${lease.id}`);
}

export async function rejectApplication(formData: FormData) {
  const session = await requireSession();
  if (!PROVIDER_ROLES.has(session.role)) return;

  const applicationId = String(formData.get("applicationId") || "");
  const application = getApplicationById(applicationId);
  if (!application) return;
  const property = getPropertyById(application.property_id);
  if (!property || property.provider_id !== session.sub) return;

  setApplicationStatus(applicationId, "rejected");
  revalidatePath(`/properties/${property.id}/applicants`);
}

function assertLeaseParty(leaseId: string, profileId: string) {
  const lease = getLeaseById(leaseId);
  if (!lease) return null;
  if (lease.tenant_id !== profileId && lease.provider_id !== profileId) return null;
  return lease;
}

export async function signLeaseAction(formData: FormData) {
  const session = await requireSession();
  const leaseId = String(formData.get("leaseId") || "");
  const lease = assertLeaseParty(leaseId, session.sub);
  if (!lease) return;

  const parsed = signatureSchema.safeParse({
    signatureName: String(formData.get("signatureName") || ""),
  });
  if (!parsed.success) return;

  const profile = getProfileById(session.sub);
  if (!profile) return;
  // The typed name must match the account holder's name on file — this is
  // the in-app equivalent of the identity check UAE Pass would otherwise do.
  if (parsed.data.signatureName.trim().toLowerCase() !== profile.full_name.trim().toLowerCase()) {
    return;
  }

  const role = lease.tenant_id === session.sub ? "tenant" : "provider";
  signLease(leaseId, role, { signatureName: parsed.data.signatureName, method: "in_app" });
  revalidatePath(`/dashboard/leases/${leaseId}`);
}

async function absoluteUrl(path: string) {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}${path}`;
}

// Starts a real external redirect to the payment provider (Stripe Checkout).
// Requires STRIPE_SECRET_KEY to be configured — see lib/payments.ts.
export async function startPaymentAction(formData: FormData) {
  const session = await requireSession();
  const leaseId = String(formData.get("leaseId") || "");
  const lease = assertLeaseParty(leaseId, session.sub);
  if (!lease || lease.tenant_id !== session.sub) return;

  const property = getPropertyById(lease.property_id);
  const tenant = getProfileById(lease.tenant_id);
  if (!property || !tenant) return;

  const url = await createLeaseCheckoutSession({
    leaseId: lease.id,
    propertyTitle: property.title,
    amountAed: property.price,
    tenantEmail: tenant.email,
    successUrl: await absoluteUrl(`/dashboard/leases/${leaseId}?payment_session={CHECKOUT_SESSION_ID}`),
    cancelUrl: await absoluteUrl(`/dashboard/leases/${leaseId}`),
  });

  if (!url) return; // provider not configured — page shows the fallback
  redirect(url);
}

// Real external redirect to a crypto payment provider (NOWPayments hosted
// invoice page). Requires NOWPAYMENTS_API_KEY — see lib/payments.ts.
export async function startCryptoPaymentAction(formData: FormData) {
  const session = await requireSession();
  const leaseId = String(formData.get("leaseId") || "");
  const lease = assertLeaseParty(leaseId, session.sub);
  if (!lease || lease.tenant_id !== session.sub) return;

  const property = getPropertyById(lease.property_id);
  if (!property) return;

  const url = await createCryptoInvoice({
    leaseId: lease.id,
    propertyTitle: property.title,
    amountAed: property.price,
    successUrl: await absoluteUrl(`/dashboard/leases/${leaseId}?crypto_started=1`),
    cancelUrl: await absoluteUrl(`/dashboard/leases/${leaseId}`),
  });

  if (!url) return; // provider not configured — page shows the fallback
  redirect(url);
}

// Crypto payment can't be verified server-side from a redirect the way
// Stripe's checkout session can (no webhook/IPN endpoint wired up here —
// see the note in lib/payments.ts about registering one for production).
// So after the tenant returns from the NOWPayments hosted page, they confirm
// they actually sent it, which — exactly like every other payment method
// here — still requires the provider to separately confirm receipt before
// the lease finalizes. Nothing finalizes on the tenant's word alone.
export async function confirmCryptoSentAction(formData: FormData) {
  const session = await requireSession();
  const leaseId = String(formData.get("leaseId") || "");
  const lease = assertLeaseParty(leaseId, session.sub);
  if (!lease || lease.tenant_id !== session.sub) return;
  submitPayment(leaseId, { provider: "crypto" });
  revalidatePath(`/dashboard/leases/${leaseId}`);
}

// Fallback used only when no payment provider is configured, so the rest of
// the flow (confirmation, finalization, key handover) can still be tested.
export async function simulatePaymentAction(formData: FormData) {
  const session = await requireSession();
  if (isPaymentProviderConfigured() || isCryptoPaymentConfigured()) return;
  const leaseId = String(formData.get("leaseId") || "");
  const lease = assertLeaseParty(leaseId, session.sub);
  if (!lease || lease.tenant_id !== session.sub) return;
  submitPayment(leaseId, { provider: "simulated" });
  revalidatePath(`/dashboard/leases/${leaseId}`);
}

export async function confirmPaymentAction(formData: FormData) {
  const session = await requireSession();
  const leaseId = String(formData.get("leaseId") || "");
  const lease = assertLeaseParty(leaseId, session.sub);
  if (!lease || lease.provider_id !== session.sub) return;
  confirmPayment(leaseId);
  revalidatePath(`/dashboard/leases/${leaseId}`);
}

export async function postMessageAction(formData: FormData) {
  unstable_noStore();
  const session = await requireSession();
  const leaseId = String(formData.get("leaseId") || "");
  const lease = assertLeaseParty(leaseId, session.sub);
  if (!lease) return;

  const parsed = leaseMessageSchema.safeParse({ body: String(formData.get("body") || "") });
  if (!parsed.success) return;

  addLeaseMessage({ leaseId, senderId: session.sub, body: parsed.data.body });
  revalidatePath(`/dashboard/leases/${leaseId}`);
}

// Called directly from a client component (not as a form action) — the
// autonomic "this looks pricey" nudge on the sign step. Returns a drafted
// negotiation message the tenant can review, edit, and send from the chat
// below, rather than sending anything automatically.
export async function draftCounterOfferAction(
  leaseId: string
): Promise<{ draft: string | null }> {
  const session = await requireSession();
  const lease = assertLeaseParty(leaseId, session.sub);
  if (!lease || lease.tenant_id !== session.sub) return { draft: null };

  const property = getPropertyById(lease.property_id);
  const tenant = getProfileById(session.sub);
  if (!property || !tenant) return { draft: null };

  const stats = comparablesFor(property);
  const draft = await draftNegotiationMessage({
    propertyTitle: property.title,
    location: property.location,
    askingPrice: property.price,
    comparableAvg: stats.avgPrice || property.price,
    tenantName: tenant.full_name,
  });
  return { draft };
}

// ---- External inquiries (agent outreach to listings found outside
// LeaseMatch via web search) ----

function assertInquiryOwner(inquiryId: string, tenantId: string) {
  const inquiry = getExternalInquiryById(inquiryId);
  if (!inquiry || inquiry.tenant_id !== tenantId) return null;
  return inquiry;
}

// Sends a drafted inquiry as a real email, via lib/email.ts. Requires
// MAILGUN_API_KEY / MAILGUN_DOMAIN — see .env.local.example. Only the
// tenant who owns the draft can send it, and only while it's still a draft.
export async function sendExternalInquiryAction(formData: FormData) {
  const session = await requireSession();
  if (session.role !== "tenant") return;
  const inquiryId = String(formData.get("inquiryId") || "");
  const inquiry = assertInquiryOwner(inquiryId, session.sub);
  if (!inquiry || inquiry.status !== "draft") return;

  const body = String(formData.get("body") || "").trim();
  if (!body) return;
  updateExternalInquiryDraft(inquiryId, body);

  if (!isEmailConfigured()) {
    // Page shows the "email isn't connected" explanation instead.
    revalidatePath(`/dashboard/inquiries/${inquiryId}`);
    return;
  }

  const tenant = getProfileById(session.sub);
  const result = await sendExternalInquiryEmail({
    inquiryId,
    toEmail: inquiry.contact_email,
    tenantName: tenant?.full_name ?? "a LeaseMatch tenant",
    propertyTitle: inquiry.listing_title,
    sourceSite: inquiry.source_site,
    body,
  });
  if (result.ok) {
    markExternalInquirySent(inquiryId);
  }
  revalidatePath(`/dashboard/inquiries/${inquiryId}`);
  revalidatePath("/dashboard/inquiries");
}

// A tenant following up in an already-sent thread — also a real email.
export async function replyExternalInquiryAction(formData: FormData) {
  const session = await requireSession();
  if (session.role !== "tenant") return;
  const inquiryId = String(formData.get("inquiryId") || "");
  const inquiry = assertInquiryOwner(inquiryId, session.sub);
  if (!inquiry || inquiry.status === "draft" || !isEmailConfigured()) return;

  const parsed = externalInquiryReplySchema.safeParse({ body: String(formData.get("body") || "") });
  if (!parsed.success) return;

  const tenant = getProfileById(session.sub);
  const result = await sendExternalInquiryEmail({
    inquiryId,
    toEmail: inquiry.contact_email,
    tenantName: tenant?.full_name ?? "a LeaseMatch tenant",
    propertyTitle: inquiry.listing_title,
    sourceSite: inquiry.source_site,
    body: parsed.data.body,
  });
  if (result.ok) {
    addExternalInquiryMessage({
      inquiryId,
      direction: "outbound",
      senderLabel: "You",
      body: parsed.data.body,
    });
  }
  revalidatePath(`/dashboard/inquiries/${inquiryId}`);
}
