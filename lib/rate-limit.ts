// Simple fixed-window rate limiter kept in process memory.
//
// Fine for the launch setup (one server instance on Render). If the app is
// ever scaled to several instances, move this to Redis or the database so
// limits are shared.

type Bucket = { count: number; resetAt: number };

declare global {
  var __leasematchRateBuckets: Map<string, Bucket> | undefined;
}

const buckets = globalThis.__leasematchRateBuckets ?? new Map<string, Bucket>();
globalThis.__leasematchRateBuckets = buckets;

export function rateLimit(key: string, limit: number, windowSeconds: number): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    if (buckets.size > 10_000) {
      for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
    }
    return { ok: true, retryAfter: 0 };
  }
  b.count++;
  if (b.count > limit) return { ok: false, retryAfter: Math.ceil((b.resetAt - now) / 1000) };
  return { ok: true, retryAfter: 0 };
}

// Best-effort client IP behind Render's proxy.
export function clientIp(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "unknown";
}
