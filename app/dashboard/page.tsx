import { StayAndWait } from "@/components/StayAndWait";
import { GuideTour } from "@/components/GuideTour";
import { TOURS } from "@/lib/tours";
import { waitingTenantsFor } from "@/lib/alerts";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { PropertyCard, PropertyPhoto } from "@/components/PropertyCard";
import { getSession } from "@/lib/auth";
import {
  countApplicationsByProperty,
  daysSince,
  getProfileById,
  getTenantPreferences,
  listSavedAlerts,
  listLiveProperties,
  listPropertiesByProvider,
  scoreProperty,
} from "@/lib/db";
import { roleLabels } from "@/lib/schemas";
import { publishProperty } from "./actions";

const statusLabel: Record<string, string> = {
  pending_verification: "Pending verification",
  live: "Live",
  vacant: "Vacant",
  under_offer: "Under offer",
  leased: "Leased",
};

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const profile = getProfileById(session.sub);
  if (!profile) redirect("/login");

  const isProvider = profile.role !== "tenant";

  return (
    <div className="flex flex-col flex-1">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <div className="mb-8">
          <p className="text-sm text-text-muted">{roleLabels[profile.role]}</p>
          <h1 className="font-display text-2xl font-semibold">
            Welcome, {profile.full_name.split(" ")[0]}
          </h1>
          {profile.company_name && (
            <p className="text-sm text-text-muted mt-1">{profile.company_name}</p>
          )}
        </div>

        <GuideTour id={isProvider ? "dashboard-owner" : "dashboard-tenant"} steps={TOURS[isProvider ? "dashboard-owner" : "dashboard-tenant"]} />
        {isProvider ? <ProviderDashboard providerId={profile.id} /> : <TenantDashboard tenantId={profile.id} />}
      </main>
    </div>
  );
}

