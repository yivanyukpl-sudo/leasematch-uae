# LeaseMatch UAE — Functional MVP Guide

LeaseMatch UAE is an AI rental agent for tenants relocating to Dubai and
Abu Dhabi, and for the landlords, leasing offices, property management companies
and agencies on the other side of the deal. Tenants search verified listings
and Bayut/Dubizzle ads; the app then handles applications, a guided lease,
signing and payment.

**Live MVP:** https://leasematch-uae.onrender.com ·
**Code:** https://github.com/yivanyukpl-sudo/leasematch-uae

**Stage:** Functional MVP. The AI is real; payments and agent
phone calls are simulated; listings and accounts are sample data.

## Logging in

| Role | Email | Password |
| --- | --- | --- |
| Tenant | `demo.tenant@leasematchuae.test` | `LeaseMatch-tenant-2026` |
| Landlord / property manager | `marina.pm@sample.leasematch.test` | `LeaseMatch-demo-2026` |
| Landlord | `owner.skyline@sample.leasematch.test` | `LeaseMatch-demo-2026` |
| Landlord | `meadows@sample.leasematch.test` | `LeaseMatch-demo-2026` |

These are sample accounts on sample data.

1. Open **https://leasematch-uae.onrender.com/login** and sign in with one of
   the accounts above. You land on **/dashboard**.
2. **Tenant view:** matched listings, preferences, AI agent chat
   (`/dashboard/assistant`), market search (`/dashboard/market`),
   applications and leases.
3. **Landlord view:** your properties, applicants to approve or decline,
   leases to sign and confirm.
4. **New account:** `/signup`, then choose a role — tenant, landlord, broker
   or property manager. Brokers and property managers must give a company
   name.
5. **Sign out** from the header. A session lasts 30 days.

To test a full deal, use two browsers (or a private window): tenant in one,
landlord in the other. The tenant applies to a listing, the landlord approves
it on the listing's **Applicants** page, and both continue on the lease page.

Each main screen opens a short click-through guide on first visit; reopen it
with **? Guide** at the bottom right.

## A 3-minute tour

1. **Demos page** (`/demos`): play a role simulation — tenant, landlord or
   agent. Tap the highlighted buttons on the phone.
2. **Tenant:** ask the **AI agent** for a home in plain words (area, budget in
   AED, cheques, furnished), or run a **market search** on Bayut and
   Dubizzle (about a minute). Every link shown came from a real search result.
3. **Nothing fits?** Press **Notify me** — you get an email when a matching
   listing goes live.
4. **Apply** to a LeaseMatch listing, then approve it as the landlord.
5. **Lease page:** follow the **deal assistant** — contract terms → package
   (simulated payment) → **AI photo inspection** (optional) → both sign →
   first payment → landlord confirms → keys. Signing stays locked until terms
   are saved and the package is paid.

## Key flows

1. **Find:** tenant preferences → matched listings with a score, or the AI
   agent chat. Nothing found → "Notify me" alert instead of leaving the app.
2. **Apply:** tenant applies → landlord approves → a lease is created.
3. **Guided deal (lease page):** contract terms → tenant pays a package →
   optional AI photo inspection → both sign → first payment → landlord
   confirms → keys.
4. **Beyond LeaseMatch:** market search on Bayut/Dubizzle, email to
   advertisers, simulated agent calls.

| Real when keys are set | Always simulated in this MVP |
| --- | --- |
| Claude agent, web search and photo analysis; Stripe/NOWPayments checkout; Mailgun email | Agent phone calls; UAE Pass and DLD/Ejari registration; package payment when no Stripe key |

## Functional limitations

| Area | Limitation in this MVP |
| --- | --- |
| AI features | Need `ANTHROPIC_API_KEY` (or OpenAI). Without a key: the chat shows "not connected", photo results are a labelled demo, the deal helper uses built-in answers. The AI can be wrong and only sees what is in a photo. |
| Bayut / Dubizzle search | Search-index results only, no direct portal access (bot protection, terms of use). Mostly category pages, few single ads; ads can be stale; about 1 minute per search. Every link is verified, so results can be short. |
| Agent calls | Simulated scripts; no real phone calls. |
| Payments | Simulated unless Stripe or NOWPayments keys are set; package prices (AED 99 / 149 / 199) are placeholders. |
| Contracts | In-app typed signature only. UAE Pass, Ejari and Tawtheeq registration are not integrated; the template needs a lawyer's review. |
| Accounts | No email verification or password reset; landlords publish listings themselves with no ownership-document check. |
| Email | Outreach and alerts need Mailgun; without it they print to the server console. |
| Platform | English only; responsive web app (no native mobile app); SQLite and in-memory rate limiting, so one server instance only. |

