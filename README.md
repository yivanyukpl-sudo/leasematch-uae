# LeaseMatch UAE — hub71ai-leasematchuae

**Relocating to Abu Dhabi is hard to rent for.** Newcomers (founders on a Hub71
visa, hires, families) don't know the areas or fair prices. They chase stale
Bayut and Dubizzle ads, and burn days messaging agents who never reply.
LeaseMatch gives them an AI rental agent that searches verified listings
*and* today's public portal ads, contacts landlords for them, negotiates,
and carries the deal through e-signature and payment.

- **Live demo:** https://hub71ai-leasematchuae.onrender.com
- **Demo login (tenant):** `demo.tenant@leasematchuae.test` / `LeaseMatch-tenant-2026`
- **Provider login:** `marina.pm@sample.leasematch.test` / `LeaseMatch-demo-2026`

## What the AI does (OpenAI)

All model calls use the **OpenAI Responses API** (`gpt-5.5` by default,
`OPENAI_MODEL` to override), server-side only:

| Feature | Where | OpenAI tooling |
|---|---|---|
| Market search across Bayut & Dubizzle | `/dashboard/market`, `lib/market-search.ts` | Hosted `web_search` tool restricted to bayut.com / dubizzle.com (no scraping) + strict function tool `report_listings`. Every returned URL is checked against the search's actual sources, and anything else is dropped. |
| Conversational rental agent | `/dashboard/assistant`, `lib/ai.ts` | Function calling: search verified listings with market comparables, apply, draft/revise/send outreach emails, plus web search |
| Counter-offer drafting | lease sign step | Drafts a negotiation message when rent is priced above comparable listings |

## Demo journey (3 minutes)

1. Log in as the demo tenant. The dashboard shows Abu Dhabi matches ranked
   against the saved profile ("relocating for Hub71").
2. **Market search**: run a search (or open a saved one) for Al Reem Island.
   You get live Bayut/Dubizzle ads, flagged unverified, each with a real link.
3. Open an ad, then **Email advertiser** (composer pre-filled from the ad).
4. **Agent call (simulated)**: the AI phones the advertiser, discloses it's an
   AI, and negotiates. The transcript and outcome are saved to the call log.
5. `/demos` → **Agent outreach simulation**: the full loop of portals, email,
   phone, then a verified in-app chat where the deal is negotiated with tenant
   approval at each step.

Simulated parts are labelled in the UI. Phone calls are scripted, and email
sends for real only when Mailgun is configured (otherwise there's a one-click
"open in my email app").

## Data

- 10 verified sample listings across Abu Dhabi (Al Maryah Island, Al Reem,
  Corniche, Saadiyat, Yas, Al Raha, Khalifa City, Al Ghadeer) with generated
  illustrations (`lib/seed.ts`, `scripts/generate-property-art.mjs`).
- Every market search is stored (`market_searches`, `market_listings`), which
  builds up a dataset of real, link-verified portal ads by area and budget over
  time.

## Run locally

Requires Node 22.13+.

```bash
cp .env.local.example .env.local   # set OPENAI_API_KEY
npx pnpm install
npx pnpm dev
```

SQLite lives at `data/leasematch.db` (set `LEASEMATCH_DB_PATH` to move it).
See `TESTING.md` for full walkthroughs.

## Deploy (Render)

`render.yaml` defines one Node web service with a 1 GB persistent disk for
SQLite (`LEASEMATCH_DB_PATH=/var/data/leasematch.db`). In Render, choose
**New → Blueprint**, pick this repo, and enter `OPENAI_API_KEY` when prompted.
`SESSION_SECRET` is generated automatically.
