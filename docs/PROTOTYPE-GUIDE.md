# LeaseMatch UAE — Functional MVP Guide

LeaseMatch UAE is an AI rental agent for tenants relocating to Dubai and
Abu Dhabi, and for the landlords, leasing offices, property management companies
and agencies on the other side of the deal. Tenants search verified listings
and Bayut/Dubizzle ads; the app then handles applications, a guided lease,
signing, payment confirmations from both sides and the key handover.

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
   leases to sign, payment receipts to attach, key handovers to confirm.
4. **New account:** `/signup`, then choose a role — tenant, landlord, broker
   or property manager. Brokers and property managers must give a company
   name.
5. **Leases** (header): all your lease agreements — see
   [Lease agreements](#lease-agreements) below.
6. **Sign out** from the header. A session lasts 30 days.

To test a full deal, use two browsers (or a private window): tenant in one,
landlord in the other. The tenant applies to a listing, the landlord approves
it on the listing's **Applicants** page, and both continue on the lease page
(see [Lease conclusion, step by step](#lease-conclusion-step-by-step)).

Each main screen opens a short click-through guide on first visit; reopen it
with **? Guide** at the bottom right.

## Lease agreements

Open **Leases** in the header (`/dashboard/leases`). Every account type has
this page; the heading changes with the account: **My tenancies** (tenant),
**My properties** (landlord), **Deals you brokered** (agency) and
**Portfolio** (leasing office / property manager).

Every user sees their full lease history here.

| Section | What appears there | When it gets there |
| --- | --- | --- |
| Summary tiles | Active, in progress and finished counts, plus annual rent (tenant) or renewals due within 90 days (landlord, agency, property manager) | Always |
| By property *(landlords, agencies, property managers)* | One row per unit you list: **Leased** with tenant and lease end date, a lease **in progress**, or **Vacant**; "renewal due" when the lease ends within 90 days | As soon as you have a listing |
| Active leases | Concluded leases still in their term: property, other party, term dates (start → end), cheques, signing date, payment reference, key status | When both sides have signed **and** both payment confirmations are attached (the platform concludes it automatically) |
| In progress | Leases not yet concluded, with the current step (terms & signatures, proof of payment, proof of receipt) | From the moment a landlord **approves an application** until both payment confirmations are attached |
| Finished leases | Past leases whose term has ended | The day after the lease end date |

The sample tenant already has two finished leases (Business Bay 2023–24 and
Al Barsha 2024–25), so the history shows from the first login. They are
sample records: all their steps show as done, but no payment-proof files are
attached ("no file on record"). The sample accounts have no active lease, so
to see proofs, automatic conclusion and the key handover, run a new deal (see
below).

Click any lease to open it. Once both sides have signed, the lease page shows
the **Signed agreement**: the full contract text, both signatures with date
and time, term dates, and the payment reference. Each section also has a
click-through tip (**? Guide**, bottom right).

## Lease conclusion, step by step

The lease page (`/dashboard/leases/[id]`) is the core of the app. It lists
every stage in order; the current one is open with a **💡 Tip** written for
your role, and you can click any other stage to read it.

| # | Stage | Who acts | What happens |
| --- | --- | --- | --- |
| 1 | Application approved | Landlord | A lease opens when the landlord approves an application. |
| 2 | Contract terms | Either side | Move-in date, length, deposit, cheques, utilities. |
| 3 | LeaseMatch package | Tenant | AED 99 / 149 / combo 199 (simulated without Stripe). Unlocks signing. |
| 4 | AI photo inspection *(optional)* | Either side | Room-by-room photos; the AI flags defects before signing. |
| 5 | Both signatures | Both | Full name as on the account; order doesn't matter. |
| 6 | Proof of payment | Tenant | Pays the first cheque and attaches a transfer receipt, cheque photo or screenshot (PDF, JPG, PNG, up to 10 MB). A paid Stripe checkout counts as proof. |
| 7 | Proof of receipt | Landlord | Checks the money arrived and attaches a bank statement line or receipt. Both sides can open both files. |
| 8 | Agreement concluded | **Automatic** | As soon as both confirmations are attached, LeaseMatch concludes the agreement, marks the property as leased and shows it under **Leases → Active**. No button. |
| 9 | Key handover | Tenant, then landlord | The tenant opens a separate window and chooses **in hand** at a meeting (date, time, place: the apartment or another location) or **by mail** (address, recipient, phone). The landlord confirms; the tenant presses **I received the keys**. |

No receipt to hand? **Attach a sample (demo)** creates a labelled sample PDF
so you can try steps 6–8. Each action also posts a line in the lease chat.

**Try the whole flow live (about 5 minutes):**

1. Log in as the tenant (`demo.tenant@…`) and **Apply** to a listing from
   Marina Property Management, e.g. *2BR Sea View, Marina Gate*.
2. In a private window, log in as `marina.pm@…`, open the listing's
   **Applicants** page and **Approve**. A lease opens for both.
3. Landlord: save the **Contract terms**. Tenant: choose a **package**
   (simulated payment).
4. Both: **sign** with your full name as on the account (Sara Demo /
   Rania Haddad).
5. Tenant: **Attach a sample (demo)** on *Proof of payment*. Landlord: **Attach
   a sample (demo)** on *Proof of receipt*. The lease is now **concluded
   automatically**.
6. Tenant: **Choose how to receive the keys** (in hand or by mail). Landlord:
   **Confirm this handover**. Tenant: **I received the keys**.
7. **Leases** for both accounts: the lease is under **Active leases**.

## A 3-minute tour

1. **Demos page** (`/demos`): play a simulation: **lease conclusion** (both
   sides), tenant, landlord or agent. Tap the highlighted buttons on the phone.
2. **Tenant:** ask the **AI agent** for a home in plain words (area, budget in
   AED, cheques, furnished), or run a **market search** on Bayut and
   Dubizzle (about a minute). Every link shown came from a real search result.
3. **Nothing fits?** Press **Notify me** — you get an email when a matching
   listing goes live.
4. **Apply** to a LeaseMatch listing, then approve it as the landlord.
5. **Lease page:** follow **Lease conclusion, step by step**: contract terms
   → package (simulated payment) → **AI photo inspection** (optional) → both
   sign → tenant attaches proof of payment → landlord attaches proof of
   receipt → concluded automatically → tenant chooses how to get the keys.
   Signing stays locked until terms are saved and the package is paid.
6. **Leases** (header): the lease now appears under **Active leases** for both
   the tenant and the landlord, next to **In progress** and **Finished
   leases**; open it to read the signed contract.

## Key flows

1. **Find:** tenant preferences → matched listings with a score, or the AI
   agent chat. Nothing found → "Notify me" alert instead of leaving the app.
2. **Apply:** tenant applies → landlord approves → a lease is created.
3. **Guided deal (lease page):** contract terms → tenant pays a package →
   optional AI photo inspection → both sign → proof of payment (tenant) →
   proof of receipt (landlord) → automatic conclusion → key handover.
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
| Payments | Simulated unless Stripe or NOWPayments keys are set; package prices (AED 99 / 149 / 199) are placeholders. Payment proofs are files the parties upload; LeaseMatch doesn't check them against a bank. |
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
| `LEASEMATCH_DB_PATH`, `UPLOAD_DIR` | Database and uploaded files (photos, payment proofs) location (production: a persistent disk). |

### Code map

| Path | What lives there |
| --- | --- |
| `app/` | Pages and API routes. Public: `/`, `/listings`, `/properties/[id]`, `/demos`. Signed in: `/dashboard/*` (preferences, assistant, market search, inquiries, calls, leases, inspections). APIs under `app/api/*`. |
| `app/dashboard/actions.ts` | Server actions: apply, approve, sign, pay, deal terms, package, key handover, deal-assistant questions. |
| `app/api/leases/[id]/payment-proof` | Upload of payment confirmations; the landlord's proof triggers automatic conclusion (`addPaymentProof` in `lib/db.ts`). |
| `lib/db.ts`, `lib/seed.ts` | SQLite schema (versioned migrations) and queries; sample data. |
| `lib/claude.ts`, `lib/ai-claude.ts`, `lib/market-search-claude.ts`, `lib/agent-tools.ts` | Claude client, chat agent, Bayut/Dubizzle search with URL verification, shared tools and prompt. OpenAI versions: `lib/ai.ts`, `lib/market-search.ts`. |
| `lib/deal.ts`, `lib/packages.ts`, `lib/deal-assistant.ts` | Guided lease steps, contract template, package prices and the step-by-step helper. |
| `lib/inspection-*.ts`, `lib/uploads.ts` | AI photo inspection steps, vision analysis, private file storage. |
| `lib/alerts.ts` | "Notify me" alerts for tenants and landlords. |
| `components/` | UI: `DealAssistant`, `DealPanels`, `KeyHandoverDialog`, `StayAndWait`, `GuideTour`, `AgentChat`, `AgentCallSimulator` and others. |
| `public/simulations/` | Static HTML simulations: agent outreach and the role click-throughs, including lease conclusion (`scripts/build-role-sims.py`). |

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
