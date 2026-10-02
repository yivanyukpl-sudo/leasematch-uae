import type { LeaseStage } from "./db";

export const leaseStageOrder: LeaseStage[] = [
  "awaiting_signature",
  "awaiting_payment",
  "awaiting_confirmation",
  "finalized",
];

export const leaseStageLabels: Record<LeaseStage, string> = {
  awaiting_signature: "Awaiting signatures",
  awaiting_payment: "Awaiting payment",
  awaiting_confirmation: "Awaiting payment confirmation",
  finalized: "Finalized — lease active",
};

export function leaseStageIndex(stage: LeaseStage): number {
  return leaseStageOrder.indexOf(stage);
}
