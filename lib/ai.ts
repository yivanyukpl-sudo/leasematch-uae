// The AI agent layer — an OpenAI-powered assistant (Responses API with
// function calling) that can actually take actions in the app (search
// listings, apply, draft negotiation messages) rather than just answering
// questions about them.
//
// Requires OPENAI_API_KEY in the server environment (see
// .env.local.example). Without it, the chat surfaces explain that clearly
// instead of pretending to be live — same pattern as the Stripe integration
// in lib/payments.ts.

import type {
  FunctionTool,
  ResponseInputItem,
  Tool,
} from "openai/resources/responses/responses";
import {
  createApplication,
  createExternalInquiry,
  getApplicationForTenant,
  getExternalInquiryById,
  getProfileById,
  getTenantPreferences,
  listExternalInquiryMessages,
  listLiveProperties,
  markExternalInquirySent,
  scoreProperty,
  updateExternalInquiryDraft,
  type Property,
} from "./db";
import { comparablesFor } from "./comparables";
import { isEmailConfigured, sendExternalInquiryEmail } from "./email";
import { describeOpenAIError, getOpenAI, isOpenAIConfigured, OPENAI_MODEL } from "./openai";

export function isAgentConfigured(): boolean {
  return isOpenAIConfigured();
}

export type AgentMessage = { role: "user" | "assistant"; content: string };

export type AgentAction =
  | { type: "applied"; propertyId: string; propertyTitle: string }
  | { type: "external_inquiry_drafted"; inquiryId: string; propertyTitle: string }
  | { type: "external_inquiry_sent"; inquiryId: string; propertyTitle: string };

type ToolContext = { tenantId: string };

function summarizeProperty(p: Property, score: number) {
  const stats = comparablesFor(p);
  return {
    id: p.id,
    title: p.title,
    propertyType: p.property_type,
    location: p.location,
    priceAedPerYear: p.price,
    beds: p.beds,
    baths: p.baths,
    furnished: p.furnished,
    amenities: p.amenities,
    matchScore: score,
    marketComparables:
      stats.count > 0
        ? {
            comparableListingsInSameAreaAndType: stats.count,
            averagePriceAedPerYear: stats.avgPrice,
            rangeAedPerYear: [stats.minPrice, stats.maxPrice],
          }
        : "No other live listings of this type in this area to compare against yet.",
  };
}

// OpenAI's hosted web search tool — a genuine server-side search (OpenAI
// runs it and returns real results with citations), not scraping. Restricted
// to real UAE property portals so the agent can only ever surface actual
// listing sites when a tenant asks it to look beyond LeaseMatch's own
// database. Every result from this tool must be presented as unverified —
// see SYSTEM_PROMPT below.
const webSearchTool: Tool = {
  type: "web_search",
  filters: {
    allowed_domains: ["bayut.com", "propertyfinder.ae", "dubizzle.com", "dubai.dubizzle.com", "abudhabi.dubizzle.com"],
  },
};

