# LeaseMatch UAE

An AI rental agent for the UAE. It works for every side of a rental: tenants
relocating to Abu Dhabi and Dubai, landlords, leasing offices, property
management companies and agencies. It finds verified homes, checks today's
Bayut and Dubizzle ads, matches tenants with landlords, and carries the deal
through a guided contract, an AI photo inspection, e-signature and payment.

**Stage:** Functional MVP. Real AI end to end; payments and
agent phone calls are simulated, and listings are sample data.

- **Live MVP:** https://leasematch-uae.onrender.com
- **Code:** https://github.com/yivanyukpl-sudo/leasematch-uae
- **How to use the MVP:** [docs/PROTOTYPE-GUIDE.md](docs/PROTOTYPE-GUIDE.md) — logins, a 3-minute tour, key flows and limitations
- **Tenant login:** `demo.tenant@leasematchuae.test` / `LeaseMatch-tenant-2026`
- **Landlord logins:** `marina.pm@sample.leasematch.test`, `owner.skyline@sample.leasematch.test`, `meadows@sample.leasematch.test` — password `LeaseMatch-demo-2026`

These are sample accounts on sample data.

## What it does

| For | Features |
| --- | --- |
| Tenants | Preferences and match scores · AI agent chat · Bayut/Dubizzle market search with verified links · "Notify me" alerts when nothing fits · apply in one click |
| Landlords, leasing offices, property managers | Listings · applicants with job, income and move-in date · AI photo inspection of the unit · alerts about waiting tenants |
| Agencies | Transparent listings, with commission paid by the landlord, never the tenant |
| Everyone in a deal | A deal assistant that guides each step: contract terms → package → AI photo inspection → signatures → payment → keys |

### The AI (Claude)

All AI runs server-side on **Claude** (Anthropic SDK, `claude-opus-5-5`)
when `ANTHROPIC_API_KEY` is set, with OpenAI as an optional fallback.

| Feature | Where | How |
| --- | --- | --- |
| Rental agent chat | `/dashboard/assistant` · `lib/ai-claude.ts` | Tool use: search verified listings with market comparables, apply, draft and send outreach emails, save alerts, plus web search on UAE portals. Portal links not returned by the search are removed. |
| Market search | `/dashboard/market` · `lib/market-search-claude.ts` | Server-side web search restricted to Bayut and Dubizzle (no scraping) and a strict `report_listings` tool. Every URL is checked against the real search results. |
| Deal assistant | lease page · `lib/deal-assistant.ts` | Answers questions at each step of the contract. |
| AI photo inspection | `/dashboard/inspections` · `lib/inspection-ai.ts` | Room-by-room guided photos; Claude vision rates each photo and flags damp, cracks, dirty AC filters, leaks. |

Without any AI key the app still runs: the chat says it isn't connected, the
photo check shows a clearly labelled demo, and the deal assistant uses
built-in answers.

## Try it (3 minutes)

1. Open the **Demos** page and play a role simulation (tenant, landlord or agent).
2. Log in as the tenant. The dashboard shows matches; ask the **AI agent**
   for a home, or run a **market search** on Bayut and Dubizzle.
3. Apply to a listing. In a second browser, log in as `marina.pm@…` and
   approve the applicant.
4. On the lease page, follow the **deal assistant**: terms, package (simulated
   payment), AI photo inspection, sign on both sides, pay, confirm.

Each main screen opens a short click-through guide on first visit; reopen it
with **? Guide** at the bottom right.

## Run locally

Requires Node 22.13+.

```bash
cp .env.local.example .env.local   # add ANTHROPIC_API_KEY
npx pnpm install
./node_modules/.bin/next dev --port 3000
```

The SQLite database and sample data are created on first start in
`data/leasematch.db`.

| Variable | Purpose |
| --- | --- |
| `ANTHROPIC_API_KEY` (+ `CLAUDE_MODEL`) | Claude for all AI features |
| `OPENAI_API_KEY` | Optional fallback when no Anthropic key is set |
| `SESSION_SECRET` | Signs session cookies (required in production) |
| `STRIPE_SECRET_KEY`, `NOWPAYMENTS_API_KEY` | Real payments; otherwise simulated |
| `MAILGUN_API_KEY`, `MAILGUN_DOMAIN` | Real emails; otherwise printed to the console in dev |
| `LEASEMATCH_DB_PATH`, `UPLOAD_DIR` | Database and uploaded photos location |

Checks:

```bash
./node_modules/.bin/next typegen && ./node_modules/.bin/tsc --noEmit
./node_modules/.bin/eslint
npm test
```

## Stack

Next.js 16 (App Router, server actions) · React 19 · TypeScript ·
Tailwind CSS v4 · SQLite (`node:sqlite`) · zod · JWT session cookies ·
Anthropic SDK · Stripe / NOWPayments (optional) · Mailgun (optional).

## Project map

| Path | Contents |
| --- | --- |
| `app/` | Pages and API routes |
| `app/dashboard/actions.ts` | Server actions: apply, approve, sign, pay, deal terms, packages |
| `lib/db.ts`, `lib/seed.ts` | Schema, queries, sample data |
| `lib/claude.ts`, `lib/ai-claude.ts`, `lib/market-search-claude.ts`, `lib/agent-tools.ts` | AI agent and market search |
| `lib/deal.ts`, `lib/packages.ts` | Guided deal steps, contract template, package prices |
| `lib/inspection-*.ts`, `lib/uploads.ts` | Photo inspection and private file storage |
| `lib/alerts.ts` | "Notify me" alerts |
| `public/simulations/` | Agent outreach and role click-through simulations |

## Limitations

- Bayut/Dubizzle search uses a search index, not direct portal access, so
  results are mostly category pages and can be stale.
- Agent phone calls and payments are simulated; package prices
  (AED 99 / 149 / 199) are placeholders.
- No UAE Pass, Ejari or Tawtheeq integration yet; the contract template
  needs a lawyer's review.
- No email verification, password reset or ownership-document check.
- English only; one server instance (SQLite).

## Deploy

`render.yaml` is a Render Blueprint: one web service (starter plan) with a
1 GB persistent disk for the database and uploads. In Render choose
**New → Blueprint**, pick this repository, and enter `ANTHROPIC_API_KEY`
when asked.
