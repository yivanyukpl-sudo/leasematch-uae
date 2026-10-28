import Link from "next/link";
import { redirect } from "next/navigation";
import { PropertyPhoto } from "@/components/PropertyCard";
import { SiteHeader } from "@/components/SiteHeader";
import { GuideTour } from "@/components/GuideTour";
import { TOURS } from "@/lib/tours";
import { getSession } from "@/lib/auth";
import { getProfileById, getPropertyById, listLeasesForUser, listPropertiesByProvider, type Lease } from "@/lib/db";
import { leaseEndDate, type LeaseTerms } from "@/lib/deal";
import { aed } from "@/lib/format";
import { leaseStageLabels } from "@/lib/leases";

const day = (v: string | null) => (v ? v.slice(0, 10) : "—");

// Copy per account category; providers (landlord, agency, leasing office)
// also get a per-property view and upcoming renewals.
const COPY = {
  tenant: { eyebrow: "My tenancies", title: "Lease agreements", other: "Landlord", empty: "No concluded leases yet. When both sides sign and the payment is confirmed, your lease appears here." },
  owner: { eyebrow: "My properties", title: "Lease agreements", other: "Tenant", empty: "No concluded leases yet. Approve an applicant; once both sides sign and the payment is confirmed, the lease appears here." },
  broker: { eyebrow: "Deals you brokered", title: "Lease agreements", other: "Tenant", empty: "No concluded deals yet. Leases on the listings you manage appear here once signed and paid (commission is paid by the landlord)." },
  pm: { eyebrow: "Portfolio", title: "Lease agreements across your units", other: "Tenant", empty: "No concluded leases yet. Leases on your units appear here once signed and paid." },
} as const;

function daysUntil(date: string): number {
  return Math.round((Date.parse(`${date}T00:00:00Z`) - Date.now()) / 86_400_000);
}

