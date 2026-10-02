"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import {
  createAgentCall,
  createExternalInquiry,
  getExternalInquiryById,
  getMarketListing,
  getProfileById,
  getTenantPreferences,
  markExternalInquirySent,
  type CallLine,
} from "@/lib/db";
import { isEmailConfigured, sendExternalInquiryEmail } from "@/lib/email";
import {
  buildCallScript,
  callScenarios,
  estimateDurationSeconds,
  type CallScenario,
} from "@/lib/call-script";

async function requireTenant() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "tenant") redirect("/dashboard");
  return session;
}

// ---- Email the advertiser of a public ad found by market search ----

const emailSchema = z.object({
  listingId: z.string().min(1),
  // For results pages: which specific ad on that page the tenant is asking about.
  adTitle: z.string().trim().max(200).optional(),
  toEmail: z.string().trim().email("Enter the advertiser's email address from the ad"),
  body: z.string().trim().min(10, "Write a short message").max(4000),
  intent: z.enum(["send", "draft"]),
});

export type EmailAdvertiserState = { error?: string } | undefined;

export async function emailAdvertiserAction(
  _prev: EmailAdvertiserState,
  formData: FormData
): Promise<EmailAdvertiserState> {
  const session = await requireTenant();
  const parsed = emailSchema.safeParse({
    listingId: formData.get("listingId"),
    adTitle: formData.get("adTitle") ?? undefined,
    toEmail: formData.get("toEmail"),
    body: formData.get("body"),
    intent: formData.get("intent"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form" };

  const listing = getMarketListing(parsed.data.listingId);
  if (!listing || listing.tenant_id !== session.sub) return { error: "Listing not found" };

  const inquiry = createExternalInquiry({
    tenantId: session.sub,
    sourceSite: listing.source_site,
    listingTitle: parsed.data.adTitle || listing.title,
    listingUrl: listing.url,
    contactEmail: parsed.data.toEmail,
    contactPhone: listing.contact_phone,
    marketListingId: listing.id,
    draftBody: parsed.data.body,
  });

  if (parsed.data.intent === "send") {
    if (!isEmailConfigured()) {
      // Saved as a draft; the inquiry page offers "open in my email app".
      redirect(`/dashboard/inquiries/${inquiry.id}?notice=email-not-connected`);
    }
    const tenant = getProfileById(session.sub);
    const result = await sendExternalInquiryEmail({
      inquiryId: inquiry.id,
      toEmail: inquiry.contact_email,
      tenantName: tenant?.full_name ?? "a LeaseMatch tenant",
      propertyTitle: inquiry.listing_title,
      sourceSite: inquiry.source_site,
      body: parsed.data.body,
    });
    if (!result.ok) {
      redirect(`/dashboard/inquiries/${inquiry.id}?notice=send-failed`);
    }
    markExternalInquirySent(inquiry.id);
  }

  revalidatePath("/dashboard/inquiries");
  redirect(`/dashboard/inquiries/${inquiry.id}`);
}

// When email sending isn't connected, the tenant can send the draft from
// their own mail app (mailto link) and then record that here so the thread
// moves on from "draft".
export async function markInquirySentManuallyAction(formData: FormData) {
  const session = await requireTenant();
  const inquiryId = String(formData.get("inquiryId") || "");
  const inquiry = getExternalInquiryById(inquiryId);
  if (!inquiry || inquiry.tenant_id !== session.sub || inquiry.status !== "draft") return;
  markExternalInquirySent(inquiryId);
  revalidatePath(`/dashboard/inquiries/${inquiryId}`);
  revalidatePath("/dashboard/inquiries");
}

// ---- Simulated agent phone call ----

export type CallTarget = { marketListingId?: string; inquiryId?: string };

async function resolveCallTarget(target: CallTarget, tenantId: string) {
  const inquiry = target.inquiryId ? getExternalInquiryById(target.inquiryId) : undefined;
  if (inquiry && inquiry.tenant_id !== tenantId) return null;
  const listingId = target.marketListingId ?? inquiry?.market_listing_id ?? undefined;
  const listing = listingId ? getMarketListing(listingId) : undefined;
  if (listing && listing.tenant_id !== tenantId) return null;
  if (!inquiry && !listing) return null;
  return {
    inquiry,
    listing,
    title: listing?.title ?? inquiry!.listing_title,
    sourceSite: listing?.source_site ?? inquiry!.source_site,
  };
}

function scriptFor(
  resolved: NonNullable<Awaited<ReturnType<typeof resolveCallTarget>>>,
  tenantId: string,
  seed: string,
  scenario: CallScenario | "random"
) {
  const tenant = getProfileById(tenantId);
  const prefs = getTenantPreferences(tenantId);
  return buildCallScript({
    seed,
    scenario,
    listingTitle: resolved.title,
    sourceSite: resolved.sourceSite,
    priceText: resolved.listing?.price_text ?? null,
    location: resolved.listing?.location ?? null,
    advertiserName: resolved.listing?.advertiser_name ?? null,
    tenantFirstName: tenant?.full_name.split(" ")[0] ?? "the tenant",
    tenantBudget: prefs?.budget ?? null,
  });
}

const scenarioSchema = z.enum(["random", ...(Object.keys(callScenarios) as CallScenario[])]);

export async function startSimulatedCallAction(target: CallTarget, scenario: string) {
  const session = await requireTenant();
  const resolved = await resolveCallTarget(target, session.sub);
  if (!resolved) return { error: "Nothing to call about." as const };
  const sc = scenarioSchema.safeParse(scenario);
  const seed = randomUUID();
  const script = scriptFor(resolved, session.sub, seed, sc.success ? sc.data : "random");
  return { seed, scenario: script.scenario, script };
}

// The transcript is rebuilt server-side from the same seed + scenario rather
// than trusting text posted from the browser.
export async function saveSimulatedCallAction(input: {
  target: CallTarget;
  seed: string;
  scenario: string;
  linesHeard: number;
}) {
  const session = await requireTenant();
  const resolved = await resolveCallTarget(input.target, session.sub);
  if (!resolved) return { error: "Nothing to call about." };
  const sc = scenarioSchema.safeParse(input.scenario);
  if (!sc.success || sc.data === "random") return { error: "Unknown scenario" };

  const script = scriptFor(resolved, session.sub, input.seed, sc.data);
  const heard = Math.max(1, Math.min(script.lines.length, Math.floor(input.linesHeard)));
  const endedEarly = heard < script.lines.length;
  const lines: CallLine[] = script.lines.slice(0, heard);

  const call = createAgentCall({
    tenantId: session.sub,
    marketListingId: resolved.listing?.id ?? null,
    inquiryId: resolved.inquiry?.id ?? null,
    listingTitle: resolved.title,
    calleeLabel: script.calleeLabel,
    outcome: endedEarly ? "Hung up early" : script.outcome,
    transcript: lines,
    summary: endedEarly
      ? "You ended the simulated call before it finished — no outcome recorded."
      : script.summary,
    durationSeconds: estimateDurationSeconds(lines),
  });

  if (resolved.listing) revalidatePath(`/dashboard/market/${resolved.listing.id}`);
  if (resolved.inquiry) revalidatePath(`/dashboard/inquiries/${resolved.inquiry.id}`);
  revalidatePath("/dashboard/calls");
  return { callId: call.id };
}
