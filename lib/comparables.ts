// Simple, honest market-comparison logic — no external data feed, just
// stats over the listings already in this database. It's what powers both
// the sign-time "this looks pricey" nudge and the search agent's "that's
// not realistic for this market" replies. As the listing base grows this
// can be swapped for a real market-data source without changing callers.

import { listLiveProperties, type Property } from "./db";

export type ComparableStats = {
  count: number;
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
};

export function comparablesFor(
  property: Pick<Property, "id" | "property_type" | "location">
): ComparableStats {
  const pool = listLiveProperties().filter(
    (p) =>
      p.id !== property.id &&
      p.property_type === property.property_type &&
      p.location === property.location
  );
  if (pool.length === 0) {
    return { count: 0, avgPrice: 0, minPrice: 0, maxPrice: 0 };
  }
  const prices = pool.map((p) => p.price);
  return {
    count: pool.length,
    avgPrice: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
    minPrice: Math.min(...prices),
    maxPrice: Math.max(...prices),
  };
}

// How far above comparable average a listing has to be before the sign-time
// agent note kicks in.
const OVERPRICED_THRESHOLD = 1.12;

export function isPricedAboveMarket(price: number, stats: ComparableStats): boolean {
  return stats.count >= 1 && price > stats.avgPrice * OVERPRICED_THRESHOLD;
}
