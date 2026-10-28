// The market-search agent on Claude. Same contract as the OpenAI version in
// lib/market-search.ts: Anthropic's server-side web search, restricted to
// Bayut and Dubizzle, does all the searching (no scraping); the model hands
// back findings through a strict report_listings tool; and every reported
// URL is checked against the search results and citations Claude actually
// received in this run. Anything else is dropped.

import type Anthropic from "@anthropic-ai/sdk";
import { CLAUDE_MODEL, describeClaudeError, FALLBACK, getClaude } from "./claude";
import {
  buildPrompt,
  hostAllowed,
  marketSites,
  normalizeUrl,
  reportSchema,
  reportTool,
  type FoundListing,
  type MarketCriteria,
  type MarketSearchResult,
} from "./market-search";

// Collects every URL the search returned (results anywhere in the response,
// including ones produced through dynamic filtering) and every cited URL.
function collectUrls(node: unknown, into: Set<string>): number {
  let searches = 0;
  const walk = (v: unknown) => {
    if (Array.isArray(v)) return v.forEach(walk);
    if (!v || typeof v !== "object") return;
    const o = v as Record<string, unknown>;
    if ((o.type === "web_search_result" || o.type === "web_search_result_location") && typeof o.url === "string") {
      const n = normalizeUrl(o.url);
      if (n) into.add(n);
    }
    if (o.type === "web_search_tool_result") searches++;
    Object.values(o).forEach(walk);
  };
  walk(node);
  return searches;
}

export async function searchMarketListingsClaude(criteria: MarketCriteria): Promise<MarketSearchResult> {
  const claude = getClaude();
  if (!claude) return { ok: false, error: "The AI agent isn't connected — add ANTHROPIC_API_KEY to .env.local." };

  const domains = criteria.sites.flatMap((s) => [...marketSites[s].domains]);
  const tools: Anthropic.Beta.BetaToolUnion[] = [
    { type: "web_search_20260209", name: "web_search", max_uses: 10, allowed_domains: domains },
    {
      name: reportTool.name,
      description: reportTool.description ?? "",
      strict: true,
      input_schema: reportTool.parameters as unknown as Anthropic.Beta.BetaTool.InputSchema,
    },
  ];
  const system =
    "You are LeaseMatch's market-research agent for UAE rentals. You search public property portals on a tenant's behalf and report back only what you actually found. Accuracy matters more than volume. Always finish by calling report_listings exactly once.";

  const seenUrls = new Set<string>();
  let searches = 0;
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: buildPrompt(criteria) }];

  try {
    for (let turn = 0; turn < 6; turn++) {
      const response = await claude.beta.messages.create({
        ...FALLBACK,
        model: CLAUDE_MODEL,
        max_tokens: 16000,
        system,
        tools,
        output_config: { effort: "low" },
        messages,
      });
      searches += collectUrls(response.content, seenUrls);

      if (response.stop_reason === "refusal") return { ok: false, error: "The search request was declined — try different wording." };
      if (response.stop_reason === "pause_turn") {
        messages.push({ role: "assistant", content: response.content });
        continue;
      }

      const report = response.content.find(
        (b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use" && b.name === "report_listings"
      );
      if (report) {
        const parsed = reportSchema.safeParse(report.input);
        if (!parsed.success) return { ok: false, error: "The agent returned results in an unexpected shape — please try again." };
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
          verified.push({ ...l, contact_email: l.contact_email && /\S+@\S+\.\S+/.test(l.contact_email) ? l.contact_email : null });
        }
        return { ok: true, summary: parsed.data.summary, listings: verified, droppedUnverified: dropped, searches };
      }

      // Answered in text instead of reporting — ask for the report.
      messages.push({ role: "assistant", content: response.content });
      messages.push({ role: "user", content: "Please call report_listings now with what you found (an empty list is fine)." });
    }
    return { ok: false, error: "The search took too many steps without finishing — please try again." };
  } catch (error) {
    return { ok: false, error: `Search failed. ${describeClaudeError(error)}` };
  }
}
