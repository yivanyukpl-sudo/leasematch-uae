import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { startInspectionAction } from "../actions";
import { getSession } from "@/lib/auth";
import { getLeaseById, getPropertyById } from "@/lib/db";
import { INSPECTION_STEPS } from "@/lib/inspection-steps";

export default async function NewInspectionPage({ searchParams }: PageProps<"/dashboard/inspections/new">) {
  const session = await getSession();
  if (!session) redirect("/login");
  const sp = await searchParams;
  const leaseId = typeof sp.lease === "string" ? sp.lease : "";
  const propertyId = typeof sp.property === "string" ? sp.property : leaseId ? getLeaseById(leaseId)?.property_id ?? "" : "";
  const property = getPropertyById(propertyId);
  if (!property) redirect("/dashboard");

  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
        <p className="text-sm font-medium uppercase tracking-wide" style={{ color: "var(--gold)" }}>AI photo inspection</p>
        <h1 className="font-display mt-1 text-3xl">Let’s inspect the home together</h1>
        <p className="mt-2 text-text-muted">
          {property.title}. The assistant walks you room by room and tells you exactly what to photograph. The AI checks every photo
          and flags damp, cracks and broken appliances, so you know everything before you sign.
        </p>
        <ol className="mt-6 space-y-2">
          {INSPECTION_STEPS.map((s, i) => (
            <li key={s.key} className="flex items-start gap-3 rounded-xl border bg-surface p-3 text-sm">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--field)] text-xs font-extrabold">{i + 1}</span>
              <span><b>{s.icon} {s.title}</b><br /><span className="text-text-muted">{s.shots.join(" · ")}</span></span>
            </li>
          ))}
        </ol>
        <p className="mt-4 rounded-xl bg-[var(--field)] p-3 text-xs text-text-muted">
          Tip: shoot in daylight, hold the phone level, don&apos;t zoom. Only you{leaseId ? " and the other party to the lease" : ""} can see the photos.
        </p>
        <form action={startInspectionAction} className="mt-6 flex flex-wrap gap-3">
          <input type="hidden" name="leaseId" value={leaseId} />
          <input type="hidden" name="propertyId" value={property.id} />
          <button className="rounded-2xl px-6 py-3 text-sm font-bold" style={{ background: "var(--accent)", color: "var(--accent-ink)" }}>Start inspection →</button>
          <Link href={leaseId ? `/dashboard/leases/${leaseId}` : `/properties/${property.id}`} className="rounded-2xl bg-white px-6 py-3 text-sm font-bold shadow-sm">Back</Link>
        </form>
      </main>
    </div>
  );
}
