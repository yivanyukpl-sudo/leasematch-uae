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
  // Payment confirmations attached by each side.
  tenantProof?: boolean;
  landlordProof?: boolean;
  // Key handover: tenant chose a method, landlord confirmed, tenant got keys.
  handoverChosen?: boolean;
  handoverConfirmed?: boolean;
  keysReceived?: boolean;
};

export type DealStepId =
  | "approved"
  | "terms"
  | "package"
  | "inspection"
  | "sign"
  | "pay"
  | "receipt"
  | "concluded"
  | "keys";
export type DealStep = { id: DealStepId; title: string; done: boolean; optional?: boolean; auto?: boolean };

export function dealSteps(s: DealState): DealStep[] {
  const signed = s.tenantSigned && s.ownerSigned;
  const concluded = s.stage === "finalized";
  return [
    { id: "approved", title: "Application approved", done: true },
    { id: "terms", title: "Contract terms", done: Boolean(s.terms) },
    { id: "package", title: "LeaseMatch package", done: s.packagePaid },
    { id: "inspection", title: "AI photo inspection", done: s.inspectionDone, optional: true },
    { id: "sign", title: "Both signatures", done: signed },
    { id: "pay", title: "Tenant pays and attaches proof of payment", done: Boolean(s.tenantProof) || concluded },
    { id: "receipt", title: "Landlord attaches proof of receipt", done: Boolean(s.landlordProof) || concluded },
    { id: "concluded", title: "Agreement concluded", done: concluded, auto: true },
    { id: "keys", title: "Key handover", done: Boolean(s.keysReceived) },
  ];
}

export function currentStep(s: DealState): DealStepId {
  return dealSteps(s).find((x) => !x.done && !x.optional)?.id ?? "keys";
}

// What is left in the key handover, for the step card and the assistant.
export function handoverPhase(s: DealState): "choose" | "confirm" | "receive" | "done" {
  if (s.keysReceived) return "done";
  if (!s.handoverChosen) return "choose";
  if (!s.handoverConfirmed) return "confirm";
  return "receive";
}

// The tip shown on each step card, written for whoever is looking at it.
export function stepTip(step: DealStepId, role: "tenant" | "owner", s: DealState): string {
  const t = role === "tenant";
  const pkg = getPackage(s.pkg);
  switch (step) {
    case "approved":
      return t
        ? "The landlord approved your application and a lease was opened. Everything from here happens on this page."
        : "You approved this tenant. Everything from here happens on this page.";
    case "terms":
      return t
        ? "Move-in date, length, deposit, number of cheques and utilities. Either side can fill them in; the other sees them straight away. Discuss changes in the chat at the bottom."
        : "Fill in move-in date, length, deposit, number of cheques and utilities. The tenant sees them straight away and can discuss them in the chat.";
    case "package":
      return t
        ? "Choose a package: a checked contract, a protected payment, or both. Signing unlocks once it's paid."
        : "The tenant chooses and pays a LeaseMatch package. It's free for you. Signing unlocks once it's paid.";
    case "inspection":
      return "Optional but recommended: the AI walks you room by room and flags damp, cracks or broken appliances before anyone signs.";
    case "sign":
      return t
        ? `Read the contract and sign with your full name as on your account.${pkg?.includesContract ? " The template is checked: nothing to add by hand." : ""} The landlord signs too; order doesn't matter.`
        : "Read the contract and sign with your full name as on your account. The tenant signs too; order doesn't matter.";
    case "pay":
      return t
        ? "Pay the first cheque (or the agreed first payment) and attach the confirmation: a bank transfer receipt, a photo of the cheque, or a screenshot. PDF, JPG or PNG."
        : "The tenant pays the first cheque and attaches their proof of payment. You'll see it here and can open it.";
    case "receipt":
      return t
        ? "The landlord checks the money arrived and attaches their proof of receipt (bank statement line or receipt). You'll see it here."
        : "Check the money arrived, then attach your proof of receipt: a bank statement line, a screenshot or a signed receipt. Once you attach it, the agreement is concluded automatically.";
    case "concluded":
      return "Automatic: when both payment confirmations are attached, LeaseMatch concludes the agreement, marks the property as leased and shows the signed contract below. No one has to press a button.";
    case "keys": {
      const phase = handoverPhase(s);
      if (phase === "done") return "Keys received. The tenancy is fully set up. Register the contract with Ejari (Dubai) or Tawtheeq (Abu Dhabi).";
      if (phase === "choose")
        return t
          ? "Choose how you receive the keys: in hand at a meeting with the landlord (pick the date, time and place, e.g. the apartment) or by mail to an address you give."
          : "The tenant chooses how to receive the keys: in hand at a meeting, or by mail. You'll confirm what they choose.";
      if (phase === "confirm")
        return t
          ? "The landlord confirms your handover choice. You can still change it until then."
          : "Check the tenant's choice and confirm it, or agree a change in the chat.";
      return t
        ? "Once you have the keys, press “I received the keys”. Check the meter readings and the condition report at handover."
        : "Hand over the keys as agreed. The tenant confirms receipt here.";
    }
  }
}

export function assistantMessage(step: DealStepId, role: "tenant" | "owner", s: DealState): string {
  const steps = dealSteps(s).filter((x) => !x.optional && x.id !== "approved");
  const n = steps.findIndex((x) => x.id === step) + 1;
  const prefix = n > 0 ? `Step ${n} of ${steps.length}. ` : "";
  if (step === "keys" && handoverPhase(s) === "done") return "Done! The lease is in force and the keys are with the tenant.";
  return prefix + stepTip(step, role, s);
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
