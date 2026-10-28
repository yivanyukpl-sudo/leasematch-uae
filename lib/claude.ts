// Server-only Anthropic (Claude) client. ANTHROPIC_API_KEY comes from the
// server environment (.env.local locally, the host's env settings when
// deployed) and is never sent to the browser or logged. When it is set,
// every AI feature uses Claude; otherwise the OpenAI code paths run.

import Anthropic from "@anthropic-ai/sdk";

if (typeof window !== "undefined") {
  throw new Error("lib/claude.ts must only be imported on the server");
}

let client: Anthropic | null | undefined;

export function getClaude(): Anthropic | null {
  if (client !== undefined) return client;
  client = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;
  return client;
}

export function isClaudeConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

// Override with CLAUDE_MODEL if needed.
export const CLAUDE_MODEL = process.env.CLAUDE_MODEL || "claude-opus-5-5";

// Server-side refusal fallback: if a request is declined by a safety
// classifier, the API re-runs it on a fallback model chosen by category.
export const FALLBACK = { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const };

// A short, log-safe description of an API failure: status and message only,
// never request headers (which carry the key).
export function describeClaudeError(error: unknown): string {
  if (error instanceof Anthropic.AuthenticationError) return "The Claude API key was rejected — check ANTHROPIC_API_KEY.";
  if (error instanceof Anthropic.PermissionDeniedError) return "This Claude API key doesn't have access to the model — check CLAUDE_MODEL or the key's workspace.";
  if (error instanceof Anthropic.RateLimitError) return "Claude is rate-limiting requests right now — wait a minute and try again.";
  if (error instanceof Anthropic.NotFoundError) return `The model "${CLAUDE_MODEL}" isn't available for this key — set CLAUDE_MODEL.`;
  if (error instanceof Anthropic.APIError) return `Claude API error ${error.status ?? ""}: ${error.message.slice(0, 200)}`;
  return "Couldn't reach the Claude API — check the network and try again.";
}

// Concatenates the text blocks of a response.
export function textOf(content: Anthropic.Beta.BetaContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}
