import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { getSession } from "@/lib/auth";
import {
  getLeaseById,
  getPropertyById,
  getProfileById,
  listInspectionsForLease,
  listLeaseMessages,
  listPaymentProofs,
  markPackagePaid,
  type PaymentProof,
  submitPayment,
} from "@/lib/db";
import { leaseStageIndex, leaseStageLabels, leaseStageOrder } from "@/lib/leases";
import { KeyHandoverDialog } from "@/components/KeyHandoverDialog";
import {
  isCryptoPaymentConfigured,
  isPaymentProviderConfigured,
  retrieveCheckoutSession,
} from "@/lib/payments";
import { comparablesFor, isPricedAboveMarket } from "@/lib/comparables";
import { NegotiationNudge } from "@/components/NegotiationNudge";
import { DealAssistant } from "@/components/DealAssistant";
import { ContractPreview, PackagePicker, TermsCard } from "@/components/DealPanels";
import { GuideTour } from "@/components/GuideTour";
import { TOURS } from "@/lib/tours";
import { assistantMessage, contractText, currentStep, dealSteps, handoverPhase, leaseEndDate, stepTip, type DealState, type DealStepId, type LeaseTerms } from "@/lib/deal";
import {
  confirmCryptoSentAction,
  confirmHandoverAction,
  keysReceivedAction,
  postMessageAction,
  signLeaseAction,
  startCryptoPaymentAction,
  startPaymentAction,
} from "@/app/dashboard/actions";

