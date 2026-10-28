import type { TourStep } from "@/components/GuideTour";

// Click-through guides per screen and role. Targets are data-tour attributes.
export const TOURS: Record<string, TourStep[]> = {
  "dashboard-tenant": [
    { title: "Welcome to LeaseMatch!", body: "A quick tour of how everything works. Reopen it any time with the “? Guide” button at the bottom right." },
    { target: "nav", title: "Main menu", body: "“Listings” are verified landlords on LeaseMatch. “Market search” lets the agent search Bayut and Dubizzle. “Dashboard” holds your matches and applications." },
    { target: "nav-leases", title: "Leases", body: "Every lease agreement you have. A lease appears here as soon as a landlord approves your application, and moves to “Concluded” once both sides have signed and the landlord confirms your first payment." },
    { target: "dash-actions", title: "Search beyond LeaseMatch", body: "Your agent can check Bayut and Dubizzle, email advertisers and (simulated) call them for you." },
    { target: "dash-matches", title: "Picked for you", body: "Listings with a match score based on your preferences. Nothing fits? Press “Notify me” and stay — we'll email you when a home appears." },
  ],
  "dashboard-owner": [
    { title: "Welcome, landlord", body: "Here's how to list a home and sign a lease without middlemen." },
    { target: "nav", title: "Main menu", body: "“Listings” shows how tenants see your home. “Dashboard” holds your listings and applicants." },
    { target: "nav-leases", title: "Leases", body: "All lease agreements on your units, for landlords, agencies and property managers alike: in progress, concluded (in force), and a per-property table with end dates and renewals due." },
    { target: "add-listing", title: "New listing", body: "Add the home with photos and details, then publish it to tenants." },
    { target: "owner-listings", title: "Your listings", body: "Status, applications and the AI photo inspection for each home." },
  ],
  listings: [
    { target: "listing-filters", title: "Filters", body: "Area, budget in AED, bedrooms, furnished." },
    { title: "Nothing found?", body: "Don't go back to portals and agency fees. Press “Notify me” and we'll email you when a landlord adds a matching home." },
  ],
  "leases-tenant": [
    { target: "leases-summary", title: "Your lease agreements", body: "How many leases are in force, how many are still in progress, and your total annual rent." },
    { target: "leases-concluded", title: "Concluded agreements", body: "Leases signed by you and the landlord, with the first payment confirmed. Each shows the property, landlord, term dates, cheques and payment reference. Open one to read the full signed contract." },
    { target: "leases-in-progress", title: "In progress", body: "Leases created when a landlord approved your application but not yet in force: terms, package, signatures or payment still to do. Open one to continue with the deal assistant." },
  ],
  "leases-provider": [
    { target: "leases-summary", title: "Your lease agreements", body: "Leases in force, leases in progress, renewals due within 90 days and the annual rent under contract." },
    { target: "leases-by-property", title: "By property", body: "One row per unit you list: Leased (with tenant and end date), a lease in progress, or Vacant. “Renewal due” marks leases ending within 90 days." },
    { target: "leases-concluded", title: "Concluded agreements", body: "Leases signed by both sides with the first payment confirmed by you. Open one to read the signed contract, both signatures and the payment reference." },
    { target: "leases-in-progress", title: "In progress", body: "Leases created when you approved an applicant, still waiting for terms, the tenant's package, signatures or payment." },
  ],
  lease: [
    { target: "deal-assistant", title: "Deal assistant", body: "Guides every step: terms, package, inspection, signatures, payment and keys. Ask it anything." },
    { target: "deal-inspection", title: "AI photo inspection", body: "Photograph the home step by step — the AI flags damp, cracks and broken appliances before you sign." },
    { target: "deal-terms", title: "Contract terms", body: "Move-in date, length, deposit, cheques, utilities. The other side sees changes instantly." },
    { target: "deal-packages", title: "LeaseMatch package", body: "AED 99 contract, AED 149 protected payment, AED 199 combo. Why not go direct? A contract and lawyer cost more anyway, and here we guarantee the contract and an honest payment." },
    { target: "deal-contract", title: "Contract text", body: "Built from your terms. Review it and sign below." },
    { target: "signed-agreement", title: "Signed agreement", body: "Once both sides sign, the full signed contract appears here with signatures, term dates and payment reference. It's also listed under Leases." },
  ],
  inspection: [
    { target: "inspection-steps", title: "Inspection steps", body: "Room by room: entrance, kitchen, bathrooms, rooms, windows, AC, meters. Green means done." },
    { target: "inspection-capture", title: "A photo at every step", body: "Shoot what's on the list. On a phone the camera opens. The AI rates each photo and asks for a retake if it's unclear." },
    { title: "Summary", body: "After the steps you'll see the issues by severity — raise them with the landlord before signing." },
  ],
};