export default async function LeasesPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const isTenant = session.role === "tenant";
  const copy = COPY[session.role];
  const leases = listLeasesForUser(session.sub, session.role);
  const concluded = leases.filter((l) => l.stage === "finalized");
  const inProgress = leases.filter((l) => l.stage !== "finalized");
  const annualRent = concluded.reduce((sum, l) => sum + (getPropertyById(l.property_id)?.price ?? 0), 0);
  const endOf = (l: Lease) => (l.terms ? leaseEndDate(JSON.parse(l.terms) as LeaseTerms) : null);
  const renewalsDue = concluded.filter((l) => {
    const end = endOf(l);
    return end !== null && daysUntil(end) <= 90;
  }).length;
  const properties = isTenant ? [] : listPropertiesByProvider(session.sub);

  return (
    <div className="flex flex-col flex-1">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <p className="text-sm font-medium uppercase tracking-wide" style={{ color: "var(--gold)" }}>
          {copy.eyebrow}
        </p>
        <h1 className="font-display text-2xl font-semibold">{copy.title}</h1>
        <p className="mt-1 text-sm text-text-muted">
          Concluded agreements are signed by both sides and paid. Open one to see the full signed contract, payment and key handover.
        </p>

        <GuideTour id={isTenant ? "leases-tenant" : "leases-provider"} steps={TOURS[isTenant ? "leases-tenant" : "leases-provider"]} />
        <div className="mt-6 grid gap-3 sm:grid-cols-3" data-tour="leases-summary">
          <Stat label="In force" value={String(concluded.length)} note="signed and paid" />
          <Stat label="In progress" value={String(inProgress.length)} note="terms, signing or payment" />
          {isTenant ? (
            <Stat label="Annual rent (in force)" value={concluded.length ? aed(annualRent) : "—"} note="sum of active leases" />
          ) : (
            <Stat label="Renewals due" value={String(renewalsDue)} note={`within 90 days · ${concluded.length ? aed(annualRent) : "AED 0"}/yr under contract`} />
          )}
        </div>

        {!isTenant && properties.length > 0 && (
          <section className="mt-8" data-tour="leases-by-property">
            <h2 className="mb-3 font-display text-lg font-semibold">By property</h2>
            <div className="overflow-x-auto rounded-lg border bg-surface" style={{ borderColor: "var(--border)" }}>
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-text-muted">
                  <tr>
                    <th className="p-3">Property</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Tenant</th>
                    <th className="p-3">Lease ends</th>
                    <th className="p-3 text-right">Rent / yr</th>
                  </tr>
                </thead>
                <tbody>
                  {properties.map((p) => {
                    const active = concluded.find((l) => l.property_id === p.id);
                    const pending = inProgress.find((l) => l.property_id === p.id);
                    const end = active ? endOf(active) : null;
                    return (
                      <tr key={p.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                        <td className="p-3">
                          <Link href={active || pending ? `/dashboard/leases/${(active ?? pending)!.id}` : `/properties/${p.id}`} className="font-medium hover:underline">
                            {p.title}
                          </Link>
                          <div className="text-xs text-text-muted">{p.location}</div>
                        </td>
                        <td className="p-3">{active ? "Leased" : pending ? leaseStageLabels[pending.stage] : p.status === "live" ? "Vacant · listed" : p.status.replace(/_/g, " ")}</td>
                        <td className="p-3">{active || pending ? getProfileById((active ?? pending)!.tenant_id)?.full_name : "—"}</td>
                        <td className="p-3" style={{ fontVariantNumeric: "tabular-nums" }}>
                          {end ?? "—"}
                          {end && daysUntil(end) <= 90 ? <span className="ml-1 text-xs" style={{ color: "var(--gold)" }}>renewal due</span> : null}
                        </td>
                        <td className="p-3 text-right" style={{ fontVariantNumeric: "tabular-nums" }}>{aed(p.price)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <Section title="Concluded agreements" empty={copy.empty} tour="leases-concluded">
          {concluded.map((l) => <LeaseRow key={l.id} lease={l} isTenant={isTenant} otherLabel={copy.other} />)}
        </Section>

        <Section title="In progress" empty="Nothing in progress." tour="leases-in-progress">
          {inProgress.map((l) => <LeaseRow key={l.id} lease={l} isTenant={isTenant} otherLabel={copy.other} />)}
        </Section>
      </main>
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-lg border bg-surface p-4" style={{ borderColor: "var(--border)" }}>
      <p className="text-xs text-text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold" style={{ fontVariantNumeric: "tabular-nums" }}>{value}</p>
      <p className="text-xs text-text-muted">{note}</p>
    </div>
  );
}

function Section({ title, empty, tour, children }: { title: string; empty: string; tour: string; children: React.ReactNode[] }) {
  return (
    <section className="mt-8" data-tour={tour}>
      <h2 className="mb-3 font-display text-lg font-semibold">{title}</h2>
      {children.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-sm text-text-muted" style={{ borderColor: "var(--border)" }}>{empty}</p>
      ) : (
        <ul className="space-y-3">{children}</ul>
      )}
    </section>
  );
}

function LeaseRow({ lease, isTenant, otherLabel }: { lease: Lease; isTenant: boolean; otherLabel: string }) {
  const property = getPropertyById(lease.property_id);
  const other = getProfileById(isTenant ? lease.provider_id : lease.tenant_id);
  const terms: LeaseTerms | null = lease.terms ? JSON.parse(lease.terms) : null;
  const done = lease.stage === "finalized";
  return (
    <li>
      <Link href={`/dashboard/leases/${lease.id}`} className="flex flex-wrap items-center gap-4 rounded-lg border bg-surface p-4 hover:shadow-sm" style={{ borderColor: "var(--border)" }}>
        {property && <PropertyPhoto property={property} className="h-16 w-16 shrink-0 rounded-md" sizes="64px" />}
        <div className="min-w-0 flex-1">
          <p className="font-medium">{property?.title ?? "Property removed"}</p>
          <p className="text-sm text-text-muted">
            {property?.location} · {otherLabel}: {other?.company_name ?? other?.full_name ?? "—"}
          </p>
          <p className="mt-1 text-xs text-text-muted">
            {terms ? `${terms.startDate} → ${leaseEndDate(terms)} · ${terms.cheques} cheque${terms.cheques === 1 ? "" : "s"}` : "Terms not agreed yet"}
            {lease.tenant_signed_at && lease.landlord_signed_at ? ` · signed ${day(lease.tenant_signed_at > lease.landlord_signed_at ? lease.tenant_signed_at : lease.landlord_signed_at)}` : ""}
            {lease.payment_reference ? ` · payment ref ${lease.payment_reference}` : ""}
          </p>
        </div>
        <div className="text-right">
          {property && <p className="font-medium" style={{ fontVariantNumeric: "tabular-nums" }}>{aed(property.price)}/yr</p>}
          <span
            className="mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium"
            style={done ? { background: "var(--success-soft)", color: "var(--success)" } : { background: "var(--gold-soft)", color: "var(--gold)" }}
          >
            {done ? `In force · since ${day(lease.confirmed_at)}` : leaseStageLabels[lease.stage]}
          </span>
        </div>
      </Link>
    </li>
  );
}