export default async function LeasePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    payment_session?: string;
    crypto_started?: string;
    package_session?: string;
    termsError?: string;
    proofError?: string;
    proof?: string;
    handoverError?: string;
  }>;
}) {
  const { id } = await params;
  const {
    payment_session: paymentSession,
    crypto_started: cryptoStarted,
    package_session: packageSession,
    termsError,
    proofError,
    proof: proofSaved,
    handoverError,
  } = await searchParams;
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

  // Returning from the package checkout: verify it actually paid.
  if (packageSession && lease.tenant_id === session.sub && !lease.package_paid_at) {
    const checkout = await retrieveCheckoutSession(packageSession);
    if (checkout?.payment_status === "paid" && checkout.metadata?.purpose === "package" && checkout.metadata?.leaseId === lease.id) {
      markPackagePaid(lease.id);
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
  const terms: LeaseTerms | null = lease.terms ? JSON.parse(lease.terms) : null;
  const inspections = listInspectionsForLease(lease.id);
  const proofs = listPaymentProofs(lease.id);
  const tenantProof = proofs.find((p) => p.side === "tenant");
  const landlordProof = proofs.find((p) => p.side === "landlord");
  // A verified Stripe checkout is the tenant's proof of payment on its own.
  const paidByCard = lease.payment_provider === "stripe" && Boolean(lease.payment_reference);
  const dealState: DealState = {
    stage: lease.stage,
    terms,
    pkg: lease.package,
    packagePaid: Boolean(lease.package_paid_at),
    inspectionDone: inspections.some((x) => x.status === "done"),
    tenantSigned: Boolean(lease.tenant_signed_at),
    ownerSigned: Boolean(lease.landlord_signed_at),
    tenantProof: Boolean(tenantProof) || paidByCard,
    landlordProof: Boolean(landlordProof),
    handoverChosen: Boolean(lease.handover_method),
    handoverConfirmed: Boolean(lease.handover_confirmed_at),
    keysReceived: Boolean(lease.keys_received_at),
  };
  const role = isTenant ? "tenant" : "owner";
  const steps = dealSteps(dealState);
  const step = currentStep(dealState);
  const readyToSign = Boolean(terms && lease.package_paid_at);
  const cryptoConfigured = isCryptoPaymentConfigured();
  const comparableStats = property ? comparablesFor(property) : null;
  const counterpartyRole = isTenant ? "the landlord" : "the tenant";
  const firstPayment = property && terms ? Math.round(property.price / terms.cheques) : (property?.price ?? 0);
  const phase = handoverPhase(dealState);
  const ownerName = provider?.company_name ?? provider?.full_name ?? "the landlord";

  // Whose move it is on the current step.
  function waitingOnOther(id: DealStepId): boolean {
    switch (id) {
      case "package":
      case "pay":
        return !isTenant;
      case "receipt":
        return isTenant;
      case "sign":
        return !myTurnToSign;
      case "concluded":
        return false;
      case "keys":
        return phase === "confirm" ? isTenant : !isTenant;
      default:
        return false;
    }
  }

  // One line under each step title.
  function stepSummary(id: DealStepId): string {
    switch (id) {
      case "approved":
        return `Lease opened ${lease!.created_at.slice(0, 10)}`;
      case "terms":
        return terms ? `From ${terms.startDate}, ${terms.months} months, ${terms.cheques} cheque(s), deposit AED ${terms.deposit.toLocaleString("en-US")}` : "Move-in date, length, deposit, cheques, utilities";
      case "package":
        return lease!.package_paid_at ? `Paid ${lease!.package_paid_at.slice(0, 10)}` : "Paid by the tenant; unlocks signing";
      case "inspection":
        return inspections.length ? `${inspections.length} inspection(s), latest ${inspections[0].status === "done" ? "finished" : "in progress"}` : "Recommended before signing";
      case "sign":
        return `Tenant ${lease!.tenant_signed_at ? "✓" : "pending"} · Landlord ${lease!.landlord_signed_at ? "✓" : "pending"}`;
      case "pay":
        return tenantProof
          ? `Attached ${tenantProof.created_at.slice(0, 10)}`
          : paidByCard
            ? "Paid by card (Stripe receipt)"
            : lease!.stage === "finalized"
              ? `Paid ${lease!.payment_marked_at?.slice(0, 10) ?? ""} · no file on record`
              : `First payment AED ${firstPayment.toLocaleString("en-US")}`;
      case "receipt":
        return landlordProof
          ? `Attached ${landlordProof.created_at.slice(0, 10)}`
          : lease!.stage === "finalized"
            ? `Confirmed ${lease!.confirmed_at?.slice(0, 10) ?? ""} · no file on record`
            : "Bank statement line or receipt";
      case "concluded":
        return lease!.confirmed_at ? `Concluded automatically ${lease!.confirmed_at.slice(0, 16)} UTC` : "Happens automatically after both confirmations";
      case "keys":
        if (lease!.keys_received_at) return `Keys received ${lease!.keys_received_at.slice(0, 10)}`;
        if (lease!.handover_method === "in_person") return `In hand · ${lease!.handover_date} ${lease!.handover_time} · ${lease!.handover_place}`;
        if (lease!.handover_method === "mail") return `By mail · ${lease!.handover_address}`;
        return "In hand at a meeting, or by mail";
    }
  }

  function stepBody(id: DealStepId) {
    switch (id) {
      case "approved":
        return (
          <p className="text-sm text-text-muted">
            {property?.title}, {property?.location}: AED {property?.price.toLocaleString("en-US")}/year. Tenant {tenant?.full_name}, landlord {ownerName}.
          </p>
        );
      case "terms":
        return property ? (
          <TermsCard leaseId={lease!.id} terms={terms} rent={property.price} editable={!lease!.tenant_signed_at && !lease!.landlord_signed_at} error={termsError} />
        ) : null;
      case "package":
        return terms ? (
          <PackagePicker leaseId={lease!.id} isTenant={isTenant} chosen={lease!.package} paid={Boolean(lease!.package_paid_at)} canPay />
        ) : (
          <Locked text="Opens once the contract terms are saved." />
        );
      case "inspection":
        return (
          <div className="flex flex-wrap items-center gap-3 text-sm" data-tour="deal-inspection">
            <span className="text-xl" aria-hidden>📸</span>
            <p className="min-w-0 flex-1 text-xs text-text-muted">Photograph the home step by step; the AI flags damp, cracks or broken appliances.</p>
            <Link href={inspections[0] ? `/dashboard/inspections/${inspections[0].id}` : `/dashboard/inspections/new?lease=${lease!.id}`} className="rounded-md px-3 py-2 text-xs font-medium" style={{ background: "var(--accent)", color: "var(--accent-ink)" }}>
              {inspections.length ? "Open inspection" : "Start inspection"}
            </Link>
          </div>
        );
      case "sign":
        return (
          <div>
            <p className="mb-3 text-sm">
              Tenant: {lease!.tenant_signed_at ? `✓ ${lease!.tenant_signature_name} (${signatureMethodLabel(lease!.tenant_signature_method)})` : "pending"}
              <br />
              Landlord: {lease!.landlord_signed_at ? `✓ ${lease!.landlord_signature_name} (${signatureMethodLabel(lease!.landlord_signature_method)})` : "pending"}
            </p>
            {terms && property && tenant && provider && !(lease!.tenant_signed_at && lease!.landlord_signed_at) && (
              <ContractPreview ownerName={ownerName} tenantName={tenant.full_name} address={property.location} rent={property.price} terms={terms} />
            )}
            {lease!.stage === "awaiting_signature" && myTurnToSign && isTenant && property && comparableStats && isPricedAboveMarket(property.price, comparableStats) && (
              <NegotiationNudge leaseId={lease!.id} askingPrice={property.price} comparableAvg={comparableStats.avgPrice} comparableCount={comparableStats.count} />
            )}
            {lease!.stage !== "awaiting_signature" ? (
              <p className="text-sm text-text-muted">Both sides signed. The full text is under “Signed agreement” below.</p>
            ) : myTurnToSign && !readyToSign ? (
              <Locked text="You can sign once the terms are saved and the LeaseMatch package is paid." />
            ) : myTurnToSign ? (
              <div className="space-y-3">
                <button
                  type="button"
                  disabled
                  title="UAE Pass sign-in requires a government-issued integration that isn't connected yet."
                  className="w-full cursor-not-allowed rounded-md border px-4 py-2 text-sm font-medium opacity-60"
                  style={{ borderColor: "var(--border)" }}
                >
                  Sign with UAE Pass (not connected yet)
                </button>
                <form action={signLeaseAction} className="rounded-md border p-4" style={{ borderColor: "var(--border)" }}>
                  <input type="hidden" name="leaseId" value={lease!.id} />
                  <label className="mb-1 block text-sm font-medium" htmlFor="signatureName">
                    Sign inside the app
                  </label>
                  <p className="mb-2 text-xs text-text-muted">Type your full name exactly as on your account ({me?.full_name}).</p>
                  <input id="signatureName" name="signatureName" required placeholder={me?.full_name} className="mb-3 w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2" style={{ borderColor: "var(--border)" }} />
                  <button type="submit" className="w-full rounded-md py-2 text-sm font-medium" style={{ background: "var(--accent)", color: "var(--accent-ink)" }}>
                    Sign agreement
                  </button>
                </form>
              </div>
            ) : (
              <p className="text-sm text-text-muted">You signed. Waiting for {counterparty?.full_name} to sign.</p>
            )}
          </div>
        );
      case "pay":
        if (!tenantProof && !paidByCard && lease!.stage === "finalized") {
          return <p className="text-sm text-text-muted">Payment recorded {lease!.payment_marked_at?.slice(0, 10)} (ref {lease!.payment_reference ?? "—"}). No file is on record for this older sample lease.</p>;
        }
        if (tenantProof || paidByCard) {
          return tenantProof ? <ProofCard proof={tenantProof} label="Proof of payment" /> : <p className="text-sm">Paid by card through Stripe · ref {lease!.payment_reference}</p>;
        }
        if (lease!.stage === "awaiting_signature") return <Locked text="Opens once both sides have signed." />;
        if (!isTenant) return <p className="text-sm text-text-muted">Waiting for the tenant to pay AED {firstPayment.toLocaleString("en-US")} and attach the proof.</p>;
        return (
          <div className="space-y-3" data-tour="deal-pay">
            <p className="text-sm">
              Pay <b>AED {firstPayment.toLocaleString("en-US")}</b> (first of {terms?.cheques ?? 1} cheque{terms?.cheques === 1 ? "" : "s"}) to {ownerName}, then attach the confirmation.
            </p>
            {(providerConfigured || cryptoConfigured) && !cryptoStarted && (
              <div className="flex flex-wrap gap-2">
                {providerConfigured && (
                  <form action={startPaymentAction}>
                    <input type="hidden" name="leaseId" value={lease!.id} />
                    <button type="submit" className="rounded-md px-3 py-2 text-xs font-medium" style={{ background: "var(--accent)", color: "var(--accent-ink)" }}>
                      Pay by card (Stripe)
                    </button>
                  </form>
                )}
                {cryptoConfigured && (
                  <form action={startCryptoPaymentAction}>
                    <input type="hidden" name="leaseId" value={lease!.id} />
                    <button type="submit" className="rounded-md border px-3 py-2 text-xs font-medium" style={{ borderColor: "var(--border)" }}>
                      Pay with crypto
                    </button>
                  </form>
                )}
              </div>
            )}
            {cryptoStarted && (
              <form action={confirmCryptoSentAction}>
                <input type="hidden" name="leaseId" value={lease!.id} />
                <button type="submit" className="rounded-md border px-3 py-2 text-xs font-medium" style={{ borderColor: "var(--border)" }}>
                  I sent the crypto payment
                </button>
              </form>
            )}
            <ProofForm leaseId={lease!.id} side="tenant" amount={firstPayment} />
          </div>
        );
      case "receipt":
        if (landlordProof) return <ProofCard proof={landlordProof} label="Proof of receipt" />;
        if (lease!.stage === "finalized") {
          return <p className="text-sm text-text-muted">Receipt confirmed {lease!.confirmed_at?.slice(0, 10)}. No file is on record for this older sample lease.</p>;
        }
        if (!dealState.tenantProof) return <Locked text="Opens once the tenant attaches the proof of payment." />;
        if (isTenant) return <p className="text-sm text-text-muted">Waiting for {ownerName} to confirm the money arrived and attach the proof of receipt.</p>;
        return (
          <div data-tour="deal-receipt">
            <p className="mb-3 text-sm">
              Check that AED {firstPayment.toLocaleString("en-US")} reached your account, then attach your proof of receipt. The agreement is concluded as soon as you do.
            </p>
            <ProofForm leaseId={lease!.id} side="landlord" amount={firstPayment} />
          </div>
        );
      case "concluded":
        return lease!.stage === "finalized" ? (
          <div className="rounded-md p-3 text-sm" style={{ background: "var(--success-soft)", color: "var(--success)" }}>
            ✓ LeaseMatch concluded the agreement automatically on {lease!.confirmed_at?.slice(0, 16)} UTC, after both payment confirmations were attached. The
            property is marked as leased and the agreement is listed under <Link href="/dashboard/leases" className="underline">Leases → Concluded agreements</Link>.
          </div>
        ) : (
          <Locked text="Nothing to press here: this happens by itself when both confirmations are attached." />
        );
      case "keys":
        return <KeysBody />;
    }
  }

  function KeysBody() {
    if (lease!.stage !== "finalized") return <Locked text="Opens once the agreement is concluded." />;
    const h = lease!;
    return (
      <div className="space-y-3" data-tour="deal-keys">
        {h.handover_method && (
          <div className="rounded-md border p-3 text-sm" style={{ borderColor: "var(--border)" }}>
            <p className="font-semibold">{h.handover_method === "in_person" ? "🤝 In hand at a meeting" : "📦 By mail"}</p>
            {h.handover_method === "in_person" ? (
              <p className="text-text-muted">
                {h.handover_date} at {h.handover_time} · {h.handover_place}
              </p>
            ) : (
              <p className="text-text-muted">
                {h.handover_address} · recipient {h.handover_recipient}
                {h.handover_phone ? ` · ${h.handover_phone}` : ""}
              </p>
            )}
            {h.handover_notes && <p className="mt-1 text-xs text-text-muted">Note: {h.handover_notes}</p>}
            <p className="mt-2 text-xs">
              {h.keys_received_at
                ? `✓ Keys received ${h.keys_received_at.slice(0, 16)} UTC`
                : h.handover_confirmed_at
                  ? `✓ Confirmed by the landlord ${h.handover_confirmed_at.slice(0, 10)}`
                  : "Waiting for the landlord to confirm"}
            </p>
          </div>
        )}
        {isTenant && phase !== "done" && phase !== "receive" && property && tenant && (
          <KeyHandoverDialog
            leaseId={h.id}
            propertyAddress={`${property.title}, ${property.location}`}
            tenantName={tenant.full_name}
            current={{
              method: h.handover_method,
              date: h.handover_date,
              time: h.handover_time,
              place: h.handover_place,
              address: h.handover_address,
              recipient: h.handover_recipient,
              phone: h.handover_phone,
              notes: h.handover_notes,
            }}
            error={handoverError}
          />
        )}
        {!isTenant && phase === "choose" && <p className="text-sm text-text-muted">Waiting for the tenant to choose how to receive the keys.</p>}
        {!isTenant && phase === "confirm" && (
          <form action={confirmHandoverAction}>
            <input type="hidden" name="leaseId" value={h.id} />
            <button type="submit" className="w-full rounded-md px-4 py-2.5 text-sm font-semibold" style={{ background: "var(--accent)", color: "var(--accent-ink)" }}>
              Confirm this handover
            </button>
            <p className="mt-1 text-xs text-text-muted">Need a different time or place? Agree it in the chat below; the tenant can update the choice.</p>
          </form>
        )}
        {isTenant && phase === "receive" && (
          <form action={keysReceivedAction}>
            <input type="hidden" name="leaseId" value={h.id} />
            <button type="submit" className="w-full rounded-md px-4 py-2.5 text-sm font-semibold" style={{ background: "var(--accent)", color: "var(--accent-ink)" }}>
              I received the keys
            </button>
          </form>
        )}
        {phase !== "done" && (
          <p className="flex gap-2 rounded-md border p-3 text-xs" style={{ borderColor: "var(--danger)", background: "#f6e6e4" }}>
            <span aria-hidden>⚠️</span>
            <span>
              Hand over keys only as agreed here: in person at the agreed place or by tracked mail with a signature. LeaseMatch never asks you to pay cash or meet anyone else.
            </span>
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1">
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
        <p className="text-sm text-text-muted">
          {property?.title} · with {counterparty?.full_name}
        </p>
        <h1 className="font-display text-2xl font-semibold mb-6">Lease agreement</h1>

        <StageTracker stage={lease.stage} />
        <GuideTour id="lease" steps={TOURS.lease} />

        <div className="mt-6">
          <DealAssistant leaseId={lease.id} steps={steps} current={step} message={assistantMessage(step, role, dealState)} />
        </div>

        {(proofError || proofSaved) && (
          <p
            className="mt-4 rounded-md p-3 text-sm"
            style={proofError ? { background: "#f6e6e4", color: "var(--danger)" } : { background: "var(--success-soft)", color: "var(--success)" }}
          >
            {proofError ?? (lease.stage === "finalized" ? "Confirmation attached. Both sides are in, so the agreement is now concluded." : "Confirmation attached.")}
          </p>
        )}

        <section id="deal-steps" data-tour="deal-steps" className="mt-6 scroll-mt-24">
          <h2 className="font-display text-lg font-semibold">Lease conclusion, step by step</h2>
          <p className="mb-4 text-xs text-text-muted">
            The current step is open. Click any other step to see what happens there.
          </p>
          <ol className="relative space-y-3">
            {steps.map((st, i) => {
              const isCurrent = st.id === step && !(st.id === "keys" && st.done);
              const status = st.done ? "Done" : isCurrent ? (waitingOnOther(st.id) ? `Waiting for ${counterpartyRole}` : "Your turn") : st.optional ? "Optional" : st.auto ? "Automatic" : "Later";
              return (
                <li key={st.id} data-tour={`step-${st.id}`}>
                  <details
                    open={isCurrent || (st.id === "keys" && lease.stage === "finalized")}
                    className="group rounded-lg border bg-surface"
                    style={{ borderColor: isCurrent ? "var(--accent)" : "var(--border)", boxShadow: isCurrent ? "0 0 0 1px var(--accent)" : undefined }}
                  >
                    <summary className="flex cursor-pointer list-none items-center gap-3 p-4">
                      <span
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                        style={
                          st.done
                            ? { background: "var(--success-soft)", color: "var(--success)" }
                            : isCurrent
                              ? { background: "var(--accent)", color: "var(--accent-ink)" }
                              : { background: "var(--field)", color: "var(--text-muted)" }
                        }
                      >
                        {st.done ? "✓" : i + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold">{st.title}</span>
                        <span className="block truncate text-xs text-text-muted">{stepSummary(st.id)}</span>
                      </span>
                      <span
                        className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                        style={
                          st.done
                            ? { background: "var(--success-soft)", color: "var(--success)" }
                            : isCurrent
                              ? { background: "var(--gold-soft)", color: "var(--gold)" }
                              : { background: "var(--field)", color: "var(--text-muted)" }
                        }
                      >
                        {status}
                      </span>
                    </summary>
                    <div className="border-t px-4 pb-4 pt-3" style={{ borderColor: "var(--border)" }}>
                      <p className="mb-3 flex gap-2 rounded-md p-3 text-xs leading-relaxed" style={{ background: "var(--gold-soft)" }}>
                        <span aria-hidden>💡</span>
                        <span>
                          <b>Tip: </b>
                          {stepTip(st.id, role, dealState)}
                        </span>
                      </p>
                      {stepBody(st.id)}
                    </div>
                  </details>
                </li>
              );
            })}
          </ol>
        </section>

        {lease.tenant_signed_at && lease.landlord_signed_at && terms && property && tenant && provider && (
          <section className="mt-6 rounded-lg border bg-surface p-6" style={{ borderColor: "var(--border)" }} data-tour="signed-agreement">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-display text-lg font-semibold">Signed agreement</h2>
              <span
                className="rounded-full px-2.5 py-0.5 text-xs font-medium"
                style={lease.stage === "finalized" ? { background: "var(--success-soft)", color: "var(--success)" } : { background: "var(--gold-soft)", color: "var(--gold)" }}
              >
                {lease.stage === "finalized" ? `In force · ${terms.startDate} → ${leaseEndDate(terms)}` : "Signed · not yet concluded"}
              </span>
            </div>
            <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed">
              {contractText({ ownerName: provider.company_name ?? provider.full_name, tenantName: tenant.full_name, address: property.location, rent: property.price, terms }).clauses.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ol>
            <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div className="rounded-md p-3" style={{ background: "var(--field)" }}>
                <p className="text-xs text-text-muted">Tenant signature</p>
                <p className="font-medium">{lease.tenant_signature_name}</p>
                <p className="text-xs text-text-muted">{lease.tenant_signed_at?.slice(0, 16)} UTC · {signatureMethodLabel(lease.tenant_signature_method)}</p>
              </div>
              <div className="rounded-md p-3" style={{ background: "var(--field)" }}>
                <p className="text-xs text-text-muted">Landlord signature</p>
                <p className="font-medium">{lease.landlord_signature_name}</p>
                <p className="text-xs text-text-muted">{lease.landlord_signed_at?.slice(0, 16)} UTC · {signatureMethodLabel(lease.landlord_signature_method)}</p>
              </div>
            </div>
            {lease.payment_marked_at && (
              <p className="mt-3 text-xs text-text-muted">
                First payment {lease.payment_provider ? `via ${paymentProviderLabel(lease.payment_provider)}` : ""}
                {lease.payment_reference ? ` · ref ${lease.payment_reference}` : ""}
                {lease.confirmed_at ? ` · concluded automatically ${lease.confirmed_at.slice(0, 10)}` : " · awaiting the landlord's proof of receipt"}
              </p>
            )}
            <p className="mt-2 text-xs text-text-muted">Prototype template — register the contract with Ejari (Dubai) or Tawtheeq (Abu Dhabi).</p>
          </section>
        )}

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

function Locked({ text }: { text: string }) {
  return (
    <p className="rounded-md p-3 text-sm text-text-muted" style={{ background: "var(--field)" }}>
      🔒 {text}
    </p>
  );
}

function ProofCard({ proof, label }: { proof: PaymentProof; label: string }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border p-3 text-sm" style={{ borderColor: "var(--border)" }}>
      <span aria-hidden className="text-xl">🧾</span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">✓ {label}</p>
        <p className="text-xs text-text-muted">
          {proof.amount ? `AED ${proof.amount.toLocaleString("en-US")} · ` : ""}
          {proof.reference ? `ref ${proof.reference} · ` : ""}
          attached {proof.created_at.slice(0, 16)} UTC
        </p>
        {proof.note && <p className="text-xs text-text-muted">{proof.note}</p>}
      </div>
      {proof.upload_id && (
        <a href={`/api/uploads/${proof.upload_id}`} target="_blank" rel="noopener" className="rounded-md border px-3 py-1.5 text-xs font-medium" style={{ borderColor: "var(--border)" }}>
          Open file
        </a>
      )}
    </div>
  );
}

// Multipart form posted to the payment-proof route (files go through an API
// route, not a server action, because of the action body-size limit).
function ProofForm({ leaseId, side, amount }: { leaseId: string; side: "tenant" | "landlord"; amount: number }) {
  return (
    <form action={`/api/leases/${leaseId}/payment-proof`} method="post" encType="multipart/form-data" className="space-y-3 rounded-md border p-4" style={{ borderColor: "var(--border)" }}>
      <p className="text-sm font-medium">{side === "tenant" ? "Attach proof of payment" : "Attach proof of receipt"}</p>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <label className="block">
          <span className="mb-1 block text-xs font-medium">Amount (AED)</span>
          <input name="amount" type="number" min={1} step={1} defaultValue={amount} className="w-full rounded-md border px-3 py-2" style={{ borderColor: "var(--border)" }} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium">Reference</span>
          <input name="reference" maxLength={80} placeholder={side === "tenant" ? "Transfer or cheque no." : "Statement ref"} className="w-full rounded-md border px-3 py-2" style={{ borderColor: "var(--border)" }} />
        </label>
      </div>
      <label className="block text-sm">
        <span className="mb-1 block text-xs font-medium">File: PDF, JPG or PNG, up to 10 MB</span>
        <input name="file" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="w-full text-xs" />
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="rounded-md px-4 py-2 text-sm font-semibold" style={{ background: "var(--accent)", color: "var(--accent-ink)" }}>
          Attach confirmation
        </button>
        <button type="submit" name="demo" value="1" formNoValidate className="rounded-md border px-4 py-2 text-sm" style={{ borderColor: "var(--border)" }}>
          Attach a sample (demo)
        </button>
      </div>
      <p className="text-xs text-text-muted">“Attach a sample” creates a labelled demo PDF so you can try the flow without a real receipt.</p>
    </form>
  );
}

function paymentProviderLabel(provider: string | null) {
  if (provider === "stripe") return "Stripe";
  if (provider === "crypto") return "crypto (NOWPayments)";
  if (provider === "simulated") return "simulated";
  if (provider === "bank_transfer") return "bank transfer (proofs attached by both sides)";
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
