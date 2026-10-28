# Builds the three click-through role simulations in public/simulations/roles/.
# Edit the scenes here and run: python3 scripts/build-role-sims.py
import json, os, html

OUT = os.path.join(os.path.dirname(__file__), "..", "public", "simulations", "roles")

def H(app_title, sub=""):
    return f'<div class="s-head"><b>{app_title}</b><span>{sub}</span></div>'

def nav(on):
    items = [("🏠", "Home"), ("🔎", "Search"), ("📄", "Deals"), ("👤", "Profile")]
    return '<div class="s-nav">' + "".join(f'<div class="{"on" if k==on else ""}"><span>{i}</span>{t}</div>' for k,(i,t) in enumerate(items)) + "</div>"


def steps(done, cur, items=("Terms","Package","Sign","Proof of payment","Proof of receipt","Concluded","Keys")):
    out = []
    for k, t in enumerate(items):
        cls = "d" if k < done else ("c" if k == cur else "")
        out.append(f'<span class="{cls}">{"✓ " if k < done else ""}{t}</span>')
    return '<div class="s-steps">' + "".join(out) + "</div>"

def tipbox(t):
    return f'<div class="s-card" style="background:var(--gold-soft,#f4ebdb);font-size:12px">💡 <b>Tip:</b> {t}</div>'

def proof(label, who, amount="AED 21,250", ref="TRX 48211"):
    return f'<div class="s-card"><div class="s-between"><b>🧾 {label}</b><span class="s-chip ok">✓ attached</span></div><div class="s-muted">{amount} · {ref} · by {who} · Open file</div></div>'

MODAL = ('<div style="position:relative"><div class="s-body" style="opacity:.35">' + '<div class="s-card"><b>Key handover</b></div></div>'
  '<div class="s-card" style="position:absolute;inset:8px 6px auto;box-shadow:0 12px 40px rgba(0,0,0,.25);background:#fff">'
  '<b style="font-size:15px">How do you want to receive the keys?</b><div class="s-muted">Separate window · the landlord confirms</div>'
  '<div class="s-row" style="margin-top:8px"><span class="s-chip gold">🤝 In hand</span><span class="s-chip">📦 By mail</span></div>'
  '<div class="s-input filled">📅 30 Nov 2026 · 🕙 10:00</div>'
  '<div class="s-input filled">📍 At the apartment: 1BR JLT, Cluster D</div>'
  '<div class="s-muted">or “Another location”, e.g. the agency office · By mail: address, recipient, phone</div>'
  '<div class="s-btn" data-hot="Send" style="margin-top:8px">Send to landlord</div></div></div>')

def history(role_other):
    return (H("Leases","Full history")+'<div class="s-body"><div class="s-row"><span class="s-chip ok">Active 1</span><span class="s-chip">In progress 0</span><span class="s-chip">Finished 2</span></div>'
      f'<p class="s-title">Active leases</p><div class="s-card"><b>1BR in JLT, Cluster D</b><div class="s-muted">{role_other} · 1 Dec 2026 → 30 Nov 2027 · keys received</div></div>'
      '<p class="s-title">Finished leases</p><div class="s-card"><b>Studio, Al Barsha</b><div class="s-muted">Nov 2024 → Oct 2025 · ended</div></div>'
      '<div class="s-card"><b>1BR, Business Bay</b><div class="s-muted">Nov 2023 → Oct 2024 · ended</div></div>'
      '<div class="s-btn" data-hot="Tap">Open the signed contract</div></div>')

