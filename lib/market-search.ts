// The market-search agent: finds up-to-date rental ads on Bayut and Dubizzle
// for a tenant's criteria.
//
// No scraping. The only way this touches those sites is OpenAI's hosted
// web_search tool (OpenAI runs the search server-side and returns real
// results), restricted with a domain filter to bayut.com and dubizzle.com.
// LeaseMatch never fetches or parses either site itself.
//
// Anti-hallucination: the model reports what it found through a strict
// `report_listings` function, and every reported URL is checked against the
// sources and citations the search actually returned in this run. Anything
// that didn't come back from a real search result is dropped before it
// reaches the tenant.

import type {
  FunctionTool,
  ResponseInputItem,
  ResponseOutputItem,
  Tool,
} from "openai/resources/responses/responses";
import { z } from "zod";
import type { MarketListing } from "./db";
import { describeOpenAIError, getOpenAI, OPENAI_MODEL } from "./openai";

export const marketSites = {
  bayut: { label: "Bayut", domains: ["bayut.com"] },
  dubizzle: { label: "Dubizzle", domains: ["dubizzle.com", "dubai.dubizzle.com", "abudhabi.dubizzle.com"] },
} as const;

export type MarketSite = keyof typeof marketSites;

export const marketCriteriaSchema = z.object({
  area: z.string().trim().min(2, "Enter an area, e.g. Dubai Marina").max(80),
  propertyType: z.string().trim().max(40).default("Apartment"),
  beds: z.string().trim().max(20).default("Any"),
  maxBudget: z.coerce.number().int().positive().max(10_000_000).optional(),
  furnished: z.enum(["any", "furnished", "unfurnished"]).default("any"),
  sites: z.array(z.enum(["bayut", "dubizzle"])).min(1, "Pick at least one site"),
  notes: z.string().trim().max(300).optional(),
});

export type MarketCriteria = z.infer<typeof marketCriteriaSchema>;

type FoundListing = Omit<MarketListing, "id" | "search_id" | "tenant_id" | "created_at">;

export type MarketSearchResult =
  | { ok: true; summary: string; listings: FoundListing[]; droppedUnverified: number; searches: number }
  | { ok: false; error: string };

const reportSchema = z.object({
  summary: z.string(),
  listings: z.array(
    z.object({
      kind: z.enum(["listing", "results_page"]),
      source_site: z.enum(["Bayut", "Dubizzle"]),
      title: z.string().min(1),
      url: z.string().min(1),
      price_text: z.string().nullable(),
      location: z.string().nullable(),
      beds: z.string().nullable(),
      advertiser_name: z.string().nullable(),
      contact_email: z.string().nullable(),
      contact_phone: z.string().nullable(),
      summary: z.string().nullable(),
    })
  ),
});

const nullableString = { type: ["string", "null"] };

const reportTool: FunctionTool = {
  type: "function",
  name: "report_listings",
  description:
    "Call this exactly once, after you have finished searching, to hand your findings back to the app. Every entry must come from a page your web_search actually returned in this conversation. Use null for any field the search result didn't show — never estimate or fill in a plausible value.",
  strict: true,
  parameters: {
    type: "object",
    additionalProperties: false,
    required: ["summary", "listings"],
    properties: {
      summary: {
        type: "string",
        description:
          "2-4 plain sentences for the tenant: what you found, how prices compare to their budget, and anything worth knowing (e.g. few results in budget). No markdown.",
      },
      listings: {
        type: "array",
        description: "Up to 12 entries, best matches first.",
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "kind",
            "source_site",
            "title",
            "url",
            "price_text",
            "location",
            "beds",
            "advertiser_name",
            "contact_email",
            "contact_phone",
            "summary",
          ],
          properties: {
            kind: {
              type: "string",
              enum: ["listing", "results_page"],
              description:
                "'listing' only if the URL is a single unit's own ad page. A search/category page that lists many units is 'results_page'.",
            },
            source_site: { type: "string", enum: ["Bayut", "Dubizzle"] },
            title: { type: "string" },
            url: { type: "string", description: "Exactly as returned by web_search." },
            price_text: { ...nullableString, description: "Price exactly as shown, e.g. 'AED 120,000/yr'." },
            location: nullableString,
            beds: nullableString,
            advertiser_name: { ...nullableString, description: "Agency or agent name, if shown." },
            contact_email: { ...nullableString, description: "Only if an email address is literally shown in the ad." },
            contact_phone: { ...nullableString, description: "Only if a phone number is literally shown in the ad." },
            summary: { ...nullableString, description: "One sentence on what stands out about this ad." },
          },
        },
      },
    },
  },
};

function normalizeUrl(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    return `${host}${u.pathname.replace(/\/+$/, "")}`.toLowerCase();
  } catch {
    return null;
  }
}

function hostAllowed(raw: string, domains: readonly string[]): boolean {
  try {
    const host = new URL(raw).hostname.toLowerCase().replace(/^www\./, "");
    return domains.some((d) => host === d || host.endsWith(`.${d}`));
  } catch {
    return false;
  }
}

