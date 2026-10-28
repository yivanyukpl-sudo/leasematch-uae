// Deal-assistant answers on Claude (same prompt and context as the OpenAI
// path in lib/deal-assistant.ts). Returns null on any failure so the caller
// can fall back to the built-in FAQ.

import { CLAUDE_MODEL, FALLBACK, getClaude, textOf } from "./claude";

export async function askClaudeDealAssistant(system: string, context: string): Promise<string | null> {
  const claude = getClaude();
  if (!claude) return null;
  try {
    const response = await claude.beta.messages.create({
      ...FALLBACK,
      model: CLAUDE_MODEL,
      max_tokens: 2000,
      output_config: { effort: "low" },
      system,
      messages: [{ role: "user", content: context }],
    });
    if (response.stop_reason === "refusal") return null;
    return textOf(response.content) || null;
  } catch (e) {
    console.error("[deal-assistant] Claude failed, using FAQ:", e instanceof Error ? e.message.slice(0, 120) : e);
    return null;
  }
}