def page(role, title, lede, scenes):
    tabs = [("tenant", "Tenant"), ("owner", "Landlord"), ("agent", "Agent"), ("lease", "Lease conclusion")]
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
  "screen": H("Preferences")+'<div class="s-body"><div class="s-input filled">Dubai · Dubai Marina, JLT</div><div class="s-input filled">Up to AED 110,000 / year · 4 cheques</div><div class="s-row"><span class="s-chip gold">1 bedroom</span><span class="s-chip gold">Furnished</span><span class="s-chip">Near the metro</span></div><div class="s-btn" data-hot="Tap">Save</div></div>'+nav(3)},
 {"title":"Listings with a match score","text":"Only verified landlords. The score shows how well each home fits you.","tip":"Open the first listing",
  "screen": H("Listings","3 homes")+'<div class="s-body"><div class="s-card" data-hot="Open"><div class="s-img"></div><div class="s-between" style="margin-top:8px"><b>1BR in JLT, Cluster D</b><span class="s-chip ok">91%</span></div><div class="s-muted">AED 85,000/year · verified landlord · no agency fee</div></div><div class="s-card"><b>Studio, Al Barsha</b><div class="s-muted">AED 55,000/year · 78%</div></div></div>'+nav(1)},
 {"title":"Nothing found? Stay","text":"If nothing matches, don't go back to portals and agency fees. Tap “Notify me” — we'll email you when a landlord, or an agent who charges the landlord, adds a matching home.","tip":"Tap “Notify me”",
  "screen": H("Listings","0 homes")+'<div class="s-body"><div class="s-card"><div style="font-size:28px">🔔</div><p class="s-title">Nothing yet — stay with us</p><p class="s-muted">New homes from landlords appear every day. We’ll email you, and the agent keeps looking.</p><div class="s-input filled">Palm Jumeirah · up to AED 70,000</div><div class="s-btn" data-hot="Tap" style="margin-top:8px">Notify me</div></div></div>'+nav(1)},
 {"title":"Chat with the AI agent","text":"Write in your own words. The agent searches, checks your budget honestly and warns about holding-deposit scams.","tip":"Tap “Apply”",
  "screen": H("AI agent")+'<div class="s-body"><div class="s-bubble me">1 bedroom near Dubai Internet City under 110k, furnished</div><div class="s-bubble ai">Found one: 1BR in JLT Cluster D, AED 85,000/year, furnished, 5 minutes to the metro, verified landlord. 91% match. Shall I apply?</div><div class="s-btn" data-hot="Tap">Apply</div></div>'+nav(0)},
 {"title":"Deal assistant","text":"Once approved, the lease page shows every step in order, each with a tip: terms, package, photo inspection, both signatures, both payment confirmations, automatic conclusion and keys.","tip":"Review the landlord's terms",
  "screen": H("Lease","Deal assistant")+'<div class="s-body">'+steps(0,0)+'<div class="s-bubble ai">The landlord proposed: from 1 Dec, 12 months, deposit AED 4,250, 4 cheques, utilities paid by you.</div><div class="s-btn" data-hot="Tap">Review terms</div></div>'+nav(2)},
 {"title":"Package: AED 99, 149 or combo 199","text":"Contract — AED 99, Protected payment — AED 149, Combo — AED 199. Even if you go to the landlord directly, a contract and a lawyer cost more, so leaving the app doesn't save money, and here we guarantee the contract and an honest payment.","tip":"Choose “Combo”",
  "screen": H("LeaseMatch package")+'<div class="s-body"><div class="s-card"><b>Contract, done right</b><div class="s-price">AED 99</div><div class="s-muted">Template, e-signature, condition report</div></div><div class="s-card"><b>Protected payment</b><div class="s-price">AED 149</div><div class="s-muted">Protected checkout, keys after payment</div></div><div class="s-card" data-hot="Choose" style="border-color:var(--gold-b)"><span class="s-chip gold">Best value</span><b style="display:block;margin-top:4px">Combo</b><div class="s-price">AED 199 <span class="s-strike">248</span></div></div><div class="s-muted">Why not go direct? A contract and lawyer cost more anyway.</div></div>'},
 {"title":"AI photo inspection","text":"The assistant walks you room by room and says what to shoot. The AI rates each photo and flags damp, cracks, dirty AC filters.","tip":"Photograph the bathroom",
  "screen": H("Photo inspection","Step 3 of 7")+'<div class="s-body"><div class="s-steps"><span class="d">✓ Entrance</span><span class="d">✓ Kitchen</span><span class="c">Bathrooms</span><span>Rooms</span><span>Windows</span><span>AC</span></div><p class="s-title">🛁 Bathrooms</p><div class="s-muted">☐ Wide shot ☐ Grout and ceiling corners ☐ Water heater ☐ Fittings</div><div class="s-card" data-hot="Take photo" style="text-align:center"><div style="font-size:30px">📷</div><b>Take a photo</b></div></div>'},
 {"title":"The AI warns you","text":"The AI spotted possible mould in a ceiling corner. Raise it with the landlord before signing, in the deal chat.","tip":"Tap “Discuss with landlord”",
  "screen": H("Photo inspection","Result")+'<div class="s-body"><div class="s-card" style="background:var(--bad-soft)"><b style="color:var(--bad)">Important: possible mould in a ceiling corner</b><div class="s-muted">Sign of damp and weak ventilation.</div></div><div class="s-card"><b>Minor: discoloured grout</b><div class="s-muted">Note it in the condition report.</div></div><div class="s-btn" data-hot="Tap">Discuss with landlord</div></div>'},
 {"title":"Sign the contract","text":"Review the contract built from your terms and sign with your full name. The landlord signs too; order doesn't matter.","tip":"Sign the contract",
  "screen": H("Lease","Step 3")+steps(2,2)+'<div class="s-body"><div class="s-card"><b>Residential tenancy contract</b><div class="s-muted">1. 12 months from 1 Dec 2026<br>2. AED 85,000/year in 4 cheques<br>3. Deposit AED 4,250<br>4. Ready for Ejari</div></div><div class="s-input filled">Priya Raman</div><div class="s-btn" data-hot="Tap">Sign contract</div></div>'},
 {"title":"Pay and attach proof of payment","text":"Pay the first cheque, AED 21,250, then attach the confirmation: a bank transfer receipt, a photo of the cheque or a screenshot (PDF, JPG or PNG).","tip":"Tap “Attach confirmation”",
  "screen": H("Lease","Step 4")+steps(3,3)+'<div class="s-body">'+tipbox("Pay the first cheque and attach the confirmation. The landlord sees it straight away.")+'<div class="s-input filled">Amount: AED 21,250</div><div class="s-input filled">Reference: TRX 48211</div><div class="s-input filled">📎 transfer-receipt.pdf</div><div class="s-btn" data-hot="Tap">Attach confirmation</div></div>'},
 {"title":"Landlord confirms receipt","text":"The landlord checks the money arrived and attaches their proof of receipt. Both of you can open both files.","tip":"Next",
  "screen": H("Lease","Step 5")+steps(4,4)+'<div class="s-body">'+proof("Proof of payment","you")+'<div class="s-card"><b>⏳ Waiting for the landlord</b><div class="s-muted">Proof of receipt: bank statement line or receipt</div></div><div class="s-btn" data-hot="Tap">Next</div></div>'},
 {"title":"Agreement concluded automatically","text":"As soon as both confirmations are attached, LeaseMatch concludes the agreement by itself: the property is marked as leased and the signed contract appears. Nobody presses a button.","tip":"Choose how to receive the keys",
  "screen": H("Lease","Concluded")+steps(6,6)+'<div class="s-body">'+proof("Proof of payment","you")+proof("Proof of receipt","Rashid", ref="Statement ref 0931")+'<div class="s-card" style="background:var(--ok-soft)"><b style="color:var(--ok)">✓ Concluded automatically</b><div class="s-muted">Both confirmations attached · 28 Nov 2026, 14:02</div></div><div class="s-btn" data-hot="Tap">🔑 Choose how to receive the keys</div></div>'},
 {"title":"Key handover window","text":"A separate window: in hand at a meeting with the landlord (pick date, time and place: the apartment or another location) or by mail to an address you give.","tip":"Tap “Send to landlord”",
  "screen": H("Lease","Key handover")+MODAL},
 {"title":"Keys received","text":"The landlord confirms your choice. At the meeting, check the meters and the condition report, then press “I received the keys”.","tip":"Tap “I received the keys”",
  "screen": H("Lease","Key handover")+steps(6,6)+'<div class="s-body"><div class="s-card"><b>🤝 In hand at a meeting</b><div class="s-muted">30 Nov 2026 at 10:00 · at the apartment</div><div class="s-muted">✓ Confirmed by the landlord</div></div><div class="s-btn ok" data-hot="Tap">I received the keys</div></div>'},
 {"title":"Your lease history","text":"Leases in the header shows your full history: active leases, deals in progress and finished leases. Open any of them to see the contract, payments and handover.","tip":"Open the signed contract",
  "screen": history("Landlord: Rashid")},
]

