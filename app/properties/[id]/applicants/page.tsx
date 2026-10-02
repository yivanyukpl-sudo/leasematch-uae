import { notFound, redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { getSession } from "@/lib/auth";
import {
  getPropertyById,
  getProfileById,
  listApplicationsByProperty,
  getLeaseByApplication,
} from "@/lib/db";
import { approveApplication, rejectApplication } from "@/app/dashboard/actions";
import Link from "next/link";

const statusStyle: Record<string, { bg: string; fg: string }> = {
  pending: { bg: "var(--gold-soft)", fg: "var(--gold)" },
  approved: { bg: "#e4f2ea", fg: "var(--success)" },
  rejected: { bg: "#f6e6e4", fg: "var(--danger)" },
  withdrawn: { bg: "var(--border)", fg: "var(--text-muted)" },
};

export default async function ApplicantsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect("/login");

  const property = getPropertyById(id);
  if (!property) notFound();
  if (property.provider_id !== session.sub) redirect("/dashboard");

  const applications = listApplicationsByProperty(property.id);

  return (
    <div className="flex flex-col flex-1">
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
        <p className="text-sm text-text-muted">{property.title}</p>
        <h1 className="font-display text-2xl font-semibold mb-6">Applicants</h1>

        {applications.length === 0 ? (
          <div
            className="rounded-lg border border-dashed p-10 text-center"
            style={{ borderColor: "var(--border)" }}
          >
            <p className="text-text-muted">No applications yet.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {applications.map((a) => {
              const tenant = getProfileById(a.tenant_id);
              const style = statusStyle[a.status];
              const lease = a.status === "approved" ? getLeaseByApplication(a.id) : undefined;
              return (
                <li
                  key={a.id}
                  className="rounded-lg border bg-surface p-4"
                  style={{ borderColor: "var(--border)" }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium">{tenant?.full_name ?? "Applicant"}</p>
                      <p className="text-sm text-text-muted">{a.occupation}</p>
                      {a.monthly_income && (
                        <p className="text-sm text-text-muted">
                          AED {a.monthly_income.toLocaleString()}/month income
                        </p>
                      )}
                      {a.move_in && (
                        <p className="text-sm text-text-muted">Move-in: {a.move_in}</p>
                      )}
                      {a.note && <p className="mt-1 text-sm">&ldquo;{a.note}&rdquo;</p>}
                    </div>
                    <span
                      className="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium"
                      style={{ background: style.bg, color: style.fg }}
                    >
                      {a.status}
                    </span>
                  </div>

                  {a.status === "pending" && (
                    <div className="mt-3 flex gap-2">
                      <form action={approveApplication}>
                        <input type="hidden" name="applicationId" value={a.id} />
                        <button
                          type="submit"
                          className="rounded-md px-3 py-1.5 text-xs font-medium"
                          style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
                        >
                          Approve
                        </button>
                      </form>
                      <form action={rejectApplication}>
                        <input type="hidden" name="applicationId" value={a.id} />
                        <button
                          type="submit"
                          className="rounded-md border px-3 py-1.5 text-xs font-medium"
                          style={{ borderColor: "var(--border)" }}
                        >
                          Reject
                        </button>
                      </form>
                    </div>
                  )}

                  {lease && (
                    <Link
                      href={`/dashboard/leases/${lease.id}`}
                      className="mt-3 inline-block text-sm font-medium"
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
