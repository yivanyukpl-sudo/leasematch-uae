# Builds the three click-through role simulations in public/simulations/roles/.
# Edit the scenes here and run: python3 scripts/build-role-sims.py
import json, os, html

OUT = os.path.join(os.path.dirname(__file__), "..", "public", "simulations", "roles")

def H(app_title, sub=""):
    return f'<div class="s-head"><b>{app_title}</b><span>{sub}</span></div>'

def nav(on):
    items = [("🏠", "Home"), ("🔎", "Search"), ("📄", "Deals"), ("👤", "Profile")]
    return '<div class="s-nav">' + "".join(f'<div class="{"on" if k==on else ""}"><span>{i}</span>{t}</div>' for k,(i,t) in enumerate(items)) + "</div>"

def page(role, title, lede, scenes):
    tabs = [("tenant", "Tenant"), ("owner", "Landlord"), ("agent", "Agent")]
    roles = "".join(f'<a href="{k}.html"{" aria-current=\"page\"" if k==role else ""}>{t}</a>' for k,t in tabs)
    return f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>{html.escape(title)}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap">
<link rel="stylesheet" href="engine.css"></head><body>
<div class="wrap">
  <div class="top"><div class="brand">Lease<span>Match</span> UAE</div><nav class="roles" aria-label="Roles">{roles}<a href="/demos">← All demos</a></nav></div>
  <h1>{html.escape(title)}</h1>
  <p class="lede">{html.escape(lede)}</p>
  <div class="grid">
    <section class="panel">
      <div class="count" id="count"></div>
      <h2 id="title"></h2>
      <p id="text"></p>
      <div class="tip" id="tip"><span></span></div>
      <div class="bar"><i id="bar"></i></div>
      <div class="ctrl"><button class="b-ghost" id="prev" type="button"></button><button class="b-main" id="next" type="button"></button></div>
      <ol class="list" id="list"></ol>
    </section>
    <div class="phone" aria-label="App screen"><div class="notch"><i></i></div><div class="app" id="app" aria-live="polite"></div></div>
  </div>
  <footer>Simulation with sample data. Payments, calls and documents are not real.</footer>
