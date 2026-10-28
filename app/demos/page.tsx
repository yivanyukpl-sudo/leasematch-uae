import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

// Hub for the click-through HTML prototypes the app grew out of, plus the
// agent simulations. These are static files in public/ — sample data only,
// nothing in them touches the real database.

const simulations = [
  {
    href: "/simulations/roles/tenant.html",
    title: "Step-by-step simulation: tenant",
    body: "Tap the highlighted buttons through the tenant journey: preferences, matches, “notify me”, the AI agent, package, AI photo inspection, signing and keys.",
    tag: "Tenant",
  },
  {
    href: "/simulations/roles/owner.html",
    title: "Step-by-step simulation: landlord",
    body: "Listing, AI photo tips, waiting tenants, an application, contract terms, signing and confirming payment.",
    tag: "Landlord",
  },
  {
    href: "/simulations/roles/agent.html",
    title: "Step-by-step simulation: agent",
    body: "How an agent works transparently: the landlord pays the commission, tenants see it on the card, and the deal runs through the assistant.",
    tag: "Agent",
  },
  {
    href: "/simulations/agent-outreach.html",
    title: "Agent outreach simulation",
    body: "Watch the AI agent search Bayut and Dubizzle, contact landlords through the portals and by email, phone one of them, then move the conversation into a LeaseMatch chat and negotiate, checking with the tenant at each step.",
    tag: "New",
  },
];

const prototypes = [
  {
    href: "/demos/prototype-final.html",
    title: "Full prototype (final)",
    body: "The complete click-through: onboarding, the two-step tenant profile, AI-ranked matches, applications, lease signing and payment, plus the provider portfolio, leases, tenant search and documents.",
  },
  {
    href: "/demos/lease-flow-tenant.html",
    title: "Lease flow, tenant side",
    body: "Stage-by-stage lease execution as the tenant sees it, with the amendment chat. Open it next to the landlord view when presenting.",
  },
  {
    href: "/demos/lease-flow-landlord.html",
    title: "Lease flow, landlord side",
    body: "The same deal from the provider's side: draft, finalize, confirm payment.",
  },
  {
    href: "/demos/prototype-v2.html",
    title: "Prototype v2",
    body: "Second iteration: the auth flow, role selection and the expanded tenant questionnaire.",
  },
  {
    href: "/demos/prototype-v1.html",
    title: "Prototype v1",
    body: "The first matching demo: search, listings, applications and the provider overview.",
  },
];

const inApp = [
  { href: "/listings", title: "Property database", body: "10 sample verified listings with photos, filters and match scores." },
  { href: "/dashboard/market", title: "Market search", body: "Live Bayut & Dubizzle search by the agent, then email or a simulated call (tenant account)." },
  { href: "/dashboard/assistant", title: "Agent chat", body: "Conversational agent that searches, advises on price and applies (tenant account)." },
];

function Card({ href, title, body, tag, external }: { href: string; title: string; body: string; tag?: string; external?: boolean }) {
  const inner = (
    <>
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-medium">{title}</h3>
        {tag && (
          <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: "var(--gold-soft)", color: "var(--gold)" }}>
            {tag}
          </span>
        )}
      </div>
      <p className="mt-1.5 text-sm text-text-muted">{body}</p>
      <p className="mt-3 text-sm font-medium" style={{ color: "var(--accent)" }}>
        Open {external ? "↗" : "→"}
      </p>
    </>
  );
  const cls = "block rounded-xl border bg-surface p-5 transition hover:-translate-y-0.5 hover:shadow-md";
  return external ? (
    <a href={href} target="_blank" rel="noreferrer" className={cls} style={{ borderColor: "var(--border)" }}>
      {inner}
    </a>
  ) : (
    <Link href={href} className={cls} style={{ borderColor: "var(--border)" }}>
      {inner}
    </Link>
  );
}

export default function DemosPage() {
  return (
    <div className="flex flex-col flex-1">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <p className="text-sm font-medium uppercase tracking-wide" style={{ color: "var(--gold)" }}>
          Demos &amp; simulations
        </p>
        <h1 className="font-display text-2xl font-semibold">See LeaseMatch end to end</h1>
          <a
            href="https://github.com/yivanyukpl-sudo/leasematch-uae/blob/main/docs/PROTOTYPE-GUIDE.md"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-block rounded-md border px-3 py-2 text-sm font-medium"
            style={{ borderColor: "var(--border)", color: "var(--accent)" }}
          >
            Read the prototype guide: logins, a 3-minute tour, limitations ↗
          </a>
        <p className="mt-1 mb-8 max-w-2xl text-sm text-text-muted">
          The HTML prototypes the app was built from, and simulations of agent features that
          aren&apos;t live yet. All of them use sample data only.
        </p>

        <h2 className="font-display mb-3 text-lg font-semibold">Agent simulations</h2>
        <div className="mb-10 grid gap-4 sm:grid-cols-2">
          {simulations.map((s) => (
            <Card key={s.href} {...s} external />
          ))}
        </div>

        <h2 className="font-display mb-3 text-lg font-semibold">In the live app</h2>
        <div className="mb-10 grid gap-4 sm:grid-cols-3">
          {inApp.map((s) => (
            <Card key={s.href} {...s} />
          ))}
        </div>

        <h2 className="font-display mb-3 text-lg font-semibold">Original HTML prototypes</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {prototypes.map((s) => (
            <Card key={s.href} {...s} external />
          ))}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
