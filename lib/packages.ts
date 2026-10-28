// Paid deal packages (pure, shared by server and client). The tenant picks a
// package when the landlord approves the application, before the contract is
// signed. Prices in AED are placeholders to confirm; change them here.

export type PackageId = "contract" | "payment" | "combo";

export type DealPackage = {
  id: PackageId;
  name: string;
  price: number;
  oldPrice?: number;
  tagline: string;
  includes: string[];
  includesContract: boolean;
  includesPayment: boolean;
};

export const PACKAGES: DealPackage[] = [
  {
    id: "contract",
    name: "Contract, done right",
    price: 99,
    tagline: "A correct tenancy contract without a lawyer",
    includes: [
      "The AI assistant guides every step of the contract",
      "Checked tenancy contract template with your terms, ready for Ejari / Tawtheeq",
      "In-app e-signature for both sides",
      "AI photo inspection and a move-in condition report",
    ],
    includesContract: true,
    includesPayment: false,
  },
  {
    id: "payment",
    name: "Protected payment",
    price: 149,
    tagline: "Money only through a protected payment",
    includes: [
      "First rent payment and deposit through LeaseMatch",
      "Receipt and payment confirmation for both sides",
      "Keys only after the payment is confirmed",
      "Support if something goes wrong",
    ],
    includesContract: false,
    includesPayment: true,
  },
  {
    id: "combo",
    name: "Combo: contract + protected payment",
    price: 199,
    oldPrice: 248,
    tagline: "Everything together, AED 49 cheaper",
    includes: ["Everything in “Contract, done right”", "Everything in “Protected payment”", "Priority support until move-in"],
    includesContract: true,
    includesPayment: true,
  },
];

export function getPackage(id: string | null | undefined): DealPackage | undefined {
  return PACKAGES.find((p) => p.id === id);
}

// Why paying inside the app beats "saving" by going to the landlord directly.
export const STAY_IN_APP_ARGUMENT = [
  "Even if you deal with the landlord directly, you still need a proper tenancy contract, registration and often a lawyer's check.",
  "A lawyer's review alone usually costs many times more than a LeaseMatch package, so leaving the app to save a few dirhams doesn't add up.",
  "We guarantee the contract is correct and the payment is handled in good faith: money goes through a protected payment, keys after payment.",
  "Outside the app there's no verified landlord, no photo condition report and no support if something goes wrong.",
];