</div>
<script>window.SIM={json.dumps({"lang":"en","scenes":scenes}, ensure_ascii=False)};</script>
<script src="engine.js"></script></body></html>'''

tenant = [
 {"title":"Sign up as a tenant","text":"Pick “I'm looking for a home”. Search and the AI agent are free for tenants, with no agency fee.","tip":"Tap “Looking for a home”",
  "screen": H("LeaseMatch","Sign up")+'<div class="s-body"><p class="s-title">Who are you?</p><div class="s-card" data-hot="Tap"><b>🏠 Looking for a home</b><div class="s-muted">Tenant · no agency fee</div></div><div class="s-card"><b>🔑 Renting out a home</b><div class="s-muted">Landlord</div></div><div class="s-card"><b>🏢 Agent / broker</b><div class="s-muted">Commission paid by the landlord</div></div></div>'},
 {"title":"Your preferences","text":"Area, annual budget in AED, bedrooms, furnished, number of cheques. The agent uses these for your match score.","tip":"Tap “Save”",
  "screen": H("Preferences")+'<div class="s-body"><div class="s-input filled">Abu Dhabi · Al Reem Island</div><div class="s-input filled">Up to AED 90,000 / year · 4 cheques</div><div class="s-row"><span class="s-chip gold">1 bedroom</span><span class="s-chip gold">Furnished</span><span class="s-chip">Near Hub71</span></div><div class="s-btn" data-hot="Tap">Save</div></div>'+nav(3)},
 {"title":"Listings with a match score","text":"Only verified landlords. The score shows how well each home fits you.","tip":"Open the first listing",
  "screen": H("Listings","3 homes")+'<div class="s-body"><div class="s-card" data-hot="Open"><div class="s-img"></div><div class="s-between" style="margin-top:8px"><b>1BR in Sun Tower, Al Reem</b><span class="s-chip ok">91%</span></div><div class="s-muted">AED 85,000/year · verified landlord · no agency fee</div></div><div class="s-card"><b>Studio, Al Maryah Island</b><div class="s-muted">AED 72,000/year · 78%</div></div></div>'+nav(1)},
 {"title":"Nothing found? Stay","text":"If nothing matches, don't go back to portals and agency fees. Tap “Notify me” — we'll email you when a landlord, or an agent who charges the landlord, adds a matching home.","tip":"Tap “Notify me”",
  "screen": H("Listings","0 homes")+'<div class="s-body"><div class="s-card"><div style="font-size:28px">🔔</div><p class="s-title">Nothing yet — stay with us</p><p class="s-muted">New homes from landlords appear every day. We’ll email you, and the agent keeps looking.</p><div class="s-input filled">Saadiyat · up to AED 70,000</div><div class="s-btn" data-hot="Tap" style="margin-top:8px">Notify me</div></div></div>'+nav(1)},
 {"title":"Chat with the AI agent","text":"Write in your own words. The agent searches, checks your budget honestly and warns about holding-deposit scams.","tip":"Tap “Apply”",
  "screen": H("AI agent")+'<div class="s-body"><div class="s-bubble me">1 bedroom near Hub71 under 90k, furnished</div><div class="s-bubble ai">Found one: 1BR in Sun Tower, Al Reem, AED 85,000/year, furnished, verified landlord. 91% match. Shall I apply?</div><div class="s-btn" data-hot="Tap">Apply</div></div>'+nav(0)},
 {"title":"Deal assistant","text":"Once approved, the assistant guides every step: terms, package, photo inspection, signatures, payment and keys.","tip":"Review the landlord's terms",
  "screen": H("Lease","Deal assistant")+'<div class="s-body"><div class="s-steps"><span class="d">✓ Approved</span><span class="c">Terms</span><span>Package</span><span>Inspection</span><span>Sign</span><span>Pay</span></div><div class="s-bubble ai">The landlord proposed: from 1 Dec, 12 months, deposit AED 4,250, 4 cheques, utilities paid by you.</div><div class="s-btn" data-hot="Tap">Review terms</div></div>'+nav(2)},
 {"title":"Package: AED 99, 149 or combo 199","text":"Contract — AED 99, Protected payment — AED 149, Combo — AED 199. Even if you go to the landlord directly, a contract and a lawyer cost more, so leaving the app doesn't save money, and here we guarantee the contract and an honest payment.","tip":"Choose “Combo”",
  "screen": H("LeaseMatch package")+'<div class="s-body"><div class="s-card"><b>Contract, done right</b><div class="s-price">AED 99</div><div class="s-muted">Template, e-signature, condition report</div></div><div class="s-card"><b>Protected payment</b><div class="s-price">AED 149</div><div class="s-muted">Protected checkout, keys after payment</div></div><div class="s-card" data-hot="Choose" style="border-color:var(--gold-b)"><span class="s-chip gold">Best value</span><b style="display:block;margin-top:4px">Combo</b><div class="s-price">AED 199 <span class="s-strike">248</span></div></div><div class="s-muted">Why not go direct? A contract and lawyer cost more anyway.</div></div>'},
 {"title":"AI photo inspection","text":"The assistant walks you room by room and says what to shoot. The AI rates each photo and flags damp, cracks, dirty AC filters.","tip":"Photograph the bathroom",
  "screen": H("Photo inspection","Step 3 of 7")+'<div class="s-body"><div class="s-steps"><span class="d">✓ Entrance</span><span class="d">✓ Kitchen</span><span class="c">Bathrooms</span><span>Rooms</span><span>Windows</span><span>AC</span></div><p class="s-title">🛁 Bathrooms</p><div class="s-muted">☐ Wide shot ☐ Grout and ceiling corners ☐ Water heater ☐ Fittings</div><div class="s-card" data-hot="Take photo" style="text-align:center"><div style="font-size:30px">📷</div><b>Take a photo</b></div></div>'},
 {"title":"The AI warns you","text":"The AI spotted possible mould in a ceiling corner. Raise it with the landlord before signing, in the deal chat.","tip":"Tap “Discuss with landlord”",
  "screen": H("Photo inspection","Result")+'<div class="s-body"><div class="s-card" style="background:var(--bad-soft)"><b style="color:var(--bad)">Important: possible mould in a ceiling corner</b><div class="s-muted">Sign of damp and weak ventilation.</div></div><div class="s-card"><b>Minor: discoloured grout</b><div class="s-muted">Note it in the condition report.</div></div><div class="s-btn" data-hot="Tap">Discuss with landlord</div></div>'},
 {"title":"Sign and pay","text":"Review the contract and sign. Pay the first cheque through the protected payment; the landlord confirms receipt.","tip":"Sign the contract",
  "screen": H("Lease")+'<div class="s-body"><div class="s-card"><b>Residential tenancy contract</b><div class="s-muted">1. 12 months from 1 Dec 2026<br>2. AED 85,000/year in 4 cheques<br>3. Deposit AED 4,250<br>4. Ready for Tawtheeq</div></div><div class="s-input filled">Priya Raman</div><div class="s-btn" data-hot="Tap">Sign contract</div></div>'},
 {"title":"Keys","text":"The lease is in force. Collect keys only in person at the property, with the photo condition report.","tip":"Finish",
  "screen": H("Lease","Active")+'<div class="s-body"><div class="s-card" style="background:var(--ok-soft)"><b style="color:var(--ok)">✓ Lease in force</b><div class="s-muted">Payment confirmed by the landlord.</div></div><div class="s-card">🔑 <b>Key handover</b><div class="s-muted">In person, with the condition report and meter readings.</div></div><div class="s-btn ok" data-hot="Tap">Got it</div></div>'},
]

owner = [
 {"title":"Sign up as a landlord","text":"Pick “Renting out a home”. Listing is free and tenants pay no agency fee.","tip":"Tap “Renting out a home”",
  "screen": H("LeaseMatch","Sign up")+'<div class="s-body"><p class="s-title">Who are you?</p><div class="s-card"><b>🏠 Looking for a home</b></div><div class="s-card" data-hot="Tap"><b>🔑 Renting out a home</b><div class="s-muted">Landlord · free</div></div><div class="s-card"><b>🏢 Agent / broker</b></div></div>'},
 {"title":"New listing","text":"Title, area, annual rent in AED, bedrooms, furnished, amenities.","tip":"Tap “Publish”",
  "screen": H("New listing")+'<div class="s-body"><div class="s-input filled">1BR in Sun Tower, Al Reem Island</div><div class="s-input filled">AED 85,000/year · furnished</div><div class="s-row"><span class="s-chip gold">Pool</span><span class="s-chip gold">Gym</span><span class="s-chip">Covered parking</span></div><div class="s-btn" data-hot="Tap">Publish</div></div>'},
 {"title":"AI photo inspection for the listing","text":"The AI suggests what to fix before tenants see it: dark photos, visible defects, AC needing a service.","tip":"Review the AI's tips",
  "screen": H("Photo inspection","Listing quality")+'<div class="s-body"><div class="s-card"><b>Kitchen ★★★★☆</b><div class="s-muted">Photo is dark — retake in daylight.</div></div><div class="s-card"><b>AC ★★★☆☆</b><div class="s-muted">Dirty filter — service before viewings.</div></div><div class="s-btn" data-hot="Tap">Got it</div></div>'},
 {"title":"Live — tenants are waiting","text":"No applications yet? No need to go to brokers or portals: we'll email you when a tenant appears, and show how many are already waiting.","tip":"Turn on notifications",
  "screen": H("Dashboard")+'<div class="s-body"><div class="s-card" style="background:var(--ok-soft)"><b style="color:var(--ok)">✓ Listing is live</b></div><div class="s-card"><div style="font-size:26px">⏳</div><b>No applications yet</b><div class="s-muted">3 tenants are waiting for a home in your area.</div><div class="s-btn" data-hot="Tap" style="margin-top:8px">Notify me about new tenants</div></div></div>'+nav(0)},
 {"title":"New application","text":"You see the tenant's job, income, move-in date and match score.","tip":"Approve the application",
  "screen": H("Applications")+'<div class="s-body"><div class="s-card"><div class="s-between"><b>Priya R.</b><span class="s-chip ok">91% match</span></div><div class="s-muted">Product manager at a Hub71 startup · move-in 1 Dec</div><div class="s-row" style="margin-top:8px"><span class="s-btn ok" data-hot="Approve" style="width:auto;padding:8px 14px">Approve</span><span class="s-btn ghost" style="width:auto;padding:8px 14px">Decline</span></div></div></div>'+nav(2)},
 {"title":"Contract terms","text":"The deal assistant asks for the terms: move-in date, length, deposit, cheques, utilities.","tip":"Save the terms",
  "screen": H("Lease","Deal assistant")+'<div class="s-body"><div class="s-bubble ai">Step 1 of 5. Fill in the terms — the tenant sees them straight away.</div><div class="s-input filled">Move-in 1 Dec 2026 · 12 months</div><div class="s-input filled">Deposit AED 4,250 · 4 cheques</div><div class="s-input filled">Utilities — paid by the tenant</div><div class="s-btn" data-hot="Tap">Save terms</div></div>'},
 {"title":"The tenant picks a package","text":"The tenant pays for the package — it's free for you. After that, you can sign.","tip":"Next",
  "screen": H("Lease")+'<div class="s-body"><div class="s-card" style="background:var(--ok-soft)"><b style="color:var(--ok)">✓ Tenant paid for “Combo”</b><div class="s-muted">Contract + protected payment</div></div><div class="s-btn" data-hot="Tap">To signing</div></div>'},
 {"title":"Landlord signature","text":"Review the contract and sign in the app.","tip":"Sign",
  "screen": H("Lease")+'<div class="s-body"><div class="s-card"><b>Residential tenancy contract</b><div class="s-muted">12 months · AED 85,000/year · 4 cheques</div></div><div class="s-input filled">Rashid Al Mansoori</div><div class="s-btn" data-hot="Tap">Sign</div></div>'},
 {"title":"Payment and keys","text":"The tenant paid through the protected checkout. Confirm receipt, then hand over the keys with the photo condition report.","tip":"Confirm payment",
  "screen": H("Lease")+'<div class="s-body"><div class="s-card"><b>First cheque: AED 21,250</b><div class="s-muted">Protected checkout · receipt #48211</div></div><div class="s-btn ok" data-hot="Tap">Confirm receipt</div></div>'},
]

agent = [
 {"title":"Sign up as an agent","text":"On LeaseMatch, agents work transparently: the commission is paid by the landlord, never the tenant.","tip":"Pick “Agent / broker”",
  "screen": H("LeaseMatch","Sign up")+'<div class="s-body"><div class="s-card"><b>🏠 Looking for a home</b></div><div class="s-card"><b>🔑 Renting out a home</b></div><div class="s-card" data-hot="Tap"><b>🏢 Agent / broker</b><div class="s-muted">Commission paid by the landlord, not the tenant</div></div></div>'},
 {"title":"Company details","text":"Agency name and broker registration. Tenants see the listing is from an agent — no posing as the owner.","tip":"Create the account",
  "screen": H("Agent")+'<div class="s-body"><div class="s-input filled">Gulf Keys Real Estate</div><div class="s-input filled">Broker card no. 12345 (sample)</div><div class="s-btn" data-hot="Tap">Create account</div></div>'},
 {"title":"List on behalf of a landlord","text":"Add the home and note that the landlord pays your commission. It shows clearly on the card.","tip":"Publish",
  "screen": H("New listing")+'<div class="s-body"><div class="s-input filled">2BR, Al Raha Beach · AED 140,000/year</div><div class="s-row"><span class="s-chip gold">Commission: paid by the landlord</span></div><div class="s-btn" data-hot="Tap">Publish</div></div>'},
 {"title":"Transparent label","text":"Tenants see “Agent · commission paid by the landlord”. More trust, more applications.","tip":"Next",
  "screen": H("How tenants see it")+'<div class="s-body"><div class="s-card"><div class="s-img"></div><b style="display:block;margin-top:8px">2BR, Al Raha Beach</b><div class="s-muted">AED 140,000/year</div><div class="s-row" style="margin-top:6px"><span class="s-chip">🏢 Gulf Keys</span><span class="s-chip ok">No fee for tenant</span></div></div><div class="s-btn" data-hot="Tap">Next</div></div>'},
 {"title":"Tenants waiting","text":"No applications? No need to repost on portals. Turn on alerts: LeaseMatch tenants are already waiting in your areas.","tip":"Turn on notifications",
  "screen": H("Agent dashboard")+'<div class="s-body"><div class="s-card"><div style="font-size:26px">⏳</div><b>5 tenants waiting for 2BR in Abu Dhabi</b><div class="s-muted">We’ll email you when a new one arrives.</div><div class="s-btn" data-hot="Tap" style="margin-top:8px">Notify me about new tenants</div></div></div>'+nav(0)},
 {"title":"Application and deal","text":"Approve — then the deal assistant guides the tenant and landlord: terms, package, signatures, payment.","tip":"Approve the application",
  "screen": H("Applications")+'<div class="s-body"><div class="s-card"><div class="s-between"><b>Omar K.</b><span class="s-chip ok">87% match</span></div><div class="s-muted">Engineer · move-in 15 Jan</div><div class="s-btn ok" data-hot="Approve" style="margin-top:8px">Approve</div></div></div>'},
 {"title":"Contract and keys","text":"The landlord and tenant sign; the agent supports. The tenant pays no commission — only a LeaseMatch package if they choose one.","tip":"Finish",
  "screen": H("Deal")+'<div class="s-body"><div class="s-steps"><span class="d">✓ Terms</span><span class="d">✓ Package</span><span class="d">✓ Signed</span><span class="d">✓ Paid</span><span class="c">Keys</span></div><div class="s-card" style="background:var(--ok-soft)"><b style="color:var(--ok)">✓ Lease in force</b></div><div class="s-btn ok" data-hot="Tap">Done</div></div>'},
]

for role, title, lede, sc in [
  ("tenant","Simulation: tenant","Find a home without agency fees, from preferences to keys. Tap the highlighted buttons on the phone.",tenant),
  ("owner","Simulation: landlord","Rent out directly: listing, applications, contract and payment in one place.",owner),
  ("agent","Simulation: agent","How agents work transparently on LeaseMatch: the landlord pays the commission, never the tenant.",agent),
]:
    open(os.path.join(OUT, f"{role}.html"), "w").write(page(role, title, lede, sc))
print("built", len(tenant), len(owner), len(agent))
