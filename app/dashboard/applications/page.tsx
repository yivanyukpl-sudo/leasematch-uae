import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { getSession } from "@/lib/auth";
import { getLeaseByApplication, getPropertyById, listApplicationsByTenant } from "@/lib/db";

const statusStyle: Record<string, { bg: string; fg: string }> = {
  pending: { bg: "var(--gold-soft)", fg: "var(--gold)" },
  approved: { bg: "#e4f2ea", fg: "var(--success)" },
  rejected: { bg: "#f6e6e4", fg: "var(--danger)" },
  withdrawn: { bg: "var(--border)", fg: "var(--text-muted)" },
};

export default async function ApplicationsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "tenant") redirect("/dashboard");

  const applications = listApplicationsByTenant(session.sub);

  return (
    <div className="flex flex-col flex-1">
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
        <h1 className="font-display text-2xl font-semibold mb-6">Your applications</h1>

        {applications.length === 0 ? (
          <div
            className="rounded-lg border border-dashed p-10 text-center"
            style={{ borderColor: "var(--border)" }}
          >
            <p className="text-text-muted">You haven&apos;t applied to any listings yet.</p>
            <Link href="/dashboard" className="mt-3 inline-block font-medium" style={{ color: "var(--accent)" }}>
              Browse matches →
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {applications.map((a) => {
              const property = getPropertyById(a.property_id);
              const style = statusStyle[a.status];
              const lease = a.status === "approved" ? getLeaseByApplication(a.id) : undefined;
              if (!property) return null;
              return (
                <li
                  key={a.id}
                  className="rounded-lg border bg-surface p-4"
                  style={{ borderColor: "var(--border)" }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <Link href={`/properties/${property.id}`} className="font-medium hover:underline">
                        {property.title}
                      </Link>
                      <p className="text-sm text-text-muted">
                        {property.property_type} · {property.location}
                      </p>
                    </div>
                    <span
                      className="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium"
                      style={{ background: style.bg, color: style.fg }}
                    >
                      {a.status}
                    </span>
                  </div>
                  {lease && (
                    <Link
                      href={`/dashboard/leases/${lease.id}`}
                      className="mt-2 inline-block text-sm font-medium"
                      style={{ color: "var(--accent)" }}
                    >
                      Go to lease →
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