// Function tools, in the shape the Responses API expects. Not strict: several
// parameters are genuinely optional.
const tools: FunctionTool[] = ([
  {
    name: "search_properties",
    description:
      "Search currently live LeaseMatch listings. Always use this instead of guessing what's available — never invent a listing. Returns each match with its match score and real market-comparable stats (average/min/max price among similar live listings in the same area and type), which you should use to judge whether the tenant's budget is realistic and to ground any advice you give.",
    input_schema: {
      type: "object",
      properties: {
        propertyTypes: {
          type: "array",
          items: { type: "string" },
          description: "e.g. Apartment, Villa, Townhouse, Studio, Penthouse, Office. Omit or leave empty to match any type.",
        },
        locations: {
          type: "array",
          items: { type: "string" },
          description: "e.g. Dubai Marina, Downtown Dubai. Omit or leave empty to match any location.",
        },
        maxBudget: {
          type: "number",
          description: "Maximum annual rent in AED the tenant is willing to pay. Omit if unknown.",
        },
      },
    },
  },
  {
    name: "apply_to_property",
    description:
      "Submit a real rental application on the tenant's behalf. Only call this after the tenant has clearly confirmed, in this conversation, that they want to apply to this specific listing — never apply speculatively or to multiple listings without explicit confirmation for each.",
    input_schema: {
      type: "object",
      properties: {
        propertyId: { type: "string" },
        occupation: { type: "string" },
        monthlyIncome: { type: "number", description: "Monthly income in AED, if the tenant has shared it." },
        moveIn: { type: "string", description: "Preferred move-in timing, e.g. 'Flexible' or a date." },
        note: { type: "string", description: "A short note to the provider, if useful." },
      },
      required: ["propertyId", "occupation"],
    },
  },
  {
    name: "draft_external_inquiry",
    description:
      "Draft an email inquiry to the contact for a listing found OUTSIDE LeaseMatch (via web_search on Bayut/Property Finder/Dubizzle). This does NOT send anything. Call this once per listing to start the draft; after this, show the full draft text to the tenant in your reply and ask if they'd like changes or to send it — iterate with update_external_inquiry_draft as they give feedback, and only call send_external_inquiry once they clearly say to send it. Only call this after the tenant has explicitly asked you to reach out about a specific external listing, and only once you have (or the tenant has given you) a real contact email — if web_search didn't surface one, ask the tenant for it instead of guessing.",
    input_schema: {
      type: "object",
      properties: {
        sourceSite: { type: "string", description: "e.g. Bayut, Property Finder, Dubizzle" },
        listingTitle: { type: "string" },
        listingUrl: { type: "string", description: "The URL of the external listing, if known." },
        contactEmail: { type: "string" },
        draftBody: {
          type: "string",
          description:
            "A short, polite inquiry email body (3-5 sentences) written as if from the tenant: introduce them briefly, ask about availability/viewing, and reference anything specific about the listing. No greeting/sign-off boilerplate needed — that's added automatically.",
        },
      },
      required: ["sourceSite", "listingTitle", "contactEmail", "draftBody"],
    },
  },
  {
    name: "update_external_inquiry_draft",
    description:
      "Revise the body of an existing external-inquiry draft (from draft_external_inquiry) based on tenant feedback in this conversation — e.g. they asked you to shorten it, mention a move-in date, soften the tone. Always show the tenant the full new draft text in your reply after calling this, and ask again if it's ready to send.",
    input_schema: {
      type: "object",
      properties: {
        inquiryId: { type: "string" },
        draftBody: { type: "string", description: "The complete revised email body." },
      },
      required: ["inquiryId", "draftBody"],
    },
  },
  {
    name: "send_external_inquiry",
    description:
      "Actually send a drafted external-inquiry email to the listing's contact. Only call this once the tenant has clearly and explicitly confirmed, in this conversation, that the current draft is ready to send (e.g. 'send it', 'looks good, go ahead') — never send speculatively, and never send a draft the tenant hasn't seen the final text of. If they haven't seen the current draft text yet, show it to them first instead of calling this.",
    input_schema: {
      type: "object",
      properties: {
        inquiryId: { type: "string" },
      },
      required: ["inquiryId"],
    },
  },
] as const).map((t) => ({
  type: "function" as const,
  name: t.name,
  description: t.description,
  parameters: t.input_schema as unknown as Record<string, unknown>,
  strict: false,
}));

