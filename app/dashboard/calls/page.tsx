import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { CallLog } from "@/components/CallLog";
import { getSession } from "@/lib/auth";
import { listAgentCalls } from "@/lib/db";

export default async function CallsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "tenant") redirect("/dashboard");

  const calls = listAgentCalls(session.sub);

  return (
    <div className="flex flex-col flex-1">
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
        <h1 className="font-display mb-1 text-2xl font-semibold">Agent call log</h1>
        <p className="mb-6 text-sm text-text-muted">
          Simulated phone calls your agent made to advertisers. This prototype doesn&apos;t place real
          calls; each transcript is a scripted simulation built from the ad&apos;s details.
        </p>
        {calls.length === 0 ? (
          <div className="rounded-lg border border-dashed p-10 text-center" style={{ borderColor: "var(--border)" }}>
            <p className="text-text-muted">No calls yet.</p>
            <Link href="/dashboard/market" className="mt-3 inline-block font-medium" style={{ color: "var(--accent)" }}>
              Find an ad on Bayut or Dubizzle to call about →
            </Link>
          </div>
        ) : (
          <CallLog calls={calls} />
        )}
      </main>
    </div>
  );
}
