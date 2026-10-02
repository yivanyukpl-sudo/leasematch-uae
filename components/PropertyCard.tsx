import Image from "next/image";
import Link from "next/link";
import type { Property } from "@/lib/db";

// Ported from the HTML prototypes' listing cards: photo with a price tag and
// match badge, then title / location / specs. Listings without uploaded
// photos get the prototypes' gradient placeholder rather than a borrowed
// photo of some other unit.

function gradientFor(id: string) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const hues = [172, 150, 205, 28, 190, 340, 90, 255];
  const h1 = hues[h % hues.length];
  const h2 = hues[(h + 3) % hues.length];
  return `linear-gradient(135deg, hsl(${h1} 38% 78%), hsl(${h2} 30% 62%))`;
}

export function PropertyPhoto({
  property,
  index = 0,
  className = "",
  sizes = "(max-width: 640px) 100vw, 33vw",
  priority = false,
}: {
  property: Pick<Property, "id" | "title" | "photos">;
  index?: number;
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  const src = property.photos[index];
  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={src ? undefined : { background: gradientFor(property.id) }}
    >
      {src && (
        <Image
          src={src}
          alt={`${property.title} — illustration ${index + 1}`}
          fill
          sizes={sizes}
          priority={priority}
          className="object-cover"
        />
      )}
    </div>
  );
}

export function formatBeds(beds: number) {
  return beds === 0 ? "Studio" : `${beds} bed`;
}

export function PropertyCard({
  property: p,
  matchScore,
}: {
  property: Property;
  matchScore?: number;
}) {
  return (
    <Link
      href={`/properties/${p.id}`}
      className="group block overflow-hidden rounded-xl border bg-surface transition hover:-translate-y-0.5 hover:shadow-lg"
      style={{ borderColor: "var(--border)" }}
    >
      <div className="relative">
        <PropertyPhoto property={p} className="h-40" />
        <span className="absolute bottom-2.5 left-2.5 rounded-md bg-black/70 px-2.5 py-1 font-mono text-xs font-semibold text-white">
          AED {p.price.toLocaleString()}/yr
        </span>
        {matchScore !== undefined && (
          <span
            className="absolute right-2.5 top-2.5 rounded-full px-2.5 py-1 font-mono text-[11px] font-semibold text-white"
            style={{ background: "var(--gold)" }}
          >
            {matchScore}% match
          </span>
        )}
      </div>
      <div className="px-4 pb-4 pt-3">
        <h3 className="font-medium leading-snug group-hover:underline">{p.title}</h3>
        <p className="mt-0.5 text-sm text-text-muted">{p.location}</p>
        <p className="mt-2 flex gap-2 text-xs text-text-muted">
          <span>{formatBeds(p.beds)}</span>
          <span>·</span>
          <span>{p.baths} bath</span>
          {p.sqft ? (
            <>
              <span>·</span>
              <span>{p.sqft.toLocaleString()} sqft</span>
            </>
          ) : null}
          <span>·</span>
          <span>{p.property_type}</span>
        </p>
      </div>
    </Link>
  );
}