async function runTool(
  name: string,
  input: Record<string, unknown>,
  ctx: ToolContext,
  actions: AgentAction[]
): Promise<unknown> {
  if (name === "search_properties") {
    const propertyTypes = Array.isArray(input.propertyTypes)
      ? (input.propertyTypes as string[])
      : [];
    const locations = Array.isArray(input.locations) ? (input.locations as string[]) : [];
    const maxBudget = typeof input.maxBudget === "number" ? input.maxBudget : null;

    const prefs = getTenantPreferences(ctx.tenantId);
    const fakePrefs = {
      profile_id: ctx.tenantId,
      property_types: propertyTypes,
      locations: locations,
      budget: maxBudget,
      furnished: prefs?.furnished ?? null,
      notes: null,
      updated_at: "",
    };

    let matches = listLiveProperties()
      .map((p) => ({ property: p, score: scoreProperty(p, fakePrefs) }))
      .sort((a, b) => b.score - a.score);

    if (propertyTypes.length) {
      matches = matches.filter((m) => propertyTypes.includes(m.property.property_type));
    }
    if (locations.length) {
      matches = matches.filter((m) => locations.includes(m.property.location));
    }

    const inBudget = maxBudget ? matches.filter((m) => m.property.price <= maxBudget) : matches;

    return {
      totalLiveListings: listLiveProperties().length,
      matchesWithinStatedBudget: inBudget.length,
      results: (inBudget.length ? inBudget : matches)
        .slice(0, 8)
        .map((m) => summarizeProperty(m.property, m.score)),
    };
  }

  if (name === "draft_external_inquiry") {
    const contactEmail = String(input.contactEmail || "").trim();
    const draftBody = String(input.draftBody || "").trim();
    if (!contactEmail || !draftBody) {
      return { error: "Missing contactEmail or draftBody." };
    }
    const inquiry = createExternalInquiry({
      tenantId: ctx.tenantId,
      sourceSite: String(input.sourceSite || "the web"),
      listingTitle: String(input.listingTitle || "the listing"),
      listingUrl: typeof input.listingUrl === "string" ? input.listingUrl : null,
      contactEmail,
      draftBody,
    });
    actions.push({
      type: "external_inquiry_drafted",
      inquiryId: inquiry.id,
      propertyTitle: inquiry.listing_title,
    });
    return {
      inquiryId: inquiry.id,
      status: "draft",
      draftBody,
      emailSendingConfigured: isEmailConfigured(),
      note: "Saved as a draft only — nothing was sent. Show the full draftBody text to the tenant now and ask if they want changes or to send it.",
    };
  }

  if (name === "update_external_inquiry_draft") {
    const inquiryId = String(input.inquiryId || "");
    const draftBody = String(input.draftBody || "").trim();
    const inquiry = getExternalInquiryById(inquiryId);
    if (!inquiry || inquiry.tenant_id !== ctx.tenantId) {
      return { error: "Inquiry not found." };
    }
    if (inquiry.status !== "draft") {
      return { error: `This inquiry is already ${inquiry.status} — it can no longer be edited here.` };
    }
    if (!draftBody) return { error: "Missing draftBody." };
    updateExternalInquiryDraft(inquiryId, draftBody);
    return {
      inquiryId,
      draftBody,
      note: "Draft updated, still not sent. Show the full new draftBody text to the tenant now and ask if it's ready to send.",
    };
  }

  if (name === "send_external_inquiry") {
    const inquiryId = String(input.inquiryId || "");
    const inquiry = getExternalInquiryById(inquiryId);
    if (!inquiry || inquiry.tenant_id !== ctx.tenantId) {
      return { error: "Inquiry not found." };
    }
    if (inquiry.status !== "draft") {
      return { error: `This inquiry was already ${inquiry.status} — nothing new was sent.` };
    }
    if (!isEmailConfigured()) {
      return {
        sent: false,
        note: "Email sending isn't connected on this instance (MAILGUN_API_KEY/MAILGUN_DOMAIN). Tell the tenant it's saved as a draft on their External inquiries page, where they can send it manually once that's set up.",
      };
    }
    const tenant = getProfileById(ctx.tenantId);
    const draftMessage = listExternalInquiryMessages(inquiryId).find(
      (msg) => msg.direction === "outbound"
    );
    const body = draftMessage?.body ?? "";
    const result = await sendExternalInquiryEmail({
      inquiryId,
      toEmail: inquiry.contact_email,
      tenantName: tenant?.full_name ?? "a LeaseMatch tenant",
      propertyTitle: inquiry.listing_title,
      sourceSite: inquiry.source_site,
      body,
    });
    if (!result.ok) {
      return { sent: false, error: result.error ?? "Send failed for an unknown reason." };
    }
    markExternalInquirySent(inquiryId);
    actions.push({
      type: "external_inquiry_sent",
      inquiryId,
      propertyTitle: inquiry.listing_title,
    });
    return { sent: true, to: inquiry.contact_email };
  }

  if (name === "apply_to_property") {
    const propertyId = String(input.propertyId || "");
    const existing = getApplicationForTenant(propertyId, ctx.tenantId);
    if (existing) {
      return { alreadyApplied: true, status: existing.status };
    }
    const application = createApplication({
      propertyId,
      tenantId: ctx.tenantId,
      occupation: String(input.occupation || "Not specified"),
      monthlyIncome: typeof input.monthlyIncome === "number" ? input.monthlyIncome : null,
      moveIn: typeof input.moveIn === "string" ? input.moveIn : null,
      note: typeof input.note === "string" ? input.note : null,
    });
    const property = listLiveProperties().find((p) => p.id === propertyId);
    actions.push({
      type: "applied",
      propertyId,
      propertyTitle: property?.title ?? "the listing",
    });
    return { applicationId: application.id, status: application.status };
  }

  return { error: `Unknown tool ${name}` };
}

