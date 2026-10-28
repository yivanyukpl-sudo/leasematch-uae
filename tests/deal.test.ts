import { test } from "node:test";
import assert from "node:assert/strict";
import { contractText, currentStep, handoverPhase, type DealState } from "../lib/deal.ts";
import { getPackage, PACKAGES } from "../lib/packages.ts";
import { alertMatches } from "../lib/alert-match.ts";
import { summarize } from "../lib/inspection-steps.ts";

const base: DealState = { stage: "awaiting_signature", terms: null, pkg: null, packagePaid: false, inspectionDone: false, tenantSigned: false, ownerSigned: false };
const terms = { startDate: "2026-12-01", months: 12, deposit: 4250, cheques: 4, utilities: "tenant" as const };

test("deal steps: terms → package → sign", () => {
  assert.equal(currentStep(base), "terms");
  assert.equal(currentStep({ ...base, terms }), "package");
  assert.equal(currentStep({ ...base, terms, packagePaid: true }), "sign");
});

test("deal steps: proofs from both sides, automatic conclusion, then keys", () => {
  const signed = { ...base, terms, packagePaid: true, tenantSigned: true, ownerSigned: true, stage: "awaiting_payment" as const };
  assert.equal(currentStep(signed), "pay");
  assert.equal(currentStep({ ...signed, stage: "awaiting_confirmation", tenantProof: true }), "receipt");
  assert.equal(currentStep({ ...signed, stage: "awaiting_confirmation", tenantProof: true, landlordProof: true }), "concluded");
  const done = { ...signed, stage: "finalized" as const, tenantProof: true, landlordProof: true };
  assert.equal(currentStep(done), "keys");
  assert.equal(handoverPhase(done), "choose");
  assert.equal(handoverPhase({ ...done, handoverChosen: true }), "confirm");
  assert.equal(handoverPhase({ ...done, handoverChosen: true, handoverConfirmed: true }), "receive");
  assert.equal(currentStep({ ...done, handoverChosen: true, handoverConfirmed: true, keysReceived: true }), "keys");
});

test("combo costs less than both packages", () => {
  assert.ok(getPackage("combo")!.price < getPackage("contract")!.price + getPackage("payment")!.price);
  assert.equal(PACKAGES.length, 3);
});

test("contract uses annual rent split into cheques", () => {
  const all = contractText({ ownerName: "Rashid", tenantName: "Priya", address: "Jumeirah Lake Towers, Dubai", rent: 85000, terms }).clauses.join(" ");
  assert.match(all, /AED 85,000 per year, paid in 4 cheques of AED 21,250/);
});

test("alerts and inspection summary", () => {
  assert.ok(alertMatches({ location: "Dubai Marina", max_price: 170000, min_beds: null, property_type: null }, { location: "Dubai Marina, Dubai", price: 165000, beds: 2, property_type: "Apartment" }));
  const s = summarize([{ step: "bathroom", a: { quality: "ok", retakeReason: null, condition: 2, issues: [{ severity: "high", title: "Mould", detail: "" }], summary: "" } }]);
  assert.equal(s.verdict, "warning");
});

test("lease end date is the day before the anniversary", async () => {
  const { leaseEndDate } = await import("../lib/deal.ts");
  assert.equal(leaseEndDate({ startDate: "2026-12-01", months: 12 }), "2027-11-30");
  assert.equal(leaseEndDate({ startDate: "2027-01-31", months: 1 }), "2027-02-27");
  assert.equal(leaseEndDate({ startDate: "2027-03-01", months: 1 }), "2027-03-31");
});
