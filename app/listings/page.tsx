import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { PropertyCard } from "@/components/PropertyCard";
import { getSession } from "@/lib/auth";
import { getTenantPreferences, listSavedAlerts, scoreProperty, searchLiveProperties } from "@/lib/db";
import { StayAndWait } from "@/components/StayAndWait";
import { GuideTour } from "@/components/GuideTour";
import { TOURS } from "@/lib/tours";
import { waitingTenantsTotal } from "@/lib/alerts";
import { commonLocations, propertyTypes } from "@/lib/schemas";

const selectClass = "w-full rounded-md border bg-surface px-3 py-2 text-sm";

function one(v: string | string[] | undefined) {
  return (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
}

export default async function ListingsPage({ searchParams }: PageProps<"/listings">) {
  const session = await getSession();
  if (!session) redirect("/login");

  const sp = await searchParams;
  const filters = {
    q: one(sp.q),
    propertyType: one(sp.type),
    location: one(sp.location),
    maxPrice: Number(one(sp.maxPrice)) || undefined,
    minBeds: one(sp.minBeds) !== undefined ? Number(one(sp.minBeds)) : undefined,
    furnished: one(sp.furnished),
  };
  const properties = searchLiveProperties(filters);
  const prefs = session.role === "tenant" ? getTenantPreferences(session.sub) : undefined;
  const isFiltered = Object.values(filters).some((v) => v !== undefined);

  return (
    <div className="flex flex-col flex-1">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide" style={{ color: "var(--gold)" }}>
              Property database
            </p>
            <h1 className="font-display text-2xl font-semibold">Verified LeaseMatch listings</h1>
            <p className="mt-1 text-sm text-text-muted">
              Every listing here was published by an owner, broker or property manager account on
              LeaseMatch. Looking wider?{" "}
              {session.role === "tenant" ? (
                <Link href="/dashboard/market" className="underline">
                  Search Bayut &amp; Dubizzle with your agent
                </Link>
              ) : (
                "Tenants can also search Bayut & Dubizzle with their agent."
              )}
            </p>
          </div>
        </div>

        <GuideTour id="listings" steps={TOURS.listings} />
        <form
          data-tour="listing-filters"
          className="mb-6 grid gap-3 rounded-lg border bg-surface p-4 sm:grid-cols-3 lg:grid-cols-6"
          style={{ borderColor: "var(--border)" }}
        >
          <input
            name="q"
            defaultValue={filters.q}
            placeholder="Search title or area…"
            className={`${selectClass} sm:col-span-3 lg:col-span-2`}
            style={{ borderColor: "var(--border)" }}
          />
          <select name="type" defaultValue={filters.propertyType ?? ""} className={selectClass} style={{ borderColor: "var(--border)" }}>
            <option value="">Any type</option>
            {propertyTypes.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          <select name="location" defaultValue={filters.location ?? ""} className={selectClass} style={{ borderColor: "var(--border)" }}>
            <option value="">Any area</option>
            {commonLocations.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
          <select name="minBeds" defaultValue={one(sp.minBeds) ?? ""} className={selectClass} style={{ borderColor: "var(--border)" }}>
            <option value="">Any beds</option>
            <option value="0">Studio+</option>
            <option value="1">1+ bed</option>
            <option value="2">2+ beds</option>
            <option value="3">3+ beds</option>
            <option value="4">4+ beds</option>
          </select>
          <input
            name="maxPrice"
            type="number"
            min={0}
            step={1000}
            defaultValue={filters.maxPrice}
            placeholder="Max AED/yr"
            className={selectClass}
            style={{ borderColor: "var(--border)" }}
          />
          <div className="flex gap-2 sm:col-span-3 lg:col-span-6">
            <select name="furnished" defaultValue={filters.furnished ?? ""} className={`${selectClass} max-w-48`} style={{ borderColor: "var(--border)" }}>
              <option value="">Furnished or not</option>
              <option value="furnished">Furnished</option>
              <option value="unfurnished">Unfurnished</option>
            </select>
            <button
              type="submit"
              className="rounded-md px-4 py-2 text-sm font-medium"
              style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
            >
              Filter
            </button>
            {isFiltered && (
              <Link href="/listings" className="self-center text-sm text-text-muted underline">
                Clear
              </Link>
            )}
          </div>
        </form>

        <p className="mb-3 text-sm text-text-muted">
          {properties.length} live listing{properties.length === 1 ? "" : "s"}
          {prefs ? " · match scores use your saved preferences" : ""}
        </p>

        {properties.length === 0 ? (
          <StayAndWait
            role={session.role === "tenant" ? "tenant" : "provider"}
            filters={{ location: filters.location ?? filters.q, maxPrice: filters.maxPrice, minBeds: filters.minBeds, type: filters.propertyType }}
            back={`/listings?${new URLSearchParams(Object.entries(sp).filter(([k, v]) => k !== "alert" && typeof v === "string") as [string, string][]).toString()}`}
            alerts={listSavedAlerts(session.sub)}
            justSaved={one(sp.alert) === "saved"}
            waitingCount={session.role === "tenant" ? undefined : waitingTenantsTotal()}
          />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {properties.map((p) => (
              <PropertyCard
                key={p.id}
                property={p}
                matchScore={prefs ? scoreProperty(p, prefs) : undefined}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