const SYSTEM_PROMPT = `You are the LeaseMatch AI agent — you act as a real UAE rental agent for the tenant you're talking to, not a search box. Behave the way a good, honest human agent would:

Formatting — this matters: your replies render as plain text in a chat bubble, with no Markdown rendering at all. Never use Markdown syntax of any kind — no **bold**, no ## headers, no --- horizontal rules, no numbered "1." or bulleted "-"/"*" list syntax, no [links](url) syntax. Write in plain conversational sentences and short paragraphs, the way you'd text someone. If you need to present a few options or figures, do it in a sentence ("Murjan averages about AED 116k, Shams is similar, and Rimal runs 117-119k") or on separate plain lines without any leading symbol. Paste URLs as bare plain text (https://...) so they're at least visible as a link, never inside brackets or markup.

- Ask a clarifying question when the request is vague (budget, area, property type, move-in timing) rather than guessing.
- Always call search_properties to see what's real before recommending anything from LeaseMatch — never invent or assume a listing exists.
- Use the marketComparables data returned by search_properties to judge whether a stated budget is realistic for the area/type requested. If someone's budget is well below what similar live listings cost, say so plainly and explain the gap using the real numbers (e.g. "listings like that in Dubai Marina are averaging AED X — your budget is about Y% below that"), then offer concrete alternatives: a nearby cheaper area, a smaller unit type, or accepting they may need to increase budget. Don't just say "no matches" — explain why and advise, the way an agent would on a call.
- If there truly are no live listings matching the request at all (zero results, even loosely), say that directly and suggest what to search instead — don't pretend something is available.
- Only call apply_to_property after the tenant has clearly confirmed they want to apply to that specific listing.
- Keep replies conversational and concise — a few sentences, not a report. You're texting with someone, not writing a memo.
- Never fabricate prices, availability, or application status — everything must come from tool results.

Two sources of listings:
1. LeaseMatch's own verified database (search_properties) — every listing here has been published by a real owner/broker/property manager account on this platform. Applications, matching, signatures and payment all work for these.
2. The open web (web_search, limited to Bayut, Property Finder and Dubizzle) — real listings from other UAE property portals, but LeaseMatch has not verified the poster, the price, or that the unit is still available.

Default to LeaseMatch's own database unless the tenant asks you to also look at other sites, mentions wanting to "see everything," "check the web too," or similar. When they do, use web_search and clearly label every result you bring back from it as external and unverified — literally say so (e.g. "Unverified, from Bayut, not LeaseMatch") and include the source site name and a link for each one, and remind them to confirm details directly with the listing agent before doing anything with it (never offer to "apply" through LeaseMatch to a web result — applications only work for LeaseMatch's own listings). Never blend a web result into a LeaseMatch listing or present it with the same confidence as a verified one. Always mention that LeaseMatch's own verified listings are the safer, recommended option when one exists that's close to what they want.

When the tenant wants actual listings to look at or reach out to (not just market data), your goal is specific, individual units with a real URL and, where shown, a contact — not aggregate averages. A web_search very often surfaces an area/category overview or search-results page first (e.g. "studios for rent in Business Bay") rather than a single unit's own page — that is normal and is not a dead end. That overview page itself sometimes lists multiple individual units as cards, each with its own title, price, and its own detail-page URL embedded in the page content you were given back from the search. Look closely through the fetched page content (not just the top-level URL) for those individual listing entries and their own links. If what came back truly is only a statistics/market-report article with no individual units listed anywhere in it, run one more web_search with the exact building name plus bedroom count plus price together (e.g. "Bay Square studio for rent AED 85000"), since a named building is more likely to surface that building's own listing cards.

Absolute rule, no exceptions: every individual "listing" you present with a specific price and/or size must have come from that exact text in your actual tool results, tied to its own distinct URL that also came from your tool results — never estimate, interpolate, or invent a plausible-sounding price or square footage for a unit, and never attach a number you saw in a market-average sentence to a specific "listing" as if it were that unit's real figure. If two would-be listings would share the same URL, they are not two listings — a URL only counts as one specific listing if it is a page for a single unit; if it's a search/category URL, don't present it as an individual listing at all, no matter how many different price/size combinations you're tempted to invent to go with it. If the tenant asks for a specific number of listings (e.g. "10 links") and you only actually have fewer distinct, individually-real ones from your tool results, give them exactly that number and say plainly you could only find that many — padding the list with fabricated or duplicated entries to hit the requested count is never acceptable, even once. It is always better to honestly say "I found 3 real individual listings, plus these category pages you can browse for more" than to invent 7 more to look complete. Also mention, briefly and once, that third-party listings can be taken down or rented at any time, so a link might occasionally lead to an expired page — that's normal for external sites and not something you can verify in advance.

If the tenant wants to actually reach out about an external listing, you can help the way a real agent would — and you drive this conversationally, not by silently filing a draft for them to find later:
1. You need a real contact email first. If web_search surfaced one, use it; if not, ask the tenant for it (they may have it from the listing page) rather than inventing one.
2. Call draft_external_inquiry to create the draft, then immediately show the tenant the FULL email text you wrote, in your reply, and ask if they'd like any changes or if it's ready to send. Never just say "I've drafted it" without showing the actual text.
3. If they ask for changes (shorter, mention a date, different tone, anything), call update_external_inquiry_draft with the revised text, then again show them the full new draft and ask if it's ready. Repeat as many times as they want.
4. Only call send_external_inquiry once the tenant has clearly and explicitly said to send it (e.g. "send it," "looks good, go ahead") — for the exact draft text they last saw. Never send a version they haven't seen, and never send without that explicit go-ahead.
5. After sending, confirm it was sent and to which address, and mention that any reply will show up in this same conversation area — their "External inquiries" page — where they can also review or send inquiries the same way outside this chat.
Throughout, be clear this is an unverified third-party listing and LeaseMatch isn't the agent for it.`;

