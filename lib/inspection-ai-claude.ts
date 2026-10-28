// Inspection photo analysis on Claude vision, constrained to the same JSON
// shape as the OpenAI path. Returns null on any failure so the caller can
// fall back (OpenAI, then the labelled demo analysis).

import type Anthropic from "@anthropic-ai/sdk";
import { CLAUDE_MODEL, FALLBACK, getClaude, textOf } from "./claude";
import { photoAnalysisSchema } from "./inspection-ai";
import type { InspectionStep, PhotoAnalysis } from "./inspection-steps";

const MEDIA = ["image/jpeg", "image/png", "image/webp"] as const;
type Media = (typeof MEDIA)[number];

export async function analyzePhotoClaude(buf: Buffer, mime: string, step: InspectionStep, system: string): Promise<PhotoAnalysis | null> {
  const claude = getClaude();
  if (!claude || !MEDIA.includes(mime as Media)) return null;
  try {
    const content: Anthropic.Beta.BetaContentBlockParam[] = [
      { type: "image", source: { type: "base64", media_type: mime as Media, data: buf.toString("base64") } },
      { type: "text", text: `Inspection step: ${step.title}. Check: ${step.checks}.` },
    ];
    const response = await claude.beta.messages.create({
      ...FALLBACK,
      model: CLAUDE_MODEL,
      max_tokens: 4000,
      output_config: { effort: "low", format: { type: "json_schema", schema: photoAnalysisSchema } },
      system,
      messages: [{ role: "user", content }],
    });
    if (response.stop_reason !== "end_turn") return null;
    return JSON.parse(textOf(response.content)) as PhotoAnalysis;
  } catch (e) {
    console.error("[inspection-ai] Claude vision failed:", e instanceof Error ? e.message.slice(0, 120) : e);
    return null;
  }
}
