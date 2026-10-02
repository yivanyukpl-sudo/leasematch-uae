import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createMarketSearch } from "@/lib/db";
import { marketCriteriaSchema, searchMarketListings } from "@/lib/market-search";

export const runtime = "nodejs";
// A search runs several hosted web searches back to back.
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  if (session.role !== "tenant") {
    return NextResponse.json({ error: "Market search is for tenant accounts" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = marketCriteriaSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid search" },
      { status: 400 }
    );
  }

  const result = await searchMarketListings(parsed.data);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  const search = createMarketSearch({
    tenantId: session.sub,
    criteria: parsed.data,
    summary: result.summary,
    listings: result.listings,
  });

  return NextResponse.json({
    searchId: search.id,
    found: result.listings.length,
    droppedUnverified: result.droppedUnverified,
  });
}