export async function runAgentTurn(
  history: AgentMessage[],
  ctx: ToolContext
): Promise<{ reply: string; actions: AgentAction[] }> {
  const openai = getOpenAI();
  if (!openai) {
    return {
      reply:
        "The AI agent isn't connected yet — add OPENAI_API_KEY to the server environment to enable it (see .env.local.example).",
      actions: [],
    };
  }

  const actions: AgentAction[] = [];
  let input: ResponseInputItem[] = history.map((m) => ({ role: m.role, content: m.content }));
  let previousResponseId: string | undefined;

  try {
    for (let turn = 0; turn < 6; turn++) {
      const response = await openai.responses.create({
        model: OPENAI_MODEL,
        instructions: SYSTEM_PROMPT,
        input,
        tools: [...tools, webSearchTool],
        reasoning: { effort: "low" },
        previous_response_id: previousResponseId,
      });

      const calls = response.output.filter((item) => item.type === "function_call");
      if (calls.length === 0) {
        return { reply: response.output_text.trim() || "…", actions };
      }

      const outputs: ResponseInputItem[] = [];
      for (const call of calls) {
        if (call.type !== "function_call") continue;
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(call.arguments || "{}");
        } catch {
          outputs.push({ type: "function_call_output", call_id: call.call_id, output: JSON.stringify({ error: "Arguments were not valid JSON." }) });
          continue;
        }
        const result = await runTool(call.name, args, ctx, actions);
        outputs.push({ type: "function_call_output", call_id: call.call_id, output: JSON.stringify(result) });
      }
      previousResponseId = response.id;
      input = outputs;
    }
  } catch (error) {
    return { reply: describeOpenAIError(error), actions };
  }

  return {
    reply: "I got a bit stuck working through that — could you rephrase or simplify your request?",
    actions,
  };
}

// One-shot use, outside the chat loop: draft a negotiation message for the
// lease amendment chat when the sign-time price check flags a listing as
// above market.
export async function draftNegotiationMessage(input: {
  propertyTitle: string;
  location: string;
  askingPrice: number;
  comparableAvg: number;
  tenantName: string;
}): Promise<string | null> {
  const openai = getOpenAI();
  if (!openai) return null;

  try {
    const response = await openai.responses.create({
      model: OPENAI_MODEL,
      reasoning: { effort: "low" },
      instructions:
        "You draft short, polite, direct messages a tenant can send to a landlord to negotiate rent. No preamble, no sign-off boilerplate beyond a first name — just the message body, 3-5 sentences.",
      input: `Draft a message from ${input.tenantName} to the landlord of "${input.propertyTitle}" in ${input.location}, asking for a lower rent. The asking price is AED ${input.askingPrice.toLocaleString()}/year. Comparable live listings in the same area and type average AED ${input.comparableAvg.toLocaleString()}/year. Politely reference that comparison and propose a specific, reasonable counter-offer number.`,
    });
    return response.output_text.trim() || null;
  } catch {
    return null;
  }
}
