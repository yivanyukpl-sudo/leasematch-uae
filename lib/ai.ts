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
import { describeOpenAIError, getOpenAI, isOpenAIConfigured, OPENAI_MODEL } from "./openai";
import { isClaudeConfigured } from "./claude";
import { draftNegotiationMessageClaude, runAgentTurnClaude } from "./ai-claude";
import { runTool, SYSTEM_PROMPT, toolDefs, type AgentAction, type AgentMessage, type ToolContext } from "./agent-tools";

export type { AgentAction, AgentMessage } from "./agent-tools";

// Claude (ANTHROPIC_API_KEY) is used when configured; OpenAI otherwise.
export function isAgentConfigured(): boolean {
  return isClaudeConfigured() || isOpenAIConfigured();
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
const tools: FunctionTool[] = toolDefs.map((t) => ({
  type: "function" as const,
  name: t.name,
  description: t.description,
  parameters: t.input_schema as unknown as Record<string, unknown>,
  strict: false,
}));


export async function runAgentTurn(
  history: AgentMessage[],
  ctx: ToolContext
): Promise<{ reply: string; actions: AgentAction[] }> {
  if (isClaudeConfigured()) return runAgentTurnClaude(history, ctx);
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
  if (isClaudeConfigured()) return draftNegotiationMessageClaude(input);
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
