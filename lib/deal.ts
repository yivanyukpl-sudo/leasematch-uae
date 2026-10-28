// The guided deal: which step of the contract a lease is on, what the
// assistant says at that step, and the contract text built from the agreed
// terms. Pure module so it is unit-tested. Rent is annual, as in the UAE.

import { getPackage } from "./packages.ts";

export type LeaseTerms = {
  startDate: string; // YYYY-MM-DD
  months: number;
  deposit: number;
  cheques: number; // number of rent cheques per year
  utilities: "tenant" | "included";
  notes?: string | null;
};

export type DealState = {
  stage: "awaiting_signature" | "awaiting_payment" | "awaiting_confirmation" | "finalized";
  terms: LeaseTerms | null;
  pkg: string | null;
  packagePaid: boolean;
  inspectionDone: boolean;
  tenantSigned: boolean;
  ownerSigned: boolean;
};

export type DealStepId = "approved" | "terms" | "package" | "inspection" | "sign" | "pay" | "keys";
export type DealStep = { id: DealStepId; title: string; done: boolean; optional?: boolean };

export function dealSteps(s: DealState): DealStep[] {
  const signed = s.tenantSigned && s.ownerSigned;
  const paid = s.stage === "awaiting_confirmation" || s.stage === "finalized";
  return [
    { id: "approved", title: "Application approved", done: true },
    { id: "terms", title: "Contract terms", done: Boolean(s.terms) },
    { id: "package", title: "LeaseMatch package", done: s.packagePaid },
    { id: "inspection", title: "AI photo inspection", done: s.inspectionDone, optional: true },
    { id: "sign", title: "Both signatures", done: signed },
    { id: "pay", title: "First payment", done: paid },
    { id: "keys", title: "Confirmation & keys", done: s.stage === "finalized" },
  ];
}

export function currentStep(s: DealState): DealStepId {
  return dealSteps(s).find((x) => !x.done && !x.optional)?.id ?? "keys";
}

export function assistantMessage(step: DealStepId, role: "tenant" | "owner", s: DealState): string {
  const pkg = getPackage(s.pkg);
  const t = role === "tenant";
  switch (step) {
    case "terms":
      return t
        ? "Step 1 of 5. Let's agree the terms: move-in date, length, deposit, number of cheques, utilities. The landlord can propose them; you'll see them here and can discuss in the chat below."
        : "Step 1 of 5. Fill in the contract terms: move-in date, length, deposit, number of cheques, utilities. The tenant sees them straight away.";
    case "package":
      return t
        ? "Step 2 of 5. Choose a package. It covers a correct contract and a protected payment. Going direct doesn't save money: a contract and a lawyer cost more anyway, and here we guarantee both the contract and an honest payment."
        : "Step 2 of 5. The tenant chooses a LeaseMatch package. It's free for you. Once it's paid, you can sign the contract.";
    case "inspection":
      return "Recommended: run the AI photo inspection. The assistant walks you room by room and the AI flags damp, cracks or broken appliances before you sign.";
    case "sign":
      return t
        ? `Step 3 of 5. Review the contract below and sign.${pkg?.includesContract ? " The template is checked — nothing to add by hand." : ""}`
        : "Step 3 of 5. Review the contract and sign. It takes effect after payment and your confirmation.";
    case "pay":
      return t
        ? pkg?.includesPayment
          ? "Step 4 of 5. Pay the first rent through the protected payment. The landlord gets a confirmation and you get a receipt."
          : "Step 4 of 5. Pay the first rent. Tip: with “Protected payment” the money goes through a protected checkout with a receipt."
        : "Step 4 of 5. Waiting for the tenant's payment. We'll email you.";
    case "keys":
      return s.stage === "finalized"
        ? "Done! The lease is in force. Hand over keys only in person at the property, with the photo condition report."
        : t
          ? "Step 5 of 5. Payment sent. The landlord confirms receipt, then the lease takes effect."
          : "Step 5 of 5. Confirm you received the payment so the lease takes effect, and arrange the key handover.";
    default:
      return "Application approved. Next: the contract terms.";
  }
}

// Plain-language tenancy template. Prototype text: a UAE lawyer must review
// it before real use; register the contract with Ejari (Dubai) or Tawtheeq
// (Abu Dhabi).
export function contractText(i: { ownerName: string; tenantName: string; address: string; rent: number; terms: LeaseTerms }) {
  const t = i.terms;
  return {
    title: "Residential tenancy contract",
    clauses: [
      `The Landlord, ${i.ownerName}, lets and the Tenant, ${i.tenantName}, rents the residential unit at ${i.address}.`,
      `Term: ${t.months} months from ${t.startDate}, renewable by mutual agreement.`,
      `Rent: AED ${i.rent.toLocaleString("en-US")} per year, paid in ${t.cheques} cheque${t.cheques === 1 ? "" : "s"} of AED ${Math.round(i.rent / t.cheques).toLocaleString("en-US")}.`,
      `Security deposit: AED ${t.deposit.toLocaleString("en-US")}, refundable at move-out less documented damage.`,
      `Utilities (DEWA / ADDC, chiller, internet) are ${t.utilities === "included" ? "included in the rent" : "paid by the Tenant"}.`,
      "Move-in and keys are recorded in a condition report with photos.",
      "The Tenant may not sublet without the Landlord's written consent.",
      "This contract will be registered with Ejari (Dubai) or Tawtheeq (Abu Dhabi).",
      ...(t.notes ? [`Additional terms: ${t.notes}`] : []),
      "Disputes are settled amicably or, failing that, by the competent Rental Dispute Centre.",
    ],
  };
}

// Last day of the tenancy: start date + months - 1 day (YYYY-MM-DD).
export function leaseEndDate(t: Pick<LeaseTerms, "startDate" | "months">): string {
  const [y, m, day] = t.startDate.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + t.months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay) - 1 || 0);
  return target.toISOString().slice(0, 10);
}