owner = [
 {"title":"Sign up as a landlord","text":"Pick “Renting out a home”. Listing is free and tenants pay no agency fee.","tip":"Tap “Renting out a home”",
  "screen": H("LeaseMatch","Sign up")+'<div class="s-body"><p class="s-title">Who are you?</p><div class="s-card"><b>🏠 Looking for a home</b></div><div class="s-card" data-hot="Tap"><b>🔑 Renting out a home</b><div class="s-muted">Landlord · free</div></div><div class="s-card"><b>🏢 Agent / broker</b></div></div>'},
 {"title":"New listing","text":"Title, area, annual rent in AED, bedrooms, furnished, amenities.","tip":"Tap “Publish”",
  "screen": H("New listing")+'<div class="s-body"><div class="s-input filled">1BR in JLT, Cluster D</div><div class="s-input filled">AED 85,000/year · furnished</div><div class="s-row"><span class="s-chip gold">Pool</span><span class="s-chip gold">Gym</span><span class="s-chip">Covered parking</span></div><div class="s-btn" data-hot="Tap">Publish</div></div>'},
 {"title":"AI photo inspection for the listing","text":"The AI suggests what to fix before tenants see it: dark photos, visible defects, AC needing a service.","tip":"Review the AI's tips",
  "screen": H("Photo inspection","Listing quality")+'<div class="s-body"><div class="s-card"><b>Kitchen ★★★★☆</b><div class="s-muted">Photo is dark — retake in daylight.</div></div><div class="s-card"><b>AC ★★★☆☆</b><div class="s-muted">Dirty filter — service before viewings.</div></div><div class="s-btn" data-hot="Tap">Got it</div></div>'},
 {"title":"Live — tenants are waiting","text":"No applications yet? No need to go to brokers or portals: we'll email you when a tenant appears, and show how many are already waiting.","tip":"Turn on notifications",
  "screen": H("Dashboard")+'<div class="s-body"><div class="s-card" style="background:var(--ok-soft)"><b style="color:var(--ok)">✓ Listing is live</b></div><div class="s-card"><div style="font-size:26px">⏳</div><b>No applications yet</b><div class="s-muted">3 tenants are waiting for a home in your area.</div><div class="s-btn" data-hot="Tap" style="margin-top:8px">Notify me about new tenants</div></div></div>'+nav(0)},
 {"title":"New application","text":"You see the tenant's job, income, move-in date and match score.","tip":"Approve the application",
  "screen": H("Applications")+'<div class="s-body"><div class="s-card"><div class="s-between"><b>Priya R.</b><span class="s-chip ok">91% match</span></div><div class="s-muted">Product manager at a Dubai Internet City firm · move-in 1 Dec</div><div class="s-row" style="margin-top:8px"><span class="s-btn ok" data-hot="Approve" style="width:auto;padding:8px 14px">Approve</span><span class="s-btn ghost" style="width:auto;padding:8px 14px">Decline</span></div></div></div>'+nav(2)},
 {"title":"Contract terms","text":"The deal assistant asks for the terms: move-in date, length, deposit, cheques, utilities.","tip":"Save the terms",
  "screen": H("Lease","Deal assistant")+'<div class="s-body"><div class="s-bubble ai">Step 1 of 5. Fill in the terms — the tenant sees them straight away.</div><div class="s-input filled">Move-in 1 Dec 2026 · 12 months</div><div class="s-input filled">Deposit AED 4,250 · 4 cheques</div><div class="s-input filled">Utilities — paid by the tenant</div><div class="s-btn" data-hot="Tap">Save terms</div></div>'},
 {"title":"The tenant picks a package","text":"The tenant pays for the package — it's free for you. After that, you can sign.","tip":"Next",
  "screen": H("Lease")+'<div class="s-body"><div class="s-card" style="background:var(--ok-soft)"><b style="color:var(--ok)">✓ Tenant paid for “Combo”</b><div class="s-muted">Contract + protected payment</div></div><div class="s-btn" data-hot="Tap">To signing</div></div>'},
 {"title":"Landlord signature","text":"Review the contract and sign in the app.","tip":"Sign",
  "screen": H("Lease")+'<div class="s-body"><div class="s-card"><b>Residential tenancy contract</b><div class="s-muted">12 months · AED 85,000/year · 4 cheques</div></div><div class="s-input filled">Rashid Al Mansoori</div><div class="s-btn" data-hot="Tap">Sign</div></div>'},
 {"title":"Tenant's proof of payment arrives","text":"The tenant paid the first cheque and attached the proof. Open it and check your bank account.","tip":"Next",
  "screen": H("Lease","Step 5")+steps(4,4)+'<div class="s-body">'+proof("Proof of payment","Priya")+tipbox("Check the money arrived, then attach your proof of receipt. The agreement is concluded as soon as you do.")+'<div class="s-btn" data-hot="Tap">Next</div></div>'},
 {"title":"Attach proof of receipt","text":"Attach a bank statement line, a screenshot or a signed receipt. There's no separate confirm button: your proof is the confirmation.","tip":"Tap “Attach confirmation”",
  "screen": H("Lease","Step 5")+steps(4,4)+'<div class="s-body"><div class="s-input filled">Amount: AED 21,250</div><div class="s-input filled">Reference: statement 0931</div><div class="s-input filled">📎 bank-statement.png</div><div class="s-btn" data-hot="Tap">Attach confirmation</div></div>'},
 {"title":"Concluded automatically","text":"Both confirmations are in, so LeaseMatch concludes the agreement and marks your property as leased.","tip":"Next",
  "screen": H("Lease","Concluded")+steps(6,6)+'<div class="s-body"><div class="s-card" style="background:var(--ok-soft)"><b style="color:var(--ok)">✓ Concluded automatically</b><div class="s-muted">Property marked as leased · signed contract below</div></div><div class="s-card"><b>⏳ Key handover</b><div class="s-muted">Waiting for the tenant to choose: in hand or by mail</div></div><div class="s-btn" data-hot="Tap">Next</div></div>'},
 {"title":"Confirm the key handover","text":"The tenant chose to receive the keys in hand at the apartment. Confirm, or agree a change in the chat.","tip":"Tap “Confirm this handover”",
  "screen": H("Lease","Key handover")+'<div class="s-body"><div class="s-card"><b>🤝 In hand at a meeting</b><div class="s-muted">30 Nov 2026 at 10:00 · at the apartment</div><div class="s-muted">Note: please bring the access card</div></div><div class="s-btn" data-hot="Tap">Confirm this handover</div></div>'},
 {"title":"All your leases","text":"Leases shows every agreement on your units: active, in progress and finished, plus a per-property table with end dates and renewals due.","tip":"Open the signed contract",
  "screen": history("Tenant: Priya R.")},
]

