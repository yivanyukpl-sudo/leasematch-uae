import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { getSession } from "@/lib/auth";
import {
  getLeaseById,
  getPropertyById,
  getProfileById,
  listLeaseMessages,
  submitPayment,
} from "@/lib/db";
import { leaseStageIndex, leaseStageLabels, leaseStageOrder } from "@/lib/leases";
import {
  isCryptoPaymentConfigured,
  isPaymentProviderConfigured,
  retrieveCheckoutSession,
} from "@/lib/payments";
import { comparablesFor, isPricedAboveMarket } from "@/lib/comparables";
import { NegotiationNudge } from "@/components/NegotiationNudge";
import {
  confirmCryptoSentAction,
  confirmPaymentAction,
  postMessageAction,
  signLeaseAction,
  simulatePaymentAction,
  startCryptoPaymentAction,
  startPaymentAction,
} from "@/app/dashboard/actions";

export default async function LeasePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ payment_session?: string; crypto_started?: string }>;
}) {
  const { id } = await params;
  const { payment_session: paymentSession, crypto_started: cryptoStarted } = await searchParams;
  const session = await getSession();
  if (!session) redirect("/login");

  const lease = getLeaseById(id);
  if (!lease) notFound();
  if (lease.tenant_id !== session.sub && lease.provider_id !== session.sub) {
    redirect("/dashboard");
  }

  // Returning from Stripe Checkout: verify the session actually paid before
  // moving the lease forward, then drop the query param so a refresh can't
  // replay it.
  if (paymentSession && lease.stage === "awaiting_payment" && lease.tenant_id === session.sub) {
    const checkoutSession = await retrieveCheckoutSession(paymentSession);
    if (checkoutSession?.payment_status === "paid") {
      submitPayment(lease.id, { provider: "stripe", reference: checkoutSession.id });
    }
    redirect(`/dashboard/leases/${id}`);
  }

  const isTenant = lease.tenant_id === session.sub;
  const property = getPropertyById(lease.property_id);
  const tenant = getProfileById(lease.tenant_id);
  const provider = getProfileById(lease.provider_id);
  const counterparty = isTenant ? provider : tenant;
  const messages = listLeaseMessages(lease.id);
  const me = isTenant ? tenant : provider;

  const myTurnToSign = isTenant ? !lease.tenant_signed_at : !lease.landlord_signed_at;
  const providerConfigured = isPaymentProviderConfigured();
  const cryptoConfigured = isCryptoPaymentConfigured();
  const comparableStats = property ? comparablesFor(property) : null;

  return (
    <div className="flex flex-col flex-1">
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
        <p className="text-sm text-text-muted">
          {property?.title} · with {counterparty?.full_name}
        </p>
        <h1 className="font-display text-2xl font-semibold mb-6">Lease agreement</h1>

        <StageTracker stage={lease.stage} />

        <div
          className="mt-6 rounded-lg border bg-surface p-6"
          style={{ borderColor: "var(--border)" }}
        >
          {lease.stage === "awaiting_signature" && (
            <div>
              <h2 className="font-display text-lg font-semibold mb-2">Review and sign</h2>
              <p className="text-sm text-text-muted mb-4">
                {property?.title}, {property?.location} — AED{" "}
                {property?.price.toLocaleString()}/year. By signing, both the tenant and the
                provider agree to the terms of this lease as listed.
              </p>
              <p className="text-sm mb-4">
                Tenant signature:{" "}
                {lease.tenant_signed_at
                  ? `✓ Signed by ${lease.tenant_signature_name} (${signatureMethodLabel(lease.tenant_signature_method)})`
                  : "Pending"}
                <br />
                Landlord signature:{" "}
                {lease.landlord_signed_at
                  ? `✓ Signed by ${lease.landlord_signature_name} (${signatureMethodLabel(lease.landlord_signature_method)})`
                  : "Pending"}
              </p>

              {myTurnToSign && isTenant && property && comparableStats && isPricedAboveMarket(property.price, comparableStats) && (
                <NegotiationNudge
                  leaseId={lease.id}
                  askingPrice={property.price}
                  comparableAvg={comparableStats.avgPrice}
                  comparableCount={comparableStats.count}
                />
              )}

              {myTurnToSign ? (
                <div className="space-y-3">
                  <button
                    type="button"
                    disabled
                    title="UAE Pass sign-in requires a government-issued integration (client ID/secret from the UAE Pass developer portal) that isn't connected yet."
                    className="w-full cursor-not-allowed rounded-md border px-4 py-2 text-sm font-medium opacity-60"
                    style={{ borderColor: "var(--border)" }}
                  >
                    Sign with UAE Pass (not connected yet)
                  </button>

                  <form
                    action={signLeaseAction}
                    className="rounded-md border p-4"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <input type="hidden" name="leaseId" value={lease.id} />
                    <label className="mb-1 block text-sm font-medium" htmlFor="signatureName">
                      No UAE Pass? Sign inside the app instead
                    </label>
                    <p className="mb-2 text-xs text-text-muted">
                      Type your full legal name exactly as it appears on your account (
                      {me?.full_name}) to sign electronically.
                    </p>
                    <input
                      id="signatureName"
                      name="signatureName"
                      required
                      placeholder={me?.full_name}
                      className="mb-3 w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2"
                      style={{ borderColor: "var(--border)" }}
                    />
                    <button
                      type="submit"
                      className="w-full rounded-md py-2 text-sm font-medium"
                      style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
                    >
                      Sign agreement
                    </button>
                  </form>
                </div>
              ) : (
                <p className="text-sm text-text-muted">
                  Waiting on {counterparty?.full_name} to sign.
                </p>
              )}
            </div>
          )}

          {lease.stage === "awaiting_payment" && (
            <div>
              <h2 className="font-display text-lg font-semibold mb-2">Awaiting payment</h2>
              <p className="text-sm text-text-muted mb-4">
                Both parties have signed. {isTenant ? "You" : "The tenant"} can now pay to move
                the lease forward.
              </p>
              {isTenant ? (
                cryptoStarted ? (
                  <div
                    className="rounded-md border p-4 text-sm"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <p className="mb-3 text-text-muted">
                      If you completed the crypto payment on the provider&apos;s page, confirm it
                      below. {counterparty?.full_name} will still need to verify the funds
                      arrived before the lease finalizes — same as with any other payment method.
                    </p>
                    <form action={confirmCryptoSentAction}>
                      <input type="hidden" name="leaseId" value={lease.id} />
                      <button
                        type="submit"
                        className="w-full rounded-md px-4 py-2 text-sm font-medium"
                        style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
                      >
                        I sent the crypto payment
                      </button>
                    </form>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {providerConfigured && (
                      <form action={startPaymentAction}>
                        <input type="hidden" name="leaseId" value={lease.id} />
                        <button
                          type="submit"
                          className="w-full rounded-md px-4 py-2 text-sm font-medium"
                          style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
                        >
                          Pay AED {property?.price.toLocaleString()} by card — continue to payment
                          provider
                        </button>
                        <p className="mt-2 text-xs text-text-muted">
                          You&apos;ll be redirected to Stripe&apos;s secure checkout. LeaseMatch
                          never sees or stores your card details.
                        </p>
                      </form>
                    )}

                    {cryptoConfigured && (
                      <form action={startCryptoPaymentAction}>
                        <input type="hidden" name="leaseId" value={lease.id} />
                        <button
                          type="submit"
                          className="w-full rounded-md border px-4 py-2 text-sm font-medium"
                          style={{ borderColor: "var(--border)" }}
                        >
                          Pay AED {property?.price.toLocaleString()} with crypto
                        </button>
                        <p className="mt-2 text-xs text-text-muted">
                          You&apos;ll be redirected to a secure NOWPayments page to pay with
                          Bitcoin, Ethereum, USDT or another supported coin. LeaseMatch never
                          holds your funds directly.
                        </p>
                      </form>
                    )}

                    {!providerConfigured && !cryptoConfigured && (
                      <div
                        className="rounded-md border p-4 text-sm"
                        style={{ borderColor: "var(--border)" }}
                      >
                        <p className="mb-3 text-text-muted">
                          No payment provider is connected yet — set{" "}
                          <code>STRIPE_SECRET_KEY</code> for card payments via a real,
                          Stripe-hosted checkout, or <code>NOWPAYMENTS_API_KEY</code> to accept
                          crypto. Other gateways (Telr, PayTabs, Network International, a bank
                          transfer) can be wired in the same way in <code>lib/payments.ts</code>.
                        </p>
                        <form action={simulatePaymentAction}>
                          <input type="hidden" name="leaseId" value={lease.id} />
                          <button
                            type="submit"
                            className="w-full rounded-md border px-4 py-2 text-sm font-medium"
                            style={{ borderColor: "var(--border)" }}
                          >
                            Simulate payment (testing only)
                          </button>
                        </form>
                      </div>
                    )}
                  </div>
                )
              ) : (
                <p className="text-sm text-text-muted">Waiting on the tenant to pay.</p>
              )}
            </div>
          )}

          {lease.stage === "awaiting_confirmation" && (
            <div>
              <h2 className="font-display text-lg font-semibold mb-2">
                Awaiting payment confirmation
              </h2>
              <p className="text-sm text-text-muted mb-2">
                {isTenant
                  ? "Your payment has been submitted. The provider needs to confirm receipt to finalize the lease."
                  : "The tenant has submitted payment. Confirm receipt to finalize the lease."}
              </p>
              {lease.payment_provider && (
                <p className="mb-4 text-xs text-text-muted">
                  Payment via {paymentProviderLabel(lease.payment_provider)}
                  {lease.payment_reference ? ` · ref ${lease.payment_reference}` : ""}
                </p>
              )}
              {!isTenant && (
                <form action={confirmPaymentAction}>
                  <input type="hidden" name="leaseId" value={lease.id} />
                  <button
                    type="submit"
                    className="rounded-md px-4 py-2 text-sm font-medium"
                    style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
                  >
                    Confirm payment received
                  </button>
                </form>
              )}
            </div>
          )}

          {lease.stage === "finalized" && (
            <div>
              <h2 className="font-display text-lg font-semibold mb-2">Lease finalized</h2>
              <p className="text-sm text-text-muted mb-4">
                Congratulations — the lease for {property?.title} is active.
              </p>

              <div
                className="mb-3 flex gap-3 rounded-md border p-3 text-sm"
                style={{ borderColor: "var(--border)" }}
              >
                <span aria-hidden>🔑</span>
                <div>
                  <b className="block">Key handover</b>
                  Collect your keys at {provider?.company_name ?? provider?.full_name}&apos;s
                  office, or arrange delivery by tracked mail (signature required) — coordinate
                  the exact time and place with {counterparty?.full_name} using the chat below.
                </div>
              </div>

              <div
                className="flex gap-3 rounded-md border p-3 text-sm"
                style={{ borderColor: "var(--danger)", background: "#f6e6e4" }}
              >
                <span aria-hidden>⚠️</span>
                <div>
                  <b className="block">Only accept keys through this verified handover.</b>
                  Collect them in person at the address you agree on, or by tracked mail with a
                  signature. LeaseMatch will never ask you to meet a stranger elsewhere, pay
                  anyone in cash, or exchange keys before payment shows confirmed — report
                  anything else immediately.
                </div>
              </div>
            </div>
          )}
        </div>

        <div
          className="mt-6 rounded-lg border bg-surface p-6"
          style={{ borderColor: "var(--border)" }}
        >
          <h2 className="font-display text-lg font-semibold mb-1">
            Amend the draft with {counterparty?.full_name}
          </h2>
          <p className="text-xs text-text-muted mb-4">
            Use this to discuss changes to the lease terms before or after signing.
          </p>

          <ul className="mb-4 max-h-72 space-y-2 overflow-y-auto">
            {messages.length === 0 && (
              <li className="text-sm text-text-muted">No messages yet.</li>
            )}
            {messages.map((m) => {
              const mine = m.sender_id === session.sub;
              const sender = getProfileById(m.sender_id);
              return (
                <li
                  key={m.id}
                  className="max-w-[80%] rounded-md px-3 py-2 text-sm"
                  style={{
                    marginLeft: mine ? "auto" : 0,
                    background: mine ? "var(--accent)" : "var(--bg)",
                    color: mine ? "var(--accent-ink)" : "var(--text)",
                    border: mine ? "none" : "1px solid var(--border)",
                  }}
                >
                  <p className="mb-0.5 text-[11px] opacity-75">{sender?.full_name}</p>
                  {m.body}
                </li>
              );
            })}
          </ul>

          <form action={postMessageAction} className="flex gap-2">
            <input type="hidden" name="leaseId" value={lease.id} />
            <input
              type="text"
              name="body"
              required
              placeholder="Type a message…"
              className="flex-1 rounded-md border px-3 py-2 text-sm outline-none focus:ring-2"
              style={{ borderColor: "var(--border)" }}
            />
            <button
              type="submit"
              className="rounded-md px-4 py-2 text-sm font-medium"
              style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
            >
              Send
            </button>
          </form>
        </div>

        <div className="mt-6">
          <Link href="/dashboard" className="text-sm font-medium" style={{ color: "var(--accent)" }}>
            ← Back to dashboard
          </Link>
        </div>
      </main>
    </div>
  );
}

function paymentProviderLabel(provider: string | null) {
  if (provider === "stripe") return "Stripe";
  if (provider === "crypto") return "crypto (NOWPayments)";
  if (provider === "simulated") return "simulated";
  return provider ?? "—";
}

function signatureMethodLabel(method: string | null) {
  if (method === "uae_pass") return "UAE Pass";
  if (method === "in_app") return "signed in-app";
  return "signed";
}

function StageTracker({ stage }: { stage: (typeof leaseStageOrder)[number] }) {
  const currentIndex = leaseStageIndex(stage);
  return (
    <ol className="flex items-center gap-2 text-xs">
      {leaseStageOrder.map((s, i) => (
        <li key={s} className="flex flex-1 items-center gap-2">
          <div className="flex-1">
            <div
              className="h-1.5 rounded-full"
              style={{ background: i <= currentIndex ? "var(--accent)" : "var(--border)" }}
            />
            <p
              className="mt-1"
              style={{ color: i <= currentIndex ? "var(--text)" : "var(--text-muted)" }}
            >
              {leaseStageLabels[s]}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
