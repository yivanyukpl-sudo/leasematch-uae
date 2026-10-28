import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { addLeaseMessage, addPaymentProof, getLeaseById, getProfileById, getPropertyById, listPaymentProofs } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { sampleReceiptPdf } from "@/lib/sample-receipt";
import { saveUpload, UploadError } from "@/lib/uploads";

export const runtime = "nodejs";

// Multipart POST from the lease page: one side attaches its payment
// confirmation. The tenant's proof marks the payment as sent; the landlord's
// proof of receipt makes LeaseMatch conclude the agreement automatically.
export async function POST(req: NextRequest, ctx: RouteContext<"/api/leases/[id]/payment-proof">) {
  const { id } = await ctx.params;
  // Redirect to the host the browser used (behind a proxy req.url can be internal).
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const base = host ? `${req.headers.get("x-forwarded-proto") ?? "http"}://${host}` : req.url;
  const go = (path: string) => NextResponse.redirect(new URL(path, base), 303);
  const back = (extra = "") => go(`/dashboard/leases/${id}${extra}#deal-steps`);
  const session = await getSession();
  if (!session) return go("/login");
  const lease = getLeaseById(id);
  if (!lease || (lease.tenant_id !== session.sub && lease.provider_id !== session.sub)) {
    return go("/dashboard");
  }
  const side = lease.tenant_id === session.sub ? "tenant" : "landlord";
  const proofs = listPaymentProofs(id);
  const tenantDone = proofs.some((p) => p.side === "tenant") || (lease.payment_provider === "stripe" && Boolean(lease.payment_reference));
  const signed = Boolean(lease.tenant_signed_at && lease.landlord_signed_at);
  const fail = (msg: string) => back(`?proofError=${encodeURIComponent(msg)}`);

  if (!signed || lease.stage === "finalized") return fail("This step isn't open");
  if (proofs.some((p) => p.side === side)) return fail("You have already attached your confirmation");
  if (side === "landlord" && !tenantDone) return fail("Wait for the tenant's proof of payment first");
  if (!rateLimit(`payment-proof:${session.sub}`, 20, 60 * 60).ok) return fail("Too many uploads this hour, try later");

  const form = await req.formData().catch(() => null);
  const property = getPropertyById(lease.property_id);
  const amountRaw = Number(form?.get("amount") || 0);
  const amount = Number.isFinite(amountRaw) && amountRaw > 0 && amountRaw < 10_000_000 ? Math.round(amountRaw) : null;
  const reference = String(form?.get("reference") || "").trim().slice(0, 80) || null;
  const note = String(form?.get("note") || "").trim().slice(0, 300) || null;

  let file = form?.get("file");
  if (form?.get("demo") === "1") {
    const tenant = getProfileById(lease.tenant_id);
    const owner = getProfileById(lease.provider_id);
    const pdf = sampleReceiptPdf({
      side,
      property: property?.title ?? "Property",
      amountAed: amount ?? 0,
      reference: reference ?? `LM-${id.slice(0, 8).toUpperCase()}`,
      payer: tenant?.full_name ?? "Tenant",
      payee: owner?.full_name ?? "Landlord",
    });
    file = new File([new Uint8Array(pdf)], side === "tenant" ? "sample-proof-of-payment.pdf" : "sample-proof-of-receipt.pdf", { type: "application/pdf" });
  }
  if (!(file instanceof File) || file.size === 0) return fail("Attach a file: PDF, JPG or PNG");

  try {
    const upload = await saveUpload(file, { ownerId: session.sub, propertyId: lease.property_id, kind: "payment_proof" });
    const after = addPaymentProof({ leaseId: id, side, uploadId: upload.id, amount, reference, note, createdBy: session.sub });
    const amountText = amount ? ` AED ${amount.toLocaleString("en-US")}` : "";
    addLeaseMessage({
      leaseId: id,
      senderId: session.sub,
      body:
        side === "tenant"
          ? `Attached proof of payment${amountText}${reference ? ` (ref ${reference})` : ""}.`
          : after.stage === "finalized"
            ? `Attached proof of receipt${amountText}. Both confirmations are in: LeaseMatch concluded the agreement automatically.`
            : `Attached proof of receipt${amountText}.`,
    });
  } catch (e) {
    if (e instanceof UploadError) return fail(e.message);
    console.error("[payment proof] failed:", e instanceof Error ? e.message : e);
    return fail("Could not save the file, try again");
  }
  return back("?proof=1");
}