agent = [
 {"title":"Sign up as an agent","text":"On LeaseMatch, agents work transparently: the commission is paid by the landlord, never the tenant.","tip":"Pick “Agent / broker”",
  "screen": H("LeaseMatch","Sign up")+'<div class="s-body"><div class="s-card"><b>🏠 Looking for a home</b></div><div class="s-card"><b>🔑 Renting out a home</b></div><div class="s-card" data-hot="Tap"><b>🏢 Agent / broker</b><div class="s-muted">Commission paid by the landlord, not the tenant</div></div></div>'},
 {"title":"Company details","text":"Agency name and broker registration. Tenants see the listing is from an agent — no posing as the owner.","tip":"Create the account",
  "screen": H("Agent")+'<div class="s-body"><div class="s-input filled">Gulf Keys Real Estate</div><div class="s-input filled">Broker card no. 12345 (sample)</div><div class="s-btn" data-hot="Tap">Create account</div></div>'},
 {"title":"List on behalf of a landlord","text":"Add the home and note that the landlord pays your commission. It shows clearly on the card.","tip":"Publish",
  "screen": H("New listing")+'<div class="s-body"><div class="s-input filled">2BR, Dubai Marina · AED 140,000/year</div><div class="s-row"><span class="s-chip gold">Commission: paid by the landlord</span></div><div class="s-btn" data-hot="Tap">Publish</div></div>'},
 {"title":"Transparent label","text":"Tenants see “Agent · commission paid by the landlord”. More trust, more applications.","tip":"Next",
  "screen": H("How tenants see it")+'<div class="s-body"><div class="s-card"><div class="s-img"></div><b style="display:block;margin-top:8px">2BR, Dubai Marina</b><div class="s-muted">AED 140,000/year</div><div class="s-row" style="margin-top:6px"><span class="s-chip">🏢 Gulf Keys</span><span class="s-chip ok">No fee for tenant</span></div></div><div class="s-btn" data-hot="Tap">Next</div></div>'},
 {"title":"Tenants waiting","text":"No applications? No need to repost on portals. Turn on alerts: LeaseMatch tenants are already waiting in your areas.","tip":"Turn on notifications",
  "screen": H("Agent dashboard")+'<div class="s-body"><div class="s-card"><div style="font-size:26px">⏳</div><b>5 tenants waiting for 2BR in Dubai Marina</b><div class="s-muted">We’ll email you when a new one arrives.</div><div class="s-btn" data-hot="Tap" style="margin-top:8px">Notify me about new tenants</div></div></div>'+nav(0)},
 {"title":"Application and deal","text":"Approve, then the lease page guides the tenant and landlord step by step: terms, package, signatures, both payment confirmations, automatic conclusion and keys.","tip":"Approve the application",
  "screen": H("Applications")+'<div class="s-body"><div class="s-card"><div class="s-between"><b>Omar K.</b><span class="s-chip ok">87% match</span></div><div class="s-muted">Engineer · move-in 15 Jan</div><div class="s-btn ok" data-hot="Approve" style="margin-top:8px">Approve</div></div></div>'},
 {"title":"Contract and keys","text":"The landlord and tenant sign and attach their payment confirmations; the platform concludes the agreement; the tenant picks how to get the keys. The agent supports. The tenant pays no commission — only a LeaseMatch package if they choose one.","tip":"Finish",
  "screen": H("Deal")+'<div class="s-body">'+steps(6,6)+'<div class="s-card">'+'🧾 Proof of payment ✓ · Proof of receipt ✓'+'</div><div class="s-card" style="background:var(--ok-soft)"><b style="color:var(--ok)">✓ Concluded automatically</b><div class="s-muted">Shows under Leases → Active for you, the landlord and the tenant</div></div><div class="s-btn ok" data-hot="Tap">Done</div></div>'},
]


