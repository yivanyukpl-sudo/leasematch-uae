import { headers } from "next/headers";

// Absolute URL for links in emails and payment callbacks. Set APP_URL in
// production (e.g. https://leasematch.com.ua) so links never depend on a
// client-supplied Host header.
export async function appUrl(path: string): Promise<string> {
  const base = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (base) return base.replace(/\/$/, "") + path;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}${path}`;
}