function ProviderDashboard({ providerId }: { providerId: string }) {
  const properties = listPropertiesByProvider(providerId);
  const applicantCounts = countApplicationsByProperty(properties.map((p) => p.id));
  const live = properties.filter((p) => p.status === "live");
  const avgDaysListed = live.length
    ? Math.round(live.reduce((s, p) => s + daysSince(p.created_at), 0) / live.length)
    : 0;
  const pendingApplicants = Object.values(applicantCounts).reduce((a, b) => a + b, 0);
  const needsAttention = live
    .map((p) => ({ p, days: daysSince(p.created_at), applicants: applicantCounts[p.id] ?? 0 }))
    .filter((x) => x.days > 30 || x.applicants > 0)
    .sort((a, b) => b.applicants - a.applicants || b.days - a.days);

  const kpis = [
    { label: "Live listings", value: String(live.length), note: `${properties.length} total` },
    {
      label: "Avg. days on market",
      value: String(avgDaysListed),
      note: live.filter((p) => daysSince(p.created_at) > 60).length + " over 60 days",
    },
    { label: "Applicants to review", value: String(pendingApplicants), note: "pending decisions" },
    {
      label: "Awaiting verification",
      value: String(properties.filter((p) => p.status === "pending_verification").length),
      note: "publish to go live",
    },
  ];

  return (
    <section>
      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl border bg-surface p-4" style={{ borderColor: "var(--border)" }}>
            <p className="text-xs font-medium text-text-muted">{k.label}</p>
            <p className="mt-1.5 font-mono text-2xl font-semibold">{k.value}</p>
            <p className="mt-1 text-xs font-medium" style={{ color: "var(--gold)" }}>
              {k.note}
            </p>
          </div>
        ))}
      </div>

      {needsAttention.length > 0 && (
        <div className="mb-8">
          <h2 className="font-display mb-3 text-lg font-semibold">Needs attention</h2>
          <div className="overflow-x-auto rounded-lg border bg-surface" style={{ borderColor: "var(--border)" }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-text-muted" style={{ background: "var(--bg)" }}>
                  <th className="px-4 py-2.5 font-semibold">Unit</th>
                  <th className="px-4 py-2.5 font-semibold">Location</th>
                  <th className="px-4 py-2.5 font-semibold">Days listed</th>
                  <th className="px-4 py-2.5 font-semibold">Applicants</th>
                  <th className="px-4 py-2.5 font-semibold">Suggested next step</th>
                </tr>
              </thead>
              <tbody>
                {needsAttention.map(({ p, days, applicants }) => (
                  <tr key={p.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                    <td className="px-4 py-3">
                      <Link href={`/properties/${p.id}`} className="font-medium hover:underline">
                        {p.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-text-muted">{p.location}</td>
                    <td className="px-4 py-3 font-mono">{days}</td>
                    <td className="px-4 py-3 font-mono">{applicants}</td>
                    <td className="px-4 py-3">
                      {applicants > 0 ? (
                        <Link href={`/properties/${p.id}/applicants`} className="font-medium" style={{ color: "var(--accent)" }}>
                          Review applicants →
                        </Link>
                      ) : (
                        <span className="text-text-muted">Vacant {days} days — consider adjusting price</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">Your properties</h2>
        <Link data-tour="add-listing"
          href="/dashboard/properties/new"
          className="rounded-md px-4 py-2 text-sm font-medium"
          style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
        >
          + Add property
        </Link>
      </div>

      {properties.length === 0 ? (
        <div
          className="rounded-lg border border-dashed p-10 text-center"
          style={{ borderColor: "var(--border)" }}
        >
          <p className="text-text-muted">You haven&apos;t listed a property yet.</p>
          <Link
            href="/dashboard/properties/new"
            className="mt-3 inline-block font-medium"
            style={{ color: "var(--accent)" }}
          >
            Add your first property →
          </Link>
        </div>
      ) : (
        <ul className="space-y-3" data-tour="owner-listings">
          {properties.map((p) => (
            <li
              key={p.id}
              className="rounded-lg border bg-surface p-4"
              style={{ borderColor: "var(--border)" }}
            >
              <div className="flex items-start justify-between gap-4">
                <PropertyPhoto property={p} className="h-16 w-16 shrink-0 rounded-lg" sizes="64px" />
                <div className="flex-1">
                  <Link href={`/properties/${p.id}`} className="font-medium hover:underline">
                    {p.title}
                  </Link>
                  <p className="text-sm text-text-muted">
                    {p.property_type} · {p.location} · {p.beds} bed / {p.baths} bath
                    {p.sqft ? ` · ${p.sqft} sqft` : ""}
                  </p>
                  <div className="mt-2 flex items-center gap-3 text-sm">
                    <Link
                      href={`/properties/${p.id}/applicants`}
                      className="font-medium"
                      style={{ color: "var(--accent)" }}
                    >
                      View applicants →
                    </Link>
                    {p.status === "pending_verification" && (
                      <form action={publishProperty}>
                        <input type="hidden" name="propertyId" value={p.id} />
                        <button
                          type="submit"
                          className="rounded-md border px-2 py-1 text-xs font-medium"
                          style={{ borderColor: "var(--border)" }}
                        >
                          Publish listing
                        </button>
                      </form>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-medium">AED {p.price.toLocaleString()}/yr</p>
                  <span
                    className="mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium"
                    style={{ background: "var(--gold-soft)", color: "var(--gold)" }}
                  >
                    {statusLabel[p.status] ?? p.status}
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {pendingApplicants === 0 && properties.length > 0 && (
        <div className="mt-6">
          <StayAndWait role="provider" filters={{ location: properties[0]?.location.split(",")[0] }} back="/dashboard" alerts={listSavedAlerts(providerId)} waitingCount={waitingTenantsFor(properties)} />
        </div>
      )}
    </section>
  );
}

function TenantDashboard({ tenantId }: { tenantId: string }) {
  const prefs = getTenantPreferences(tenantId);
  const properties = listLiveProperties()
    .map((p) => ({ property: p, score: scoreProperty(p, prefs) }))
    .sort((a, b) => b.score - a.score);

  return (
    <section>
      <div
        className="mb-6 flex items-center justify-between rounded-lg border p-4"
        style={{ borderColor: "var(--accent)", background: "var(--gold-soft)" }}
      >
        <div>
          <p className="font-medium">Talk to your agent</p>
          <p className="text-sm text-text-muted">
            Describe what you want in plain language — your agent searches, advises, and can
            apply for you.
          </p>
        </div>
        <Link
          href="/dashboard/assistant"
          className="shrink-0 rounded-md px-4 py-2 text-sm font-medium"
          style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
        >
          Open chat
        </Link>
      </div>

      <div
        data-tour="dash-actions"
        className="mb-6 flex items-center justify-between rounded-lg border bg-surface p-4"
        style={{ borderColor: "var(--border)" }}
      >
        <div>
          <p className="font-medium">Search Bayut &amp; Dubizzle</p>
          <p className="text-sm text-text-muted">
            Your agent checks today&apos;s public ads on other portals, then can email the advertiser
            or (in this prototype) simulate a call to them for you.
          </p>
        </div>
        <Link
          href="/dashboard/market"
          className="shrink-0 rounded-md border px-4 py-2 text-sm font-medium"
          style={{ borderColor: "var(--accent)", color: "var(--accent)" }}
        >
          Market search
        </Link>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">Matches for you</h2>
        <Link
          href="/dashboard/preferences"
          className="rounded-md border px-4 py-2 text-sm font-medium"
          style={{ borderColor: "var(--border)" }}
        >
          {prefs ? "Edit preferences" : "Set your preferences"}
        </Link>
      </div>

      {!prefs && (
        <p className="mb-4 text-sm text-text-muted">
          Showing all live listings — set your preferences to see match scores tailored to you.
        </p>
      )}

      {properties.length === 0 ? (
        <StayAndWait role="tenant" filters={{ location: prefs?.locations[0], maxPrice: prefs?.budget ?? undefined }} back="/dashboard" alerts={listSavedAlerts(tenantId)} />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" data-tour="dash-matches">
          {properties.map(({ property: p, score }) => (
            <PropertyCard key={p.id} property={p} matchScore={prefs ? score : undefined} />
          ))}
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-4">
        <Link href="/listings" className="text-sm font-medium" style={{ color: "var(--accent)" }}>
          Browse &amp; filter all listings →
        </Link>
        <Link href="/dashboard/applications" className="text-sm font-medium" style={{ color: "var(--accent)" }}>
          View your applications →
        </Link>
        <Link href="/dashboard/inquiries" className="text-sm font-medium" style={{ color: "var(--accent)" }}>
          External inquiries →
        </Link>
        <Link href="/dashboard/calls" className="text-sm font-medium" style={{ color: "var(--accent)" }}>
          Agent call log →
        </Link>
      </div>
    </section>
  );
}
