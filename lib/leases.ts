import type { LeaseStage } from "./db";

export const leaseStageOrder: LeaseStage[] = [
  "awaiting_signature",
  "awaiting_payment",
  "awaiting_confirmation",
  "finalized",
];

export const leaseStageLabels: Record<LeaseStage, string> = {
  awaiting_signature: "Terms & signatures",
  awaiting_payment: "Proof of payment",
  awaiting_confirmation: "Proof of receipt",
  finalized: "Concluded — in force",
};

export function leaseStageIndex(stage: LeaseStage): number {
  return leaseStageOrder.indexOf(stage);
}
