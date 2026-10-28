import type { TourStep } from "@/components/GuideTour";

// Click-through guides per screen and role. Targets are data-tour attributes.
export const TOURS: Record<string, TourStep[]> = {
  "dashboard-tenant": [
    { title: "Welcome to LeaseMatch!", body: "A quick tour of how everything works. Reopen it any time with the “? Guide” button at the bottom right." },
    { target: "nav", title: "Main menu", body: "“Listings” are verified landlords on LeaseMatch. “Market search” lets the agent search Bayut and Dubizzle. “Dashboard” holds your applications and leases." },
    { target: "dash-actions", title: "Search beyond LeaseMatch", body: "Your agent can check Bayut and Dubizzle, email advertisers and (simulated) call them for you." },
    { target: "dash-matches", title: "Picked for you", body: "Listings with a match score based on your preferences. Nothing fits? Press “Notify me” and stay — we'll email you when a home appears." },
  ],
  "dashboard-owner": [
    { title: "Welcome, landlord", body: "Here's how to list a home and sign a lease without middlemen." },
    { target: "nav", title: "Main menu", body: "“Listings” shows how tenants see your home. “Dashboard” holds your listings, applications and leases." },
    { target: "add-listing", title: "New listing", body: "Add the home with photos and details, then publish it to tenants." },
    { target: "owner-listings", title: "Your listings", body: "Status, applications and the AI photo inspection for each home." },
  ],
  listings: [
    { target: "listing-filters", title: "Filters", body: "Area, budget in AED, bedrooms, furnished." },
    { title: "Nothing found?", body: "Don't go back to portals and agency fees. Press “Notify me” and we'll email you when a landlord adds a matching home." },
  ],
  lease: [
    { target: "deal-assistant", title: "Deal assistant", body: "Guides every step: terms, package, inspection, signatures, payment and keys. Ask it anything." },
    { target: "deal-inspection", title: "AI photo inspection", body: "Photograph the home step by step — the AI flags damp, cracks and broken appliances before you sign." },
    { target: "deal-terms", title: "Contract terms", body: "Move-in date, length, deposit, cheques, utilities. The other side sees changes instantly." },
    { target: "deal-packages", title: "LeaseMatch package", body: "AED 99 contract, AED 149 protected payment, AED 199 combo. Why not go direct? A contract and lawyer cost more anyway, and here we guarantee the contract and an honest payment." },
    { target: "deal-contract", title: "Contract text", body: "Built from your terms. Review it and sign below." },
  ],
  inspection: [
    { target: "inspection-steps", title: "Inspection steps", body: "Room by room: entrance, kitchen, bathrooms, rooms, windows, AC, meters. Green means done." },
    { target: "inspection-capture", title: "A photo at every step", body: "Shoot what's on the list. On a phone the camera opens. The AI rates each photo and asks for a retake if it's unclear." },
    { title: "Summary", body: "After the steps you'll see the issues by severity — raise them with the landlord before signing." },
  ],
};
