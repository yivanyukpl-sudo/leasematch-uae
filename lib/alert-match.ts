// Pure matching of saved alerts against listings (unit-tested).
export type AlertLike = { location: string | null; max_price: number | null; min_beds: number | null; property_type: string | null };
export type ListingLike = { location: string; price: number; beds: number; property_type: string };

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N} ]/gu, " ").replace(/\s+/g, " ").trim();

export function alertMatches(a: AlertLike, l: ListingLike): boolean {
  if (a.location && !norm(l.location).includes(norm(a.location)) && !norm(a.location).includes(norm(l.location).split(" ")[0] ?? "")) return false;
  if (a.max_price && l.price > a.max_price) return false;
  if (a.min_beds != null && l.beds < a.min_beds) return false;
  if (a.property_type && a.property_type !== l.property_type) return false;
  return true;
}
