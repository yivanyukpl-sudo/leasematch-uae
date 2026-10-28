# Running LeaseMatch locally

This is a real Next.js app with a real (local) database — not a static
demo — so it needs to run on your machine.

## Requirements
- Node.js 22 or newer (the app uses Node's built-in SQLite module,
  which only exists in Node 22+). Check with `node --version`.
- pnpm. If `pnpm` isn't installed, use `npx pnpm ...` in place of
  `pnpm ...` below — no separate install needed.

## Setup
```
npx pnpm install
npx pnpm dev
```
Then open http://localhost:3000 in your browser.

If `pnpm install` complains about a supply-chain policy (minimum
release age, unapproved build scripts), run:
```
npx pnpm clean --lockfile
npx pnpm install
npx pnpm approve-builds
```
approving `unrs-resolver` when prompted, then `npx pnpm dev` again.

A `data/leasematch.db` file will be created automatically on first run
— that's your local database. Delete it any time to start fresh.

## What to try — the full flow, two accounts

Best tested with two browser windows (or one normal + one private/
incognito window) so you can be logged in as an owner and a tenant at
the same time.

**As an owner (window 1):**
1. Sign up, choosing "Owner."
2. From the dashboard, click "Add property" and list a place (try
   Dubai Marina as the location — it's one of the preset options).
3. Click "Publish listing" so it goes live.

**As a tenant (window 2):**
4. Sign up, choosing "Tenant."
5. Click "Set your preferences" — pick the same property type and
   location you used above, and a budget that covers the rent.
6. Back on the dashboard, you should see the listing with a match
   score.
7. Click into it and submit an application.

**Back as the owner:**
8. From the dashboard, click "View applicants" on your property.
9. Click "Approve" — this creates a lease and takes you to it.
10. On the lease page, type your full name exactly as you signed up
    (shown as a placeholder in the box) and click "Sign agreement."
    The "Sign with UAE Pass" button above it is intentionally
    disabled — see Payments & signatures below.

**Back as the tenant:**
11. Open "Your applications" → the lease link, and sign your side the
    same way.
12. Once both have signed, you'll see a payment step — see below for
    what it does with and without Stripe configured.

**Back as the owner:**
13. Click "Confirm payment received" — the lease finalizes, and you'll
    see the key-handover instructions and warning.
14. Try the chat box at the bottom of the lease page from either
    account — messages should show up for both sides.

## Payments & signatures

**Payment:** the "Awaiting payment" step is wired to real Stripe
Checkout — clicking "Pay" genuinely redirects the tenant to a
Stripe-hosted external page, not a fake one in this app. It only
works once you add a key:
1. Create a free Stripe account and grab a **test** secret key from
   https://dashboard.stripe.com/test/apikeys (no business
   verification needed for test mode).
2. Copy `.env.local.example` to `.env.local` and set
   `STRIPE_SECRET_KEY=sk_test_...`.
3. Restart `pnpm dev`. The lease page will now show a real
   "continue to payment provider" button; use test card
   `4242 4242 4242 4242`, any future expiry, any CVC.

Without a key set, the page explains that no provider is connected
and offers a "Simulate payment" button instead, so you can still test
everything past that point. Swapping in a UAE gateway (Telr, PayTabs,
Network International) or a real bank transfer flow instead of Stripe
is a matter of adding another branch in `lib/payments.ts` — the lease
page and database don't care which provider was used.

**Signatures:** UAE Pass (the UAE's government digital-identity
sign-in) is the "real" way this would work for most tenants, but it
requires a government-issued client ID/secret that isn't connected —
that button is deliberately shown but disabled, with an explanation
on hover. The working path today is the fallback for anyone without
UAE Pass: typing your full legal name into the app to sign
electronically. It's checked against the name on your account, so a
mismatched name is silently rejected (try it to see).

## The AI agent

Tenants get an "Open chat" card at the top of their dashboard — a
conversational agent that searches real live listings, tells you
honestly when a budget isn't realistic for an area (using actual
comparable prices, not a canned response), and can submit an
application for you once you confirm. It also proactively steps in:
if a tenant is about to sign a lease priced well above comparable
live listings, a note appears above the sign button before they can
miss it, offering to draft a counter-offer message into the landlord
chat for them to review and send.