// Every URL the hosted search returned in this response: the sources of
// each web_search_call, pages it opened, and URL citations in its text.
function collectSearchUrls(output: ResponseOutputItem[], into: Set<string>): number {
  let searches = 0;
  const add = (url: string | null | undefined) => {
    const n = url ? normalizeUrl(url) : null;
    if (n) into.add(n);
  };
  for (const item of output) {
    if (item.type === "web_search_call") {
      searches++;
      const action = item.action;
      if (action?.type === "search") action.sources?.forEach((src) => add(src.url));
      else if (action?.type === "open_page") add(action.url);
    } else if (item.type === "message") {
      for (const part of item.content) {
        if (part.type !== "output_text") continue;
        for (const a of part.annotations) if (a.type === "url_citation") add(a.url);
      }
    }
  }
  return searches;
}

function buildPrompt(c: MarketCriteria): string {
  const sites = c.sites.map((s) => marketSites[s].label).join(" and ");
  return [
    `Find current rental ads on ${sites} for a tenant in the UAE with these criteria:`,
    `- Area: ${c.area}`,
    `- Property type: ${c.propertyType}`,
    `- Bedrooms: ${c.beds}`,
    `- Max budget: ${c.maxBudget ? `AED ${c.maxBudget.toLocaleString()} per year` : "not specified"}`,
    `- Furnishing: ${c.furnished}`,
    c.notes ? `- Other wishes: ${c.notes}` : null,
    "",
    "Run a few focused searches (e.g. area + type + bedrooms + 'for rent'). Strongly prefer individual ad pages over category pages, and recent ads over old ones. Individual Bayut ads live at URLs like bayut.com/property/details-<number>.html; individual Dubizzle ads have dated paths like dubai.dubizzle.com/property-for-rent/residential/apartmentflat/<year>/<month>/<day>/<slug>/. When the first searches only return category pages, search again with a specific building name you saw there plus the bedroom count and 'for rent' (e.g. 'Princess Tower 2 bedroom for rent bayut'), which tends to surface single-ad pages. Then call report_listings once with what you found, individual ads first.",
    "Rules: only report URLs that your searches actually returned; never invent a listing, price, size, email or phone number; if the search result didn't show a field, use null. If you only found a few real ads, report only those — an honest short list beats a padded one.",
  ]
    .filter((l) => l !== null)
    .join("\n");
}

export async function searchMarketListings(criteria: MarketCriteria): Promise<MarketSearchResult> {
  const openai = getOpenAI();
  if (!openai) {
    return {
      ok: false,
      error: "The AI agent isn't connected yet — add OPENAI_API_KEY to .env.local to enable market search.",
    };
  }

  const domains = criteria.sites.flatMap((s) => [...marketSites[s].domains]);
  const tools: Tool[] = [
    { type: "web_search", filters: { allowed_domains: domains }, search_context_size: "medium" },
    reportTool,
  ];
  const instructions =
    "You are LeaseMatch's market-research agent for UAE rentals. You search public property portals on a tenant's behalf and report back only what you actually found. Accuracy matters more than volume. Always finish by calling report_listings exactly once.";

  const seenUrls = new Set<string>();
  let searches = 0;
  let input: string | ResponseInputItem[] = buildPrompt(criteria);
  let previousResponseId: string | undefined;

  try {
    for (let turn = 0; turn < 4; turn++) {
      const response = await openai.responses.create({
        model: OPENAI_MODEL,
        instructions,
        input,
        tools,
        tool_choice: "auto",
        include: ["web_search_call.action.sources"],
        reasoning: { effort: "low" },
        previous_response_id: previousResponseId,
      });

      searches += collectSearchUrls(response.output, seenUrls);

      const report = response.output.find(
        (item) => item.type === "function_call" && item.name === "report_listings"
      );
      if (report && report.type === "function_call") {
        let args: unknown;
        try {
          args = JSON.parse(report.arguments);
        } catch {
          return { ok: false, error: "The agent returned results in an unexpected shape — please try again." };
        }
        const parsed = reportSchema.safeParse(args);
        if (!parsed.success) {
          return { ok: false, error: "The agent returned results in an unexpected shape — please try again." };
        }
        const verified: FoundListing[] = [];
        let dropped = 0;
        const seenInReport = new Set<string>();
        for (const l of parsed.data.listings) {
          const n = normalizeUrl(l.url);
          if (!n || !seenUrls.has(n) || !hostAllowed(l.url, domains) || seenInReport.has(n)) {
            dropped++;
            continue;
          }
          seenInReport.add(n);
          verified.push({
            ...l,
            contact_email: l.contact_email && /\S+@\S+\.\S+/.test(l.contact_email) ? l.contact_email : null,
          });
        }
        return { ok: true, summary: parsed.data.summary, listings: verified, droppedUnverified: dropped, searches };
      }

      // The model answered in text instead of reporting — ask for the report.
      previousResponseId = response.id;
      input = [
        {
          role: "user",
          content: "Please call report_listings now with what you found (an empty list is fine).",
        },
      ];
    }
    return { ok: false, error: "The search took too many steps without finishing — please try again." };
  } catch (error) {
    return { ok: false, error: `Search failed. ${describeOpenAIError(error)}` };
  }
}