lease = [
 {"title":"Every stage on one page","text":"After the landlord approves an application, both sides work on the same lease page. The current step is open with a tip; done steps collapse.","tip":"Open the terms step",
  "screen": H("Lease","Tenant view")+'<div class="s-body">'+"".join(f'<div class="s-card" style="padding:8px 10px"><div class="s-between"><b>{n}. {t}</b><span class="s-chip{c}">{st}</span></div></div>' for n,t,st,c in [(1,"Application approved","Done"," ok"),(2,"Contract terms","Your turn"," gold"),(3,"LeaseMatch package","Later",""),(4,"AI photo inspection","Optional",""),(5,"Both signatures","Later",""),(6,"Proof of payment (tenant)","Later",""),(7,"Proof of receipt (landlord)","Later",""),(8,"Agreement concluded","Automatic",""),(9,"Key handover","Later","")])+'<div class="s-btn" data-hot="Tap">Open “Contract terms”</div></div>'},
 {"title":"Landlord: contract terms","text":"Move-in date, length, deposit, cheques, utilities. The tenant sees them straight away and can discuss them in the chat.","tip":"Save the terms",
  "screen": H("Lease","Landlord view")+steps(0,0)+'<div class="s-body">'+tipbox("Fill in the terms; the tenant sees them straight away.")+'<div class="s-input filled">1 Dec 2026 · 12 months</div><div class="s-input filled">Deposit AED 4,250 · 4 cheques · utilities by tenant</div><div class="s-btn" data-hot="Tap">Save terms</div></div>'},
 {"title":"Tenant: package","text":"The tenant picks a package (AED 99 / 149 / combo 199). Signing unlocks once it's paid.","tip":"Choose “Combo”",
  "screen": H("Lease","Tenant view")+steps(1,1)+'<div class="s-body"><div class="s-card"><b>Contract</b> · AED 99</div><div class="s-card"><b>Protected payment</b> · AED 149</div><div class="s-card" data-hot="Choose" style="border-color:var(--gold-b)"><b>Combo</b> · AED 199</div></div>'},
 {"title":"Both sign","text":"Each side types their full name as on the account. Order doesn't matter.","tip":"Sign",
  "screen": H("Lease","Both sides")+steps(2,2)+'<div class="s-body"><div class="s-card"><b>Tenant</b> ✓ Priya Raman · 26 Nov 14:10</div><div class="s-input filled">Rashid Al Mansoori</div><div class="s-btn" data-hot="Tap">Sign as landlord</div></div>'},
 {"title":"Tenant: proof of payment","text":"The tenant pays the first cheque and attaches the confirmation (PDF, JPG or PNG).","tip":"Attach confirmation",
  "screen": H("Lease","Tenant view")+steps(3,3)+'<div class="s-body">'+tipbox("Attach a transfer receipt, cheque photo or screenshot.")+'<div class="s-input filled">AED 21,250 · TRX 48211</div><div class="s-input filled">📎 transfer-receipt.pdf</div><div class="s-btn" data-hot="Tap">Attach confirmation</div></div>'},
 {"title":"Landlord: proof of receipt","text":"The landlord opens the tenant's proof, checks the bank, and attaches a proof of receipt.","tip":"Attach confirmation",
  "screen": H("Lease","Landlord view")+steps(4,4)+'<div class="s-body">'+proof("Proof of payment","Priya")+'<div class="s-input filled">📎 bank-statement.png</div><div class="s-btn" data-hot="Tap">Attach confirmation</div></div>'},
 {"title":"Platform concludes the agreement","text":"Both confirmations are attached, so LeaseMatch concludes the agreement automatically and moves it to Leases → Active for both sides.","tip":"Next",
  "screen": H("Lease","Both sides")+steps(6,6)+'<div class="s-body">'+proof("Proof of payment","Priya")+proof("Proof of receipt","Rashid", ref="Statement 0931")+'<div class="s-card" style="background:var(--ok-soft)"><b style="color:var(--ok)">✓ Concluded automatically</b><div class="s-muted">No button: it happens when both proofs are in</div></div><div class="s-btn" data-hot="Tap">Next</div></div>'},
 {"title":"Tenant: how to receive the keys","text":"A separate window: in hand at a meeting (date, time, place) or by mail to an address.","tip":"Send to landlord",
  "screen": H("Lease","Tenant view")+MODAL},
 {"title":"Landlord confirms, tenant receives","text":"The landlord confirms the meeting; after the handover the tenant presses “I received the keys”. The deal is complete.","tip":"I received the keys",
  "screen": H("Lease","Both sides")+'<div class="s-body"><div class="s-card"><b>🤝 30 Nov 2026, 10:00 · at the apartment</b><div class="s-muted">✓ Confirmed by the landlord</div></div><div class="s-btn ok" data-hot="Tap">I received the keys</div></div>'},
 {"title":"Full history in Leases","text":"Every user sees their lease history: active, in progress and finished.","tip":"Open the signed contract",
  "screen": history("Landlord: Rashid")},
]

for role, title, lede, sc in [
  ("tenant","Simulation: tenant","Find a home without agency fees, from preferences to keys. Tap the highlighted buttons on the phone.",tenant),
  ("owner","Simulation: landlord","Rent out directly: listing, applications, contract and payment in one place.",owner),
  ("agent","Simulation: agent","How agents work transparently on LeaseMatch: the landlord pays the commission, never the tenant.",agent),
  ("lease","Simulation: lease conclusion","The core of LeaseMatch, from both sides: every stage with tips, payment confirmations from tenant and landlord, automatic conclusion and the key handover.",lease),
]:
    open(os.path.join(OUT, f"{role}.html"), "w").write(page(role, title, lede, sc))
print("built", len(tenant), len(owner), len(agent), len(lease))