To enable it:
1. Get a key from https://platform.openai.com/api-keys
2. Add `OPENAI_API_KEY=sk-ant-...` to `.env.local`.
3. Restart `pnpm dev`.

Without a key, the chat and the negotiation-draft button both say
plainly that the agent isn't connected instead of pretending to work.

To see the pricing nudge in action: as an owner, list two or three
"comparable" properties in the same location and property type at a
normal price, publish them, then list one more at a clearly higher
price and publish it too. Apply to the expensive one as a tenant and
get it approved — the note appears above the sign button once you're
on that lease page.

The agent also opens the conversation itself — it doesn't wait for
you to type first. It greets you and offers a choice: browse
LeaseMatch's own verified listings, or also pull in real listings
from other UAE property sites (Bayut, Property Finder, Dubizzle) via
a genuine, hosted web search (OpenAI runs the search — nothing is
scraped). Pick "verified database" and it behaves exactly as above.
Pick "also check the web" and it will search those sites for real
when relevant, but every such result is explicitly labeled
unverified with its source and a link — you can never apply through
LeaseMatch to a web result, only to LeaseMatch's own listings. This
uses the same `OPENAI_API_KEY` — no separate setup.

## Crypto payments

Alongside Stripe, tenants can pay with crypto — a real redirect to a
NOWPayments-hosted checkout page (Bitcoin, Ethereum, USDT, and more),
not a simulation. To enable it:
1. Sign up at https://nowpayments.io/ and grab an API key from the
   dashboard (or use https://sandbox-account.nowpayments.io/ for a
   sandbox key to test without real funds — if you do, also set
   `NOWPAYMENTS_SANDBOX=true`).
2. Add `NOWPAYMENTS_API_KEY=...` to `.env.local`.
3. Restart `pnpm dev`.

Both Stripe and crypto can be enabled at once — the tenant sees both
buttons and picks either. With neither configured, the page falls
back to "Simulate payment" as before. Unlike Stripe's checkout
session (which this app verifies server-side when the tenant returns),
crypto payment confirmation isn't automatically verified here — no
webhook/IPN endpoint is wired up for local dev — so after paying,
the tenant confirms they sent it, and the lease still only finalizes
once the provider separately confirms receipt, the same safety net
every other payment method already goes through here.

## Contacting listings outside LeaseMatch

When a tenant asks the agent to also check the web (see above), it
can go one step further if they ask it to reach out: it drafts a
real inquiry email to the listing's contact — the way a human agent
would follow up on a lead — and shows the tenant the full text right
there in the chat. From there it's a normal back-and-forth: ask for
changes ("make it shorter", "mention I can move in next month") and
the agent revises and shows you the new version, as many times as
you want. Nothing is sent until you say so explicitly ("send it",
"looks good, go ahead") — only then does the agent actually send it
and confirm. The same draft is also visible (and editable/sendable
the same way) on the "External inquiries" page if you'd rather do it
there instead of in chat.

Every message is explicit that it's a third-party, unverified
listing and that LeaseMatch isn't the agent for it — both in the app
and in a footer line on the email itself.

To enable actually sending:
1. Sign up at https://www.mailgun.com/ (the free sandbox domain
   works immediately, no domain purchase needed for testing).
2. Add `MAILGUN_API_KEY=...` and `MAILGUN_DOMAIN=...` to `.env.local`.
3. Restart `pnpm dev`.

Without those set, drafts still work — you just see an explanation
that email isn't connected instead of a working Send button.

**Receiving real replies back into the thread needs a public URL.**
Mailgun's inbound "Routes" feature calls this app's
`/api/inbound/email` webhook when a reply arrives — but Mailgun has
to be able to reach that URL over the internet, which `localhost`
isn't. To test the reply loop locally without deploying anything
permanent, run a tunnel (e.g. `ngrok http 3000`) and point a Mailgun
Route at the tunnel's public URL + `/api/inbound/email`; once this
app is deployed somewhere with a real address, point the Route
there instead. Until a Route is configured, sending still works —
you just won't see replies land back in the thread automatically.

## Notes
- Brand fonts (Fraunces / IBM Plex) will load for real once you're on
  a normal internet connection — see the comment at the top of
  `app/layout.tsx`.
