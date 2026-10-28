import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { ApplyForm } from "@/components/ApplyForm";
import { PropertyPhoto } from "@/components/PropertyCard";
import { getSession } from "@/lib/auth";
import { comparablesFor } from "@/lib/comparables";
import {
  daysSince,
  getApplicationForTenant,
  getLeaseByApplication,
  getProfileById,
  getPropertyById,
} from "@/lib/db";

const statusLabel: Record<string, string> = {
  pending: "Application pending review",
  approved: "Application approved",
  rejected: "Application not accepted",
  withdrawn: "Application withdrawn",
};

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect("/login");

  const property = getPropertyById(id);
  if (!property) notFound();

  const provider = getProfileById(property.provider_id);
  const isTenant = session.role === "tenant";
  const isOwner = property.provider_id === session.sub;

  const application = isTenant ? getApplicationForTenant(property.id, session.sub) : undefined;
  const lease = application ? getLeaseByApplication(application.id) : undefined;
  const comps = comparablesFor(property);
  const diffPct = comps.count ? Math.round(((property.price - comps.avgPrice) / comps.avgPrice) * 100) : 0;

  return (
    <div className="flex flex-col flex-1">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
        <Link href="/listings" className="mb-4 inline-block text-sm font-medium" style={{ color: "var(--accent)" }}>
          ← All listings
        </Link>
        {property.photos.length > 0 ? (
          <div className="mb-6 grid gap-2 sm:grid-cols-3">
            <PropertyPhoto
              property={property}
              className="h-64 rounded-xl sm:col-span-2"
              sizes="(max-width: 640px) 100vw, 512px"
              priority
            />
            <div className="grid gap-2">
              {property.photos.slice(1, 3).map((_, i) => (
                <PropertyPhoto
                  key={i}
                  property={property}
                  index={i + 1}
                  className="h-31 rounded-xl sm:h-full"
                  sizes="(max-width: 640px) 100vw, 256px"
                />
              ))}
            </div>
          </div>
        ) : (
          <PropertyPhoto property={property} className="mb-6 h-48 rounded-xl" />
        )}
        <div
          className="mb-6 rounded-lg border bg-surface p-6"
          style={{ borderColor: "var(--border)" }}
        >
          <p className="text-sm text-text-muted">
            {property.property_type} · {property.location}
          </p>
          <h1 className="font-display text-2xl font-semibold mt-1">{property.title}</h1>
          <p className="mt-2 text-xl font-medium">AED {property.price.toLocaleString()}/yr</p>
          <p className="mt-1 text-sm text-text-muted">
            {property.beds} bed · {property.baths} bath
            {property.sqft ? ` · ${property.sqft} sqft` : ""} ·{" "}
            {property.furnished === "furnished" ? "Furnished" : "Unfurnished"}
            {property.status === "live" ? ` · Listed ${daysSince(property.created_at)} days ago` : ""}
          </p>

          {comps.count > 0 && (
            <p
              className="mt-3 inline-block rounded-md px-2.5 py-1 text-xs font-medium"
              style={{
                background: diffPct > 12 ? "#f8e4e2" : "var(--gold-soft)",
                color: diffPct > 12 ? "var(--danger)" : "var(--gold)",
              }}
            >
              {diffPct === 0
                ? "Priced in line with"
                : `${Math.abs(diffPct)}% ${diffPct > 0 ? "above" : "below"}`}{" "}
              the average of {comps.count} comparable live listing{comps.count === 1 ? "" : "s"} (AED{" "}
              {comps.avgPrice.toLocaleString()}/yr)
            </p>
          )}

          {property.amenities.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {property.amenities.map((a) => (
                <span
                  key={a}
                  className="rounded-full px-2.5 py-1 text-xs font-medium"
                  style={{ background: "var(--gold-soft)", color: "var(--gold)" }}
                >
                  {a}
                </span>
              ))}
            </div>
          )}

          {property.description && (
            <p className="mt-4 text-sm text-text-muted whitespace-pre-line">
              {property.description}
            </p>
          )}

          {provider && (
            <p className="mt-4 text-sm text-text-muted">
              Listed by {provider.full_name}
              {provider.company_name ? ` · ${provider.company_name}` : ""}
            </p>
          )}

          {isOwner && (
            <Link
              href={`/properties/${property.id}/applicants`}
              className="mt-4 inline-block text-sm font-medium"
              style={{ color: "var(--accent)" }}
            >
              View applicants →
            </Link>
          )}
        </div>

        {isTenant && !isOwner && (
          <>
            {!application && <ApplyForm propertyId={property.id} />}
            {application && (
              <div
                className="rounded-lg border p-4 text-sm"
                style={{ borderColor: "var(--border)", background: "var(--gold-soft)" }}
              >
                <p className="font-medium">{statusLabel[application.status]}</p>
                {lease && (
                  <Link
                    href={`/dashboard/leases/${lease.id}`}
                    className="mt-2 inline-block font-medium"
                    style={{ color: "var(--accent)" }}
                  >
                    Go to your lease →
                  </Link>
                )}
              </div>
            )}
          </>
        )}
        {(isTenant || isOwner) && (
          <Link
            href={`/dashboard/inspections/new?property=${property.id}`}
            data-tour="property-inspection"
            className="mt-4 flex items-center gap-3 rounded-lg border bg-surface p-4 text-sm"
            style={{ borderColor: "var(--border)" }}
          >
            <span className="text-2xl" aria-hidden>📸</span>
            <span>
              <b>{isOwner ? "Check the home with an AI photo inspection" : "Going to a viewing? Run the AI photo inspection"}</b>
              <span className="block text-xs text-text-muted">
                {isOwner ? "The AI suggests what to fix so the listing looks honest and appealing." : "The assistant walks you room by room; the AI flags damp, cracks or broken appliances."}
              </span>
            </span>
          </Link>
        )}
      </main>
    </div>
  );
}
