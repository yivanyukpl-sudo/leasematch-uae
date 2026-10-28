import type { TourStep } from "@/components/GuideTour";

// Click-through guides per screen and role. Targets are data-tour attributes.
export const TOURS: Record<string, TourStep[]> = {
  "dashboard-tenant": [
    { title: "Welcome to LeaseMatch!", body: "A quick tour of how everything works. Reopen it any time with the “? Guide” button at the bottom right." },
    { target: "nav", title: "Main menu", body: "“Listings” are verified landlords on LeaseMatch. “Market search” lets the agent search Bayut and Dubizzle. “Dashboard” holds your matches and applications." },
    { target: "nav-leases", title: "Leases", body: "Every lease agreement you have. Your full lease history: in progress (from the moment a landlord approves you), active (signed, both payment confirmations attached) and finished (term ended)." },
    { target: "dash-actions", title: "Search beyond LeaseMatch", body: "Your agent can check Bayut and Dubizzle, email advertisers and (simulated) call them for you." },
    { title: "How a lease is concluded", body: "1. Apply to a listing → 2. the landlord approves → 3. on the lease page: terms, package, optional AI photo inspection, both sign → 4. you attach proof of payment → 5. the landlord attaches proof of receipt → 6. LeaseMatch concludes the agreement automatically → 7. you choose how to get the keys: in hand or by mail." },
    { target: "dash-matches", title: "Picked for you", body: "Listings with a match score based on your preferences. Nothing fits? Press “Notify me” and stay — we'll email you when a home appears." },
  ],
  "dashboard-owner": [
    { title: "Welcome, landlord", body: "Here's how to list a home and sign a lease without middlemen." },
    { target: "nav", title: "Main menu", body: "“Listings” shows how tenants see your home. “Dashboard” holds your listings and applicants." },
    { target: "nav-leases", title: "Leases", body: "All lease agreements on your units, for landlords, agencies and property managers alike: active, in progress and finished, plus a per-property table with end dates and renewals due." },
    { target: "add-listing", title: "New listing", body: "Add the home with photos and details, then publish it to tenants." },
    { target: "owner-listings", title: "Your listings", body: "Status, applications and the AI photo inspection for each home. Open “Applicants” to approve a tenant: that opens the lease." },
    { title: "How a lease is concluded", body: "1. A tenant applies → 2. you approve on the listing's Applicants page → 3. on the lease page: terms, the tenant's package, both sign → 4. the tenant attaches proof of payment → 5. you attach proof of receipt → 6. LeaseMatch concludes the agreement automatically → 7. you confirm the tenant's key handover choice." },
  ],
  listings: [
    { target: "listing-filters", title: "Filters", body: "Area, budget in AED, bedrooms, furnished." },
    { title: "Nothing found?", body: "Don't go back to portals and agency fees. Press “Notify me” and we'll email you when a landlord adds a matching home." },
  ],
  "leases-tenant": [
    { title: "Your full lease history", body: "Every lease you have, in three groups: active, in progress and finished. No active lease yet? Apply to a listing; when the landlord approves, the lease appears under “In progress” and you continue step by step." },
    { target: "leases-summary", title: "Your lease agreements", body: "Active leases, deals in progress, finished leases and your total annual rent." },
    { target: "leases-concluded", title: "Active leases", body: "Signed by you and the landlord, with both payment confirmations attached, so the platform concluded them. Each shows the property, landlord, term dates, cheques, payment reference and key status. Open one to read the signed contract." },
    { target: "leases-in-progress", title: "In progress", body: "Created when a landlord approved your application, not yet concluded: terms, package, signatures, payment proofs still to do. Open one to continue step by step." },
    { target: "leases-finished", title: "Finished leases", body: "Your history: leases whose term has ended. Open one any time to see the contract, payments and handover." },
  ],
  "leases-provider": [
    { title: "All leases on your units", body: "Active, in progress and finished. A lease appears under “In progress” the moment you approve an applicant, and moves to “Active” when both payment confirmations are attached." },
    { target: "leases-summary", title: "Your lease agreements", body: "Active, in progress and finished leases, renewals due within 90 days and the annual rent under contract." },
    { target: "leases-by-property", title: "By property", body: "One row per unit you list: Leased (with tenant and end date), a lease in progress, or Vacant. “Renewal due” marks leases ending within 90 days." },
    { target: "leases-concluded", title: "Active leases", body: "Signed by both sides with both payment confirmations attached (the tenant's proof of payment and your proof of receipt). Open one to read the signed contract and arrange the keys." },
    { target: "leases-in-progress", title: "In progress", body: "Created when you approved an applicant, still waiting for terms, the tenant's package, signatures or payment proofs." },
    { target: "leases-finished", title: "Finished leases", body: "History of leases whose term has ended, per unit and tenant." },
  ],
  "lease-tenant": [
    { title: "Your lease, step by step", body: "This page takes you from approval to keys. The current step is open with a 💡 tip for you; done steps collapse; click any step to read it." },
    { target: "deal-assistant", title: "Deal assistant", body: "Shows how far you are and answers questions about any step: deposit, cheques, why a package. Ask it anything." },
    { target: "deal-steps", title: "Every stage in order", body: "Terms → package → optional AI inspection → both sign → your proof of payment → the landlord's proof of receipt → automatic conclusion → keys. Each card shows “Your turn”, “Waiting for the landlord”, “Automatic” or “Done”." },
    { target: "step-package", title: "Package", body: "Choose a package (AED 99 / 149 / combo 199). Signing unlocks once it's paid." },
    { target: "step-sign", title: "Sign", body: "Type your full name as on your account. The landlord signs too; order doesn't matter." },
    { target: "step-pay", title: "Your proof of payment", body: "Pay the first cheque and attach the confirmation: transfer receipt, cheque photo or screenshot (PDF, JPG, PNG). No receipt to hand? “Attach a sample (demo)”." },
    { target: "step-receipt", title: "Landlord's proof of receipt", body: "The landlord attaches proof the money arrived. You can open their file." },
    { target: "step-concluded", title: "Automatic conclusion", body: "When both confirmations are in, LeaseMatch concludes the agreement by itself and it moves to Leases → Active." },
    { target: "step-keys", title: "Your keys", body: "Choose in a separate window: in hand at a meeting (date, time, place: the apartment or elsewhere) or by mail (address, recipient). The landlord confirms; then press “I received the keys”." },
    { title: "Signed agreement and chat", body: "Once both sign, the full contract with signatures appears below the steps. Use the chat at the bottom to discuss terms or the handover." },
  ],
  "lease-provider": [
    { title: "This lease, step by step", body: "This page takes the deal from your approval to the key handover. The current step is open with a 💡 tip for you; click any step to read it." },
    { target: "deal-assistant", title: "Deal assistant", body: "Shows how far the deal is and answers questions about any step." },
    { target: "deal-steps", title: "Every stage in order", body: "Terms → tenant's package → optional AI inspection → both sign → tenant's proof of payment → your proof of receipt → automatic conclusion → keys. Each card shows “Your turn”, “Waiting for the tenant”, “Automatic” or “Done”." },
    { target: "step-terms", title: "Contract terms", body: "Fill in move-in date, length, deposit, cheques and utilities. The tenant sees them straight away." },
    { target: "step-sign", title: "Sign", body: "Unlocks once the tenant's package is paid. Type your full name as on your account." },
    { target: "step-pay", title: "Tenant's proof of payment", body: "The tenant pays the first cheque and attaches a confirmation. Open it and check your bank." },
    { target: "step-receipt", title: "Your proof of receipt", body: "Attach a bank statement line, screenshot or receipt. Your proof is the confirmation: there's no separate confirm button. No file to hand? “Attach a sample (demo)”." },
    { target: "step-concluded", title: "Automatic conclusion", body: "When both confirmations are in, LeaseMatch concludes the agreement, marks the property as leased and lists it under Leases → Active." },
    { target: "step-keys", title: "Key handover", body: "The tenant chooses in hand (date, time, place) or by mail. Press “Confirm this handover”, or agree a change in the chat." },
    { title: "Signed agreement and chat", body: "Once both sign, the full contract with signatures appears below the steps. Use the chat at the bottom for anything else." },
  ],
  inspection: [
    { target: "inspection-steps", title: "Inspection steps", body: "Room by room: entrance, kitchen, bathrooms, rooms, windows, AC, meters. Green means done." },
    { target: "inspection-capture", title: "A photo at every step", body: "Shoot what's on the list. On a phone the camera opens. The AI rates each photo and asks for a retake if it's unclear." },
    { title: "Summary", body: "After the steps you'll see the issues by severity — raise them with the landlord before signing." },
  ],
};