- `supabase/migrations/0001_init.sql` is the Postgres schema this will
  move to once you're ready to connect a real Supabase project — it's
  not used by local dev right now.

## Sample property database

On first boot the app seeds 10 live listings (7 in Dubai, 3 in Abu Dhabi) (fixed ids `seed-prop-01`…`10`)
from three sample provider accounts. That's the same portfolio as the HTML
prototypes: Marina Property Management, Meadows Estates and Skyline Leasing Co.
Each listing has two abstract illustrated photos (exterior + interior) in
`public/properties/`, generated by `node scripts/generate-property-art.mjs`.

- Browse and filter them at **/listings** (any signed-in account). Tenants see
  match scores from their saved preferences.
- The seed is idempotent and never overwrites edits. Delete
  `data/leasematch.db` to start fresh, or set `LEASEMATCH_DISABLE_SEED=1`
  to skip it.
- The two JLT 1-bed apartments are deliberately comparable, and
  "1BR Corniche Tower — open to offers" is priced 28% above the other. Apply to
  it as a tenant, approve as Skyline, and the sign-step pricing nudge appears.

**Sample provider logins** (local test accounts, see `lib/seed.ts`). All
three use the password in `SAMPLE_PROVIDER_PASSWORD` in `lib/seed.ts`:
- `marina.pm@sample.leasematch.test` (property manager)
- `meadows@sample.leasematch.test` (broker)
- `owner.skyline@sample.leasematch.test` (owner)

**Demo tenant** (seeded, with Dubai Marina / JLT preferences):
`demo.tenant@leasematchuae.test` / `LeaseMatch-tenant-2026` (see `demoTenant`
in `lib/seed.ts`).

## Market search (Bayut & Dubizzle)

Tenants: **Dashboard → Market search** (`/dashboard/market`). Enter an area,
type, bedrooms and budget, and the agent runs real searches through
OpenAI's hosted web search tool, restricted to bayut.com and dubizzle.com.
Nothing is scraped: LeaseMatch never fetches either site itself. The agent
reports results through a strict tool, and **every URL is checked against
the URLs the search actually returned**. Anything else is dropped. Ads are
labelled unverified. A search takes roughly 30–90 seconds and uses
`OPENAI_API_KEY` (Responses API, model from `OPENAI_MODEL`, default
`gpt-5.5`; see `lib/market-search.ts`).

## Emailing an advertiser

From any market-search result, **Email advertiser** opens a composer
prefilled from the ad. "To" is the email shown on the ad when the search
surfaced one. Portals usually hide it behind a contact button, so you paste
it in; the agent never guesses addresses. Sending creates an External
inquiry thread:
- With Mailgun configured (see above), it sends for real, with a reply-to
  relay so replies land back in the thread.
- Without Mailgun, it's saved as a draft and the inquiry page offers **Open in
  my email app** (a `mailto:` link with the text filled in) plus **I've
  sent it** to mark the thread as sent. "Save draft" also works now without
  Mailgun; before, that button was disabled.

## Simulated agent phone calls

On a market-search result or an external inquiry, **Start simulated call**
plays an AI agent phoning the advertiser: dialling, ringing, a live
transcript, and an optional browser text-to-speech voice. **No call is placed.**
The transcript is scripted (`lib/call-script.ts`) from the ad's real details.
You can pick the landlord's response (available / negotiable / already rented
/ voicemail) or let it choose. The agent always opens by saying it's an AI
calling for a tenant, and never agrees to anything on the tenant's behalf.
Finished calls are saved to **/dashboard/calls** and shown on the ad and
inquiry pages.

## Demos & simulations

**/demos** links the original HTML prototypes (copied into `public/demos/`)
and the new **agent outreach simulation**
(`public/simulations/agent-outreach.html`). The simulation is a scripted,
self-contained walkthrough: the agent searches Bayut/Dubizzle, shortlists,
contacts landlords through a portal enquiry form, portal chat and email,
handles replies, phones a phone-only listing, then moves the best lead into a
verified LeaseMatch chat and negotiates, getting tenant approval at each step.
It has play/pause, next step, 1×/2×/4× speed and clickable chapters
(Space = pause, → = next).
