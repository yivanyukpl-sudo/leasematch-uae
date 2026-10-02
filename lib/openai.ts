// Server-only OpenAI client. The key is read from OPENAI_API_KEY in the
// server environment (.env.local locally, the host's env settings when
// deployed) and is never sent to the browser or logged. Only import this
// from server code (route handlers, server actions, server components).

import OpenAI from "openai";

if (typeof window !== "undefined") {
  throw new Error("lib/openai.ts must only be imported on the server");
}

let client: OpenAI | null | undefined;

export function getOpenAI(): OpenAI | null {
  if (client !== undefined) return client;
  const key = process.env.OPENAI_API_KEY;
  client = key ? new OpenAI({ apiKey: key }) : null;
  return client;
}

export function isOpenAIConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

// Override with OPENAI_MODEL if your account has a different model.
export const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5.5";

// A short, log-safe description of an API failure: status and message only,
// never request headers (which carry the key).
export function describeOpenAIError(error: unknown): string {
  if (error instanceof OpenAI.AuthenticationError) return "The OpenAI API key was rejected — check OPENAI_API_KEY.";
  if (error instanceof OpenAI.RateLimitError && error.code === "insufficient_quota")
    return "The OpenAI account has no credits left — add credits in the OpenAI billing settings.";
  if (error instanceof OpenAI.RateLimitError) return "OpenAI is rate-limiting this key right now — wait a minute and try again.";
  if (error instanceof OpenAI.NotFoundError) return `Model "${OPENAI_MODEL}" isn't available to this key — set OPENAI_MODEL.`;
  if (error instanceof OpenAI.APIError) return `OpenAI error ${error.status ?? ""}: ${error.message.slice(0, 200)}`;
  return "Couldn't reach OpenAI — check the network and try again.";
}