---

## For developers

**Stack:** Next.js 16.3.4 (App Router, server actions, Turbopack) · React 19 ·
TypeScript · Tailwind CSS v4 · `node:sqlite` · zod · JWT session cookies
(jose + bcryptjs) · Claude via the Anthropic SDK (`claude-opus-5-5`, when
`ANTHROPIC_API_KEY` is set; OpenAI as fallback) · Stripe and NOWPayments
(optional) · Mailgun (optional).

### Run it locally

Node 22.13+ is required. The database and sample data are created on first
start in `data/leasematch.db`.

```bash
cp .env.local.example .env.local
npx pnpm install
./node_modules/.bin/next dev --port 3000 -H 127.0.0.1
```

| Env var | Needed for |
| --- | --- |
| `ANTHROPIC_API_KEY` (+ optional `CLAUDE_MODEL`), or `OPENAI_API_KEY` as fallback | AI agent chat, Bayut/Dubizzle search, AI photo inspection, deal assistant. Without either key these fall back to demo answers or show "not connected". |
| `SESSION_SECRET` | Signing session cookies; required in production. |
| `STRIPE_SECRET_KEY`, `NOWPAYMENTS_API_KEY` | Real card or crypto payments. Without them, payments are simulated. |
| `MAILGUN_API_KEY`, `MAILGUN_DOMAIN` | Real outreach and alert emails. In dev, emails print to the server console. |
| `LEASEMATCH_DB_PATH`, `UPLOAD_DIR` | Database and uploaded photos location (production: a persistent disk). |

### Code map

| Path | What lives there |
| --- | --- |
| `app/` | Pages and API routes. Public: `/`, `/listings`, `/properties/[id]`, `/demos`. Signed in: `/dashboard/*` (preferences, assistant, market search, inquiries, calls, leases, inspections). APIs under `app/api/*`. |
| `app/dashboard/actions.ts` | Server actions: apply, approve, sign, pay, deal terms, package, deal-assistant questions. |
| `lib/db.ts`, `lib/seed.ts` | SQLite schema (versioned migrations) and queries; sample data. |
| `lib/claude.ts`, `lib/ai-claude.ts`, `lib/market-search-claude.ts`, `lib/agent-tools.ts` | Claude client, chat agent, Bayut/Dubizzle search with URL verification, shared tools and prompt. OpenAI versions: `lib/ai.ts`, `lib/market-search.ts`. |
| `lib/deal.ts`, `lib/packages.ts`, `lib/deal-assistant.ts` | Guided lease steps, contract template, package prices and the step-by-step helper. |
| `lib/inspection-*.ts`, `lib/uploads.ts` | AI photo inspection steps, vision analysis, private file storage. |
| `lib/alerts.ts` | "Notify me" alerts for tenants and landlords. |
| `components/` | UI: `DealAssistant`, `DealPanels`, `StayAndWait`, `GuideTour`, `AgentChat`, `AgentCallSimulator` and others. |
| `public/simulations/` | Static HTML simulations: agent outreach and the role click-throughs (`scripts/build-role-sims.py`). |

### Checks and deployment

- **Checks:** `./node_modules/.bin/next typegen && ./node_modules/.bin/tsc --noEmit`,
  `./node_modules/.bin/eslint`, `npm test`.
- **Deploy:** `render.yaml` defines a Render web service (starter plan,
  persistent disk for SQLite and uploads). The service `leasematch-uae`
  deploys automatically from this repository, with `ANTHROPIC_API_KEY` set in
  Render.
- **Next.js 16:** APIs differ from older versions; read
  `node_modules/next/dist/docs/` before changing routing, config or error
  pages (see `AGENTS.md`).
