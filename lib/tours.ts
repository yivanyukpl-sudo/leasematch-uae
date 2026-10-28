import type { TourStep } from "@/components/GuideTour";

// Click-through guides per screen and role. Targets are data-tour attributes.
export const TOURS: Record<string, TourStep[]> = {
  "dashboard-tenant": [
    { title: "Welcome to LeaseMatch!", body: "A quick tour of how everything works. Reopen it any time with the “? Guide” button at the bottom right." },
    { target: "nav", title: "Main menu", body: "“Listings” are verified landlords on LeaseMatch. “Market search” lets the agent search Bayut and Dubizzle. “Dashboard” holds your matches and applications." },
    { target: "nav-leases", title: "Leases", body: "Every lease agreement you have. Your full lease history: in progress (from the moment a landlord approves you), active (signed, both payment confirmations attached) and finished (term ended)." },
    { target: "dash-actions", title: "Search beyond LeaseMatch", body: "Your agent can check Bayut and Dubizzle, email advertisers and (simulated) call them for you." },
    { target: "dash-matches", title: "Picked for you", body: "Listings with a match score based on your preferences. Nothing fits? Press “Notify me” and stay — we'll email you when a home appears." },
  ],
  "dashboard-owner": [
    { title: "Welcome, landlord", body: "Here's how to list a home and sign a lease without middlemen." },
    { target: "nav", title: "Main menu", body: "“Listings” shows how tenants see your home. “Dashboard” holds your listings and applicants." },
    { target: "nav-leases", title: "Leases", body: "All lease agreements on your units, for landlords, agencies and property managers alike: active, in progress and finished, plus a per-property table with end dates and renewals due." },
    { target: "add-listing", title: "New listing", body: "Add the home with photos and details, then publish it to tenants." },
    { target: "owner-listings", title: "Your listings", body: "Status, applications and the AI photo inspection for each home." },
  ],
  listings: [
    { target: "listing-filters", title: "Filters", body: "Area, budget in AED, bedrooms, furnished." },
    { title: "Nothing found?", body: "Don't go back to portals and agency fees. Press “Notify me” and we'll email you when a landlord adds a matching home." },
  ],
  "leases-tenant": [
    { target: "leases-summary", title: "Your lease agreements", body: "Active leases, deals in progress, finished leases and your total annual rent." },
    { target: "leases-concluded", title: "Active leases", body: "Signed by you and the landlord, with both payment confirmations attached, so the platform concluded them. Each shows the property, landlord, term dates, cheques, payment reference and key status. Open one to read the signed contract." },
    { target: "leases-in-progress", title: "In progress", body: "Created when a landlord approved your application, not yet concluded: terms, package, signatures, payment proofs still to do. Open one to continue step by step." },
    { target: "leases-finished", title: "Finished leases", body: "Your history: leases whose term has ended. Open one any time to see the contract, payments and handover." },
  ],
  "leases-provider": [
    { target: "leases-summary", title: "Your lease agreements", body: "Active, in progress and finished leases, renewals due within 90 days and the annual rent under contract." },
    { target: "leases-by-property", title: "By property", body: "One row per unit you list: Leased (with tenant and end date), a lease in progress, or Vacant. “Renewal due” marks leases ending within 90 days." },
    { target: "leases-concluded", title: "Active leases", body: "Signed by both sides with both payment confirmations attached (the tenant's proof of payment and your proof of receipt). Open one to read the signed contract and arrange the keys." },
    { target: "leases-in-progress", title: "In progress", body: "Created when you approved an applicant, still waiting for terms, the tenant's package, signatures or payment proofs." },
    { target: "leases-finished", title: "Finished leases", body: "History of leases whose term has ended, per unit and tenant." },
  ],
  lease: [
    { target: "deal-assistant", title: "Deal assistant", body: "Shows where you are and answers questions about any step. Ask it anything." },
    { target: "deal-steps", title: "Lease conclusion, step by step", body: "Every stage in order: terms, package, optional AI inspection, both signatures, the tenant's proof of payment, the landlord's proof of receipt, automatic conclusion, key handover. The current step is open with a tip; click any other step to read it." },
    { target: "step-pay", title: "Payment confirmations", body: "The tenant attaches proof of payment, then the landlord attaches proof of receipt (PDF, JPG or PNG). Both sides can open both files." },
    { target: "step-concluded", title: "Automatic conclusion", body: "As soon as both confirmations are attached, LeaseMatch concludes the agreement by itself. Nobody presses a button." },
    { target: "step-keys", title: "Key handover", body: "The tenant chooses, in a separate window, in hand at a meeting (date, time, place) or by mail to an address. The landlord confirms, the tenant marks the keys as received." },
    { target: "signed-agreement", title: "Signed agreement", body: "Once both sides sign, the full signed contract appears here with signatures, term dates and payment reference. It's also listed under Leases." },
  ],
  inspection: [
    { target: "inspection-steps", title: "Inspection steps", body: "Room by room: entrance, kitchen, bathrooms, rooms, windows, AC, meters. Green means done." },
    { target: "inspection-capture", title: "A photo at every step", body: "Shoot what's on the list. On a phone the camera opens. The AI rates each photo and asks for a retake if it's unclear." },
    { title: "Summary", body: "After the steps you'll see the issues by severity — raise them with the landlord before signing." },
  ],
};
