import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { AgentCallSimulator } from "@/components/AgentCallSimulator";
import { EmailAdvertiserForm } from "@/components/EmailAdvertiserForm";
import { CallLog } from "@/components/CallLog";
import { getSession } from "@/lib/auth";
import {
  getMarketListing,
  getProfileById,
  getTenantPreferences,
  listAgentCalls,
  listInquiriesForMarketListing,
} from "@/lib/db";
import { isEmailConfigured } from "@/lib/email";

export default async function MarketListingPage({ params }: PageProps<"/dashboard/market/[id]">) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "tenant") redirect("/dashboard");

  const listing = getMarketListing(id);
  if (!listing) notFound();
  if (listing.tenant_id !== session.sub) redirect("/dashboard/market");

  const tenant = getProfileById(session.sub);
  const prefs = getTenantPreferences(session.sub);
  const inquiries = listInquiriesForMarketListing(listing.id, session.sub);
  const calls = listAgentCalls(session.sub, { marketListingId: listing.id });

  const isResultsPage = listing.kind === "results_page";
  const defaultBody = [
    `Hello${listing.advertiser_name ? ` ${listing.advertiser_name} team` : ""},`,
    "",
    isResultsPage
      ? `I came across your ad on ${listing.source_site} and I'm interested in renting it.`
      : `I came across your ad on ${listing.source_site} for "${listing.title}"${listing.price_text ? ` (${listing.price_text})` : ""} and I'm interested in renting it.`,
    "",
    "Could you confirm whether it's still available, the earliest move-in date, and how many cheques you'd accept? I'd also like to arrange a viewing this week if possible.",
    prefs?.notes ? `\nA bit about what I'm looking for: ${prefs.notes}` : null,
    "",
    "Thank you,",
    tenant?.full_name ?? "",
  ]
    .filter((l) => l !== null)
    .join("\n");

  return (
    <div className="flex flex-col flex-1">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
        <Link
          href={`/dashboard/market?search=${listing.search_id}`}
          className="mb-4 inline-block text-sm font-medium"
          style={{ color: "var(--accent)" }}
        >
          ← Back to results
        </Link>

        <div className="mb-6 rounded-xl border bg-surface p-6" style={{ borderColor: "var(--border)" }}>
          <span
            className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
            style={{ background: "var(--gold-soft)", color: "var(--gold)" }}
          >
            Unverified · found on {listing.source_site}
            {isResultsPage ? " · results page" : ""}
          </span>
          <h1 className="font-display mt-2 text-2xl font-semibold">{listing.title}</h1>
          {listing.price_text && <p className="mt-1 font-mono text-lg font-semibold">{listing.price_text}</p>}
          <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-3">
            {[
              ["Location", listing.location],
              ["Bedrooms", listing.beds],
              ["Advertiser", listing.advertiser_name],
              ["Email on ad", listing.contact_email],
              ["Phone on ad", listing.contact_phone],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs text-text-muted">{k}</dt>
                <dd>{v || <span className="text-text-muted">Not shown</span>}</dd>
              </div>
            ))}
          </dl>
          {listing.summary && <p className="mt-3 text-sm text-text-muted">{listing.summary}</p>}
          {isResultsPage && (
            <p className="mt-3 rounded-md p-2.5 text-xs" style={{ background: "var(--bg)" }}>
              This is a {listing.source_site} search-results page listing several ads, not one unit.
              Open it, pick the ad you like, then use the advertiser&apos;s contact from that ad below.
            </p>
          )}
          <a
            href={listing.url}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-block text-sm font-medium underline"
          >
            Open the original ad on {listing.source_site} ↗
          </a>
        </div>

        {inquiries.length > 0 && (
          <div className="mb-6 rounded-md border p-3 text-sm" style={{ borderColor: "var(--border)" }}>
            You&apos;ve already contacted this advertiser:{" "}
            {inquiries.map((inq, i) => (
              <span key={inq.id}>
                {i > 0 && ", "}
                <Link href={`/dashboard/inquiries/${inq.id}`} className="font-medium underline">
                  {inq.status === "draft" ? "draft" : inq.status} to {inq.contact_email}
                </Link>
              </span>
            ))}
          </div>
        )}

        <section id="email" className="mb-8 scroll-mt-6 rounded-xl border bg-surface p-6" style={{ borderColor: "var(--border)" }}>
          <h2 className="font-display mb-1 text-lg font-semibold">Email the advertiser</h2>
          <p className="mb-4 text-sm text-text-muted">
            Sent to the contact published on the public ad. Nothing goes out until you press send.
            {isResultsPage && " Add which ad you mean, and include its details in the message."}
          </p>
          <EmailAdvertiserForm
            listingId={listing.id}
            defaultTo={listing.contact_email ?? ""}
            defaultBody={defaultBody}
            emailConfigured={isEmailConfigured()}
            isResultsPage={isResultsPage}
          />
        </section>

        <section id="call" className="mb-6 scroll-mt-6">
          <AgentCallSimulator
            target={{ marketListingId: listing.id }}
            calleePhone={listing.contact_phone}
            followUpHref="#email"
          />
        </section>

        {calls.length > 0 && <CallLog calls={calls} title="Previous simulated calls about this ad" />}
      </main>
    </div>
  );
}
