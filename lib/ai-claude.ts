// The AI agent on Claude: a manual tool-use loop over the same tools,
// system prompt and tool code as the OpenAI version (lib/agent-tools.ts),
// plus Anthropic's server-side web search restricted to UAE portals.

import type Anthropic from "@anthropic-ai/sdk";
import { runTool, SYSTEM_PROMPT, toolDefs, type AgentAction, type AgentMessage, type ToolContext } from "./agent-tools";
import { CLAUDE_MODEL, describeClaudeError, FALLBACK, getClaude, textOf } from "./claude";
import { hostAllowed, normalizeUrl } from "./market-search";

const PORTALS = ["bayut.com", "propertyfinder.ae", "dubizzle.com"];

// Every URL the web search returned or cited in this turn.
function collectUrls(node: unknown, into: Set<string>) {
  const walk = (v: unknown) => {
    if (Array.isArray(v)) return v.forEach(walk);
    if (!v || typeof v !== "object") return;
    const o = v as Record<string, unknown>;
    if ((o.type === "web_search_result" || o.type === "web_search_result_location") && typeof o.url === "string") {
      const n = normalizeUrl(o.url);
      if (n) into.add(n);
    }
    Object.values(o).forEach(walk);
  };
  walk(node);
}

// Removes portal links the search didn't actually return, so the tenant
// never gets a guessed or reconstructed URL. Other links are left alone.
export function stripUnverifiedPortalLinks(reply: string, seen: Set<string>): string {
  return reply.replace(/https?:\/\/[^\s<>"')\]]+/g, (raw) => {
    const url = raw.replace(/[.,;:!?]+$/, "");
    if (!hostAllowed(url, PORTALS)) return raw;
    const n = normalizeUrl(url);
    return n && seen.has(n) ? raw : "(link removed: it didn't come from a real search result)";
  });
}

function agentTools(): Anthropic.Beta.BetaToolUnion[] {
  return [
    ...toolDefs.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.input_schema as unknown as Anthropic.Beta.BetaTool.InputSchema,
    })),
    { type: "web_search_20260209", name: "web_search", max_uses: 8, allowed_domains: PORTALS },
  ];
}

export async function runAgentTurnClaude(
  history: AgentMessage[],
  ctx: ToolContext
): Promise<{ reply: string; actions: AgentAction[] }> {
  const claude = getClaude();
  if (!claude) return { reply: "The AI agent isn't connected — add ANTHROPIC_API_KEY to the server environment.", actions: [] };

  const actions: AgentAction[] = [];
  const seenUrls = new Set<string>();
  // Links the agent already gave in earlier replies were checked then.
  for (const m of history) {
    if (m.role !== "assistant") continue;
    for (const u of m.content.match(/https?:\/\/[^\s<>"')\]]+/g) ?? []) {
      const n = normalizeUrl(u.replace(/[.,;:!?]+$/, ""));
      if (n) seenUrls.add(n);
    }
  }
  const messages: Anthropic.Beta.BetaMessageParam[] = history.map((m) => ({ role: m.role, content: m.content }));

  try {
    for (let turn = 0; turn < 8; turn++) {
      const response = await claude.beta.messages.create({
        ...FALLBACK,
        model: CLAUDE_MODEL,
        max_tokens: 16000,
        system: SYSTEM_PROMPT,
        tools: agentTools(),
        output_config: { effort: "low" },
        messages,
      });
      collectUrls(response.content, seenUrls);

      if (response.stop_reason === "refusal") {
        return { reply: "I can't help with that request. Could you rephrase it?", actions };
      }
      // A long server-side web search paused; send the turn back to resume.
      if (response.stop_reason === "pause_turn") {
        messages.push({ role: "assistant", content: response.content });
        continue;
      }

      const toolUses = response.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
      if (response.stop_reason !== "tool_use" || toolUses.length === 0) {
        return { reply: stripUnverifiedPortalLinks(textOf(response.content) || "…", seenUrls), actions };
      }

      messages.push({ role: "assistant", content: response.content });
      const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
      for (const tool of toolUses) {
        const input = tool.input && typeof tool.input === "object" ? (tool.input as Record<string, unknown>) : {};
        try {
          const result = await runTool(tool.name, input, ctx, actions);
          results.push({ type: "tool_result", tool_use_id: tool.id, content: JSON.stringify(result) });
        } catch (e) {
          results.push({ type: "tool_result", tool_use_id: tool.id, is_error: true, content: e instanceof Error ? e.message : "Tool failed" });
        }
      }
      // All results for this turn go back in one message.
      messages.push({ role: "user", content: results });
    }
  } catch (error) {
    return { reply: describeClaudeError(error), actions };
  }
  return { reply: "I got a bit stuck working through that — could you rephrase or simplify your request?", actions };
}

export async function draftNegotiationMessageClaude(input: {
  propertyTitle: string;
  location: string;
  askingPrice: number;
  comparableAvg: number;
  tenantName: string;
}): Promise<string | null> {
  const claude = getClaude();
  if (!claude) return null;
  try {
    const response = await claude.beta.messages.create({
      ...FALLBACK,
      model: CLAUDE_MODEL,
      max_tokens: 2000,
      output_config: { effort: "low" },
      system:
        "You draft short, polite, direct messages a tenant can send to a landlord to negotiate rent. No preamble, no sign-off boilerplate beyond a first name — just the message body, 3-5 sentences.",
      messages: [
        {
          role: "user",
          content: `Draft a message from ${input.tenantName} to the landlord of "${input.propertyTitle}" in ${input.location}, asking for a lower rent. The asking price is AED ${input.askingPrice.toLocaleString()}/year. Comparable live listings in the same area and type average AED ${input.comparableAvg.toLocaleString()}/year. Politely reference that comparison and propose a specific, reasonable counter-offer number.`,
        },
      ],
    });
    if (response.stop_reason === "refusal") return null;
    return textOf(response.content) || null;
  } catch {
    return null;
  }
}
