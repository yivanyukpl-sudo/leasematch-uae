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
} from "@/lib/payments";
import { draftNegotiationMessage } from "@/lib/ai";
import { comparablesFor } from "@/lib/comparables";
import { isEmailConfigured, sendExternalInquiryEmail } from "@/lib/email";
import { externalInquiryReplySchema } from "@/lib/schemas";

import { getPackage } from "@/lib/packages";
import { leaseTermsSchema } from "@/lib/schemas";
import { answerDealQuestion } from "@/lib/deal-assistant";
import { confirmHandover, markKeysReceived, markPackagePaid, saveLeaseTerms, setHandover, setLeasePackage } from "@/lib/db";
import { handoverSchema } from "@/lib/schemas";
import { getStripe } from "@/lib/payments";
import { rateLimit } from "@/lib/rate-limit";
import { notifyTenantsAboutListing } from "@/lib/alerts";

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
  // Tenants waiting with a matching "notify me" alert hear about it now.
  await notifyTenantsAboutListing({ ...property, status: "live" });
  revalidatePath("/dashboard");
}

// ---- Guided deal: terms, package, assistant ----

export async function saveTermsAction(formData: FormData) {
  const session = await requireSession();
  const leaseId = String(formData.get("leaseId") || "");
  const lease = assertLeaseParty(leaseId, session.sub);
  if (!lease || lease.stage !== "awaiting_signature" || lease.tenant_signed_at || lease.landlord_signed_at) return;
  const parsed = leaseTermsSchema.safeParse({
    startDate: formData.get("startDate"),
    months: formData.get("months"),
    deposit: formData.get("deposit"),
    cheques: formData.get("cheques"),
    utilities: formData.get("utilities"),
    notes: String(formData.get("notes") || "").trim() || null,
  });
  if (!parsed.success) redirect(`/dashboard/leases/${leaseId}?termsError=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Check the terms")}`);
  saveLeaseTerms(leaseId, parsed.data);
  addLeaseMessage({
    leaseId,
    senderId: session.sub,
    body: `Updated the contract terms: from ${parsed.data.startDate}, ${parsed.data.months} months, deposit AED ${parsed.data.deposit}, ${parsed.data.cheques} cheque(s).`,
  });
  revalidatePath(`/dashboard/leases/${leaseId}`);
}

export async function choosePackageAction(formData: FormData) {
  const session = await requireSession();
  const leaseId = String(formData.get("leaseId") || "");
  const lease = assertLeaseParty(leaseId, session.sub);
  const pkg = getPackage(String(formData.get("package") || ""));
  if (!lease || lease.tenant_id !== session.sub || !pkg || lease.package_paid_at) return;
  setLeasePackage(leaseId, pkg.id);
  const stripe = getStripe();
  if (stripe) {
    const tenant = getProfileById(session.sub);
    const checkout = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: tenant?.email,
      line_items: [{ price_data: { currency: "aed", unit_amount: pkg.price * 100, product_data: { name: `LeaseMatch package — ${pkg.name}` } }, quantity: 1 }],
      metadata: { leaseId, purpose: "package", package: pkg.id },
      success_url: await absoluteUrl(`/dashboard/leases/${leaseId}?package_session={CHECKOUT_SESSION_ID}`),
      cancel_url: await absoluteUrl(`/dashboard/leases/${leaseId}`),
    });
    if (checkout.url) redirect(checkout.url);
    return;
  }
  // Prototype without a payment provider: record a simulated payment.
  markPackagePaid(leaseId);
  addLeaseMessage({ leaseId, senderId: session.sub, body: `Chose the “${pkg.name}” package (AED ${pkg.price}) — simulated payment.` });
  revalidatePath(`/dashboard/leases/${leaseId}`);
}

export async function askDealAssistantAction(leaseId: string, question: string): Promise<{ answer: string }> {
  const session = await requireSession();
  const lease = assertLeaseParty(leaseId, session.sub);
  if (!lease) return { answer: "You don't have access to this lease." };
  if (!rateLimit(`deal-assistant:${session.sub}`, 30, 60 * 60).ok) return { answer: "Too many questions this hour — try again a bit later." };
  const property = getPropertyById(lease.property_id);
  return { answer: await answerDealQuestion({ question: question.slice(0, 800), lease, property: property ?? null, role: lease.tenant_id === session.sub ? "tenant" : "owner" }) };
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
  // The guided deal: terms agreed and the tenant's package paid before anyone signs.
  if (!lease.terms || !lease.package_paid_at) return;
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

// ---- Key handover (after the agreement is concluded) ----

export async function saveHandoverAction(formData: FormData) {
  const session = await requireSession();
  const leaseId = String(formData.get("leaseId") || "");
  const lease = assertLeaseParty(leaseId, session.sub);
  if (!lease || lease.tenant_id !== session.sub || lease.stage !== "finalized" || lease.keys_received_at) return;
  const opt = (k: string) => String(formData.get(k) || "").trim() || null;
  const method = formData.get("method");
  const parsed = handoverSchema.safeParse(
    method === "mail"
      ? { method, address: opt("address") ?? "", recipient: opt("recipient") ?? "", phone: opt("phone"), notes: opt("notes") }
      : { method, date: opt("date") ?? "", time: opt("time") ?? "", place: opt("place") ?? "", notes: opt("notes") }
  );
  if (!parsed.success) {
    redirect(`/dashboard/leases/${leaseId}?handoverError=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Check the details")}#deal-steps`);
  }
  const h = parsed.data;
  setHandover(leaseId, {
    method: h.method,
    date: h.method === "in_person" ? h.date : null,
    time: h.method === "in_person" ? h.time : null,
    place: h.method === "in_person" ? h.place : null,
    address: h.method === "mail" ? h.address : null,
    recipient: h.method === "mail" ? h.recipient : null,
    phone: h.method === "mail" ? h.phone : null,
    notes: h.notes,
  });
  addLeaseMessage({
    leaseId,
    senderId: session.sub,
    body:
      h.method === "in_person"
        ? `Key handover: I'd like to receive the keys in hand on ${h.date} at ${h.time}, at ${h.place}.`
        : `Key handover: please send the keys by mail to ${h.address} (recipient: ${h.recipient}).`,
  });
  revalidatePath(`/dashboard/leases/${leaseId}`);
}

export async function confirmHandoverAction(formData: FormData) {
  const session = await requireSession();
  const leaseId = String(formData.get("leaseId") || "");
  const lease = assertLeaseParty(leaseId, session.sub);
  if (!lease || lease.provider_id !== session.sub || !lease.handover_method || lease.handover_confirmed_at) return;
  confirmHandover(leaseId);
  addLeaseMessage({
    leaseId,
    senderId: session.sub,
    body: lease.handover_method === "mail" ? "Confirmed: I'll send the keys by mail to the address given." : `Confirmed: see you on ${lease.handover_date} at ${lease.handover_time}, ${lease.handover_place}.`,
  });
  revalidatePath(`/dashboard/leases/${leaseId}`);
}

export async function keysReceivedAction(formData: FormData) {
  const session = await requireSession();
  const leaseId = String(formData.get("leaseId") || "");
  const lease = assertLeaseParty(leaseId, session.sub);
  if (!lease || lease.tenant_id !== session.sub || !lease.handover_confirmed_at || lease.keys_received_at) return;
  markKeysReceived(leaseId);
  addLeaseMessage({ leaseId, senderId: session.sub, body: "I received the keys. Thank you!" });
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
