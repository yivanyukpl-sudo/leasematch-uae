import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { getSession } from "@/lib/auth";

const steps = [
  {
    title: "Tell your agent what you need",
    body: "Describe the area, budget and type of place in your own words, or fill in your preferences directly. Your agent searches real live listings and tells you honestly if your budget is out of line with the market.",
  },
  {
    title: "Apply, negotiate, and sign",
    body: "Apply in a couple of clicks. If a listing is priced above comparable ones nearby, your agent flags it before you sign and can draft a counter-offer for you to send to the landlord.",
  },
  {
    title: "Pay and move in, safely",
    body: "Pay through a secure external payment provider, and get clear instructions for a verified key handover — with a standing warning against anything that looks like a scam.",
  },
];

const features = [
  {
    title: "An agent, not just a search box",
    body: "Chat with an AI agent that searches real listings, advises on price, and can apply for you — the way a good human agent would, not a filtered list.",
  },
  {
    title: "Matching that explains itself",
    body: "Every listing shows a match score based on your stated preferences, so you know why something was suggested.",
  },
  {
    title: "Real applications, real review",
    body: "Owners, brokers and property managers review actual applicants — occupation, income, move-in date — and approve or decline with one click.",
  },
  {
    title: "Sign electronically",
    body: "Sign your lease inside the app today; UAE Pass sign-in is on the roadmap for tenants who prefer government-verified identity.",
  },
  {
    title: "Secure, external payment",
    body: "Pay rent through a real external payment provider's own hosted checkout — LeaseMatch never sees or stores your card details.",
  },
  {
    title: "Negotiate without leaving the lease",
    body: "An amendment chat lets tenants and providers discuss changes to the draft before or after signing, all in one thread.",
  },
];

export default async function Home() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  return (
    <div className="flex flex-col flex-1">
      <SiteHeader />
      <main className="flex-1">
        <section className="border-b" style={{ borderColor: "var(--border)" }}>
          <div className="mx-auto max-w-3xl px-6 py-20 text-center">
            <p
              className="mb-3 text-sm font-medium tracking-wide uppercase"
              style={{ color: "var(--gold)" }}
            >
              Trusted leasing
            </p>
            <h1 className="font-display text-4xl sm:text-5xl font-semibold tracking-tight text-text">
              Matched, verified, signed.
            </h1>
            <p className="mt-5 text-lg text-text-muted max-w-xl mx-auto">
              Moving to Dubai? LeaseMatch connects newcomers with verified owners, brokers
              and property managers. An AI agent searches LeaseMatch and today&apos;s Bayut and
              Dubizzle ads, contacts landlords for you and negotiates, from first search to
              signed agreement.
            </p>
            <div className="mt-8 flex items-center justify-center gap-3">
              <Link
                href="/signup"
                className="rounded-md px-5 py-3 font-medium"
                style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
              >
                Create an account
              </Link>
              <Link
                href="/login"
                className="rounded-md border px-5 py-3 font-medium text-text"
                style={{ borderColor: "var(--border)" }}
              >
                Log in
              </Link>
            </div>
            <Link href="/demos" className="mt-6 inline-block text-sm text-text-muted underline underline-offset-4">
              Or explore the prototypes &amp; agent simulations first
            </Link>
          </div>
        </section>

        <section className="border-b" style={{ borderColor: "var(--border)" }}>
          <div className="mx-auto max-w-5xl px-6 py-16">
            <h2 className="font-display text-2xl font-semibold text-center mb-10">
              How it works
            </h2>
            <div className="grid gap-8 sm:grid-cols-3">
              {steps.map((s, i) => (
                <div key={s.title}>
                  <div
                    className="mb-3 flex h-8 w-8 items-center justify-center rounded-full font-display font-semibold"
                    style={{ background: "var(--gold-soft)", color: "var(--gold)" }}
                  >
                    {i + 1}
                  </div>
                  <h3 className="font-medium mb-1.5">{s.title}</h3>
                  <p className="text-sm text-text-muted">{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b" style={{ borderColor: "var(--border)" }}>
          <div className="mx-auto max-w-5xl px-6 py-16">
            <h2 className="font-display text-2xl font-semibold text-center mb-10">
              What&apos;s in the platform
            </h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((f) => (
                <div
                  key={f.title}
                  className="rounded-lg border bg-surface p-5"
                  style={{ borderColor: "var(--border)" }}
                >
                  <h3 className="font-medium mb-1.5">{f.title}</h3>
                  <p className="text-sm text-text-muted">{f.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section>
          <div className="mx-auto max-w-3xl px-6 py-16 text-center">
            <h2 className="font-display text-2xl font-semibold mb-3">
              For owners, brokers and property managers
            </h2>
            <p className="text-text-muted mb-8">
              Publish a listing, review real applicants with income and move-in details already
              attached, and take a lease from approval to a finalized, signed agreement without
              leaving the platform.
            </p>
            <Link
              href="/signup"
              className="inline-block rounded-md px-5 py-3 font-medium"
              style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
            >
              List a property
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
