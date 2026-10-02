import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { getSession } from "@/lib/auth";
import { listExternalInquiriesForTenant } from "@/lib/db";

const statusStyle: Record<string, { bg: string; fg: string; label: string }> = {
  draft: { bg: "var(--gold-soft)", fg: "var(--gold)", label: "Draft — not sent" },
  sent: { bg: "#e4f2ea", fg: "var(--success)", label: "Sent" },
  replied: { bg: "var(--accent)", fg: "var(--accent-ink)", label: "Replied" },
  closed: { bg: "var(--border)", fg: "var(--text-muted)", label: "Closed" },
};

export default async function InquiriesPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "tenant") redirect("/dashboard");

  const inquiries = listExternalInquiriesForTenant(session.sub);

  return (
    <div className="flex flex-col flex-1">
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
        <h1 className="font-display text-2xl font-semibold mb-1">External inquiries</h1>
        <p className="text-sm text-text-muted mb-6">
          Messages your agent drafted to listings found outside LeaseMatch (Bayut, Property
          Finder, Dubizzle, etc.). These are unverified third-party listings — LeaseMatch isn&apos;t
          the agent for them, and nothing here is sent until you review and approve it.
        </p>

        {inquiries.length === 0 ? (
          <div
            className="rounded-lg border border-dashed p-10 text-center"
            style={{ borderColor: "var(--border)" }}
          >
            <p className="text-text-muted">No external inquiries yet.</p>
            <Link href="/dashboard/assistant" className="mt-3 inline-block font-medium" style={{ color: "var(--accent)" }}>
              Ask your agent to find listings on the web →
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {inquiries.map((inq) => {
              const style = statusStyle[inq.status];
              return (
                <li
                  key={inq.id}
                  className="rounded-lg border bg-surface p-4"
                  style={{ borderColor: "var(--border)" }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <Link
                        href={`/dashboard/inquiries/${inq.id}`}
                        className="font-medium hover:underline"
                      >
                        {inq.listing_title}
                      </Link>
                      <p className="text-sm text-text-muted">
                        {inq.source_site} · {inq.contact_email}
                      </p>
                    </div>
                    <span
                      className="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium"
                      style={{ background: style.bg, color: style.fg }}
                    >
                      {style.label}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
