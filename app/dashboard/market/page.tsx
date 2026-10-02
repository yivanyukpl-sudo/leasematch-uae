import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { MarketSearchForm } from "@/components/MarketSearchForm";
import { getSession } from "@/lib/auth";
import { isAgentConfigured } from "@/lib/ai";
import {
  getMarketSearch,
  getTenantPreferences,
  listMarketListings,
  listMarketSearches,
} from "@/lib/db";
import type { MarketCriteria } from "@/lib/market-search";
import { commonLocations, propertyTypes } from "@/lib/schemas";

function describe(c: MarketCriteria) {
  return [
    c.beds !== "Any" ? (c.beds === "Studio" ? "Studio" : `${c.beds} bed`) : null,
    c.propertyType,
    `in ${c.area}`,
    c.maxBudget ? `≤ AED ${c.maxBudget.toLocaleString()}` : null,
  ]
    .filter(Boolean)
    .join(" ");
}

export default async function MarketPage({ searchParams }: PageProps<"/dashboard/market">) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "tenant") redirect("/dashboard");

  const sp = await searchParams;
  const history = listMarketSearches(session.sub);
  const requested = typeof sp.search === "string" ? getMarketSearch(sp.search) : undefined;
  const current =
    requested && requested.tenant_id === session.sub ? requested : sp.search ? undefined : history[0];
  const listings = current ? listMarketListings(current.id) : [];
  const ads = listings.filter((l) => l.kind === "listing");
  const pages = listings.filter((l) => l.kind === "results_page");
  const prefs = getTenantPreferences(session.sub);

  return (
    <div className="flex flex-col flex-1">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <p className="text-sm font-medium uppercase tracking-wide" style={{ color: "var(--gold)" }}>
          Market search
        </p>
        <h1 className="font-display text-2xl font-semibold">Live ads on Bayut &amp; Dubizzle</h1>
        <p className="mt-1 mb-6 max-w-3xl text-sm text-text-muted">
          Your agent runs real searches through OpenAI&apos;s hosted web search, limited to
          bayut.com and dubizzle.com. LeaseMatch never scrapes either site, and any link that
          didn&apos;t come back from an actual search result is thrown away. These ads are{" "}
          <strong>unverified third-party listings</strong>. LeaseMatch isn&apos;t the agent for
          them, so confirm details with the advertiser.
        </p>

        <MarketSearchForm
          agentConfigured={isAgentConfigured()}
          locations={commonLocations}
          propertyTypes={propertyTypes}
          defaults={{
            area: prefs?.locations[0] ?? "Al Reem Island",
            propertyType: prefs?.property_types[0] ?? "Apartment",
            maxBudget: prefs?.budget ? String(prefs.budget) : "",
            furnished: prefs?.furnished ?? "any",
          }}
        />

        {current && (
          <section className="mt-8">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-display text-lg font-semibold">
                {describe(JSON.parse(current.criteria))}
              </h2>
              <span className="text-xs text-text-muted">Searched {current.created_at} UTC</span>
            </div>
            {current.summary && (
              <p className="mb-4 rounded-md border bg-surface p-3 text-sm" style={{ borderColor: "var(--border)" }}>
                <span className="font-medium">Agent: </span>
                {current.summary}
              </p>
            )}

            {ads.length === 0 && pages.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center text-sm text-text-muted" style={{ borderColor: "var(--border)" }}>
                No verifiable ads came back for this search. Try a broader area or budget.
              </div>
            ) : (
              <>
                <ul className="grid gap-3 md:grid-cols-2">
                  {ads.map((l) => (
                    <li key={l.id} className="flex flex-col rounded-lg border bg-surface p-4" style={{ borderColor: "var(--border)" }}>
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span
                          className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                          style={{ background: "var(--gold-soft)", color: "var(--gold)" }}
                        >
                          Unverified · {l.source_site}
                        </span>
                        {l.price_text && <span className="font-mono text-sm font-semibold">{l.price_text}</span>}
                      </div>
                      <Link href={`/dashboard/market/${l.id}`} className="font-medium hover:underline">
                        {l.title}
                      </Link>
                      <p className="text-sm text-text-muted">
                        {[l.location, l.beds, l.advertiser_name].filter(Boolean).join(" · ")}
                      </p>
                      {l.summary && <p className="mt-1.5 text-sm">{l.summary}</p>}
                      <div className="mt-auto flex flex-wrap gap-3 pt-3 text-sm">
                        <Link href={`/dashboard/market/${l.id}#email`} className="font-medium" style={{ color: "var(--accent)" }}>
                          ✉️ Email advertiser
                        </Link>
                        <Link href={`/dashboard/market/${l.id}#call`} className="font-medium" style={{ color: "var(--accent)" }}>
                          📞 Agent call (simulated)
                        </Link>
                        <a href={l.url} target="_blank" rel="noreferrer" className="text-text-muted underline">
                          Open ad ↗
                        </a>
                      </div>
                    </li>
                  ))}
                </ul>
                {pages.length > 0 && (
                  <div className="mt-5">
                    <h3 className="mb-1 text-sm font-semibold">Results pages worth browsing</h3>
                    <p className="mb-2 text-xs text-text-muted">
                      Search-results pages that list several matching ads. Open one, pick an ad, and
                      the agent can still email or (simulated) call its advertiser for you.
                    </p>
                    <ul className="space-y-2">
                      {pages.map((l) => (
                        <li key={l.id} className="rounded-lg border bg-surface p-3 text-sm" style={{ borderColor: "var(--border)" }}>
                          <div className="flex flex-wrap items-baseline gap-2">
                            <span className="text-xs font-semibold" style={{ color: "var(--gold)" }}>
                              {l.source_site}
                            </span>
                            <a href={l.url} target="_blank" rel="noreferrer" className="font-medium underline">
                              {l.title} ↗
                            </a>
                          </div>
                          {l.summary && <p className="mt-1 text-text-muted">{l.summary}</p>}
                          <div className="mt-2 flex flex-wrap gap-3 text-xs">
                            <Link href={`/dashboard/market/${l.id}#email`} className="font-medium" style={{ color: "var(--accent)" }}>
                              ✉️ Email an advertiser from this page
                            </Link>
                            <Link href={`/dashboard/market/${l.id}#call`} className="font-medium" style={{ color: "var(--accent)" }}>
                              📞 Agent call (simulated)
                            </Link>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <p className="mt-4 text-xs text-text-muted">
                  Third-party ads can be taken down or rented at any time, so a link may lead to an
                  expired page. When a verified LeaseMatch listing is close to what you want, it&apos;s
                  the safer choice:{" "}
                  <Link href="/listings" className="underline">
                    browse verified listings
                  </Link>
                  .
                </p>
              </>
            )}
          </section>
        )}

        {history.length > 1 && (
          <section className="mt-8">
            <h3 className="mb-2 text-sm font-semibold">Recent searches</h3>
            <ul className="flex flex-wrap gap-2">
              {history.map((h) => (
                <li key={h.id}>
                  <Link
                    href={`/dashboard/market?search=${h.id}`}
                    className="inline-block rounded-full border px-3 py-1 text-xs"
                    style={{
                      borderColor: h.id === current?.id ? "var(--accent)" : "var(--border)",
                      fontWeight: h.id === current?.id ? 600 : 400,
                    }}
                  >
                    {describe(JSON.parse(h.criteria))}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
