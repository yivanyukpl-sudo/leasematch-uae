import { choosePackageAction, saveTermsAction } from "@/app/dashboard/actions";
import { contractText, type LeaseTerms } from "@/lib/deal";
import { PACKAGES, STAY_IN_APP_ARGUMENT, getPackage } from "@/lib/packages";

const field = "mt-1 w-full rounded-md border px-3 py-2 text-sm font-normal";

export function TermsCard({ leaseId, terms, rent, editable, error }: { leaseId: string; terms: LeaseTerms | null; rent: number; editable: boolean; error?: string }) {
  const t = terms;
  if (!editable && t) return null;
  return (
    <form action={saveTermsAction} data-tour="deal-terms" className="mb-5 space-y-3 rounded-lg border bg-surface p-5" style={{ borderColor: "var(--border)" }}>
      <input type="hidden" name="leaseId" value={leaseId} />
      <p className="font-semibold">{t ? "Contract terms (editable until signing)" : "Contract terms"}</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-xs font-medium">Move-in date<input type="date" name="startDate" required defaultValue={t?.startDate ?? ""} className={field} style={{ borderColor: "var(--border)" }} /></label>
        <label className="text-xs font-medium">Length, months<input type="number" name="months" min={1} max={36} required defaultValue={t?.months ?? 12} className={field} style={{ borderColor: "var(--border)" }} /></label>
        <label className="text-xs font-medium">Deposit, AED<input type="number" name="deposit" min={0} step={1} required defaultValue={t?.deposit ?? Math.round(rent * 0.05)} className={field} style={{ borderColor: "var(--border)" }} /></label>
        <label className="text-xs font-medium">Cheques per year
          <select name="cheques" defaultValue={t?.cheques ?? 4} className={field} style={{ borderColor: "var(--border)" }}>
            {[1, 2, 4, 6, 12].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <label className="text-xs font-medium sm:col-span-2">Utilities (DEWA/ADDC, chiller, internet)
          <select name="utilities" defaultValue={t?.utilities ?? "tenant"} className={field} style={{ borderColor: "var(--border)" }}>
            <option value="tenant">Paid by the tenant</option>
            <option value="included">Included in the rent</option>
          </select>
        </label>
      </div>
      <label className="block text-xs font-medium">Additional terms<textarea name="notes" rows={2} maxLength={600} defaultValue={t?.notes ?? ""} className={field} style={{ borderColor: "var(--border)" }} placeholder="e.g. AC servicing by the landlord before move-in" /></label>
      {error && <p className="text-sm" style={{ color: "var(--danger)" }}>{error}</p>}
      <button className="rounded-md px-4 py-2 text-sm font-medium" style={{ background: "var(--accent)", color: "var(--accent-ink)" }}>{t ? "Update terms" : "Save terms"}</button>
    </form>
  );
}

export function PackagePicker({ leaseId, isTenant, chosen, paid, canPay }: { leaseId: string; isTenant: boolean; chosen: string | null; paid: boolean; canPay: boolean }) {
  if (paid) {
    return (
      <p className="mb-5 rounded-md px-4 py-3 text-sm font-medium" style={{ background: "var(--success-soft)", color: "var(--success)" }}>
        ✓ “{getPackage(chosen)?.name}” paid — the contract can be signed.
      </p>
    );
  }
  if (!isTenant) {
    return <p className="mb-5 rounded-md px-4 py-3 text-sm text-text-muted" style={{ background: "var(--field)" }}>The tenant chooses a LeaseMatch package. It&apos;s free for you; once it&apos;s paid you can sign.</p>;
  }
  return (
    <section data-tour="deal-packages" className="mb-5 rounded-lg border bg-surface p-5" style={{ borderColor: "var(--border)" }}>
      <p className="font-semibold">Choose a package for this deal</p>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        {PACKAGES.map((p) => (
          <form key={p.id} action={choosePackageAction} className="flex flex-col rounded-lg border p-4" style={{ borderColor: p.id === "combo" ? "var(--gold-bright)" : "var(--border)", boxShadow: p.id === "combo" ? "var(--shadow-soft)" : undefined }}>
            <input type="hidden" name="leaseId" value={leaseId} />
            <input type="hidden" name="package" value={p.id} />
            {p.id === "combo" && <span className="mb-2 self-start rounded-full px-2.5 py-0.5 text-[11px] font-semibold" style={{ background: "var(--gold-soft)", color: "var(--gold)" }}>Best value</span>}
            <p className="font-semibold">{p.name}</p>
            <p className="text-xs text-text-muted">{p.tagline}</p>
            <p className="mt-2 text-2xl font-semibold">
              AED {p.price} {p.oldPrice && <span className="text-sm text-text-muted line-through">AED {p.oldPrice}</span>}
            </p>
            <ul className="mt-2 flex-1 space-y-1 text-xs text-text-muted">{p.includes.map((x) => <li key={x}>✓ {x}</li>)}</ul>
            <button disabled={!canPay} className="mt-3 rounded-md px-3 py-2 text-sm font-medium disabled:opacity-50" style={p.id === "combo" ? { background: "var(--accent)", color: "var(--accent-ink)" } : { background: "var(--field)" }}>
              Choose
            </button>
          </form>
        ))}
      </div>
      <details className="mt-4 rounded-md p-4 text-sm" style={{ background: "var(--field)" }}>
        <summary className="cursor-pointer font-medium">Why not just deal with the landlord directly?</summary>
        <ul className="mt-2 space-y-1.5 text-text-muted">{STAY_IN_APP_ARGUMENT.map((a) => <li key={a}>• {a}</li>)}</ul>
      </details>
      {!canPay && <p className="mt-3 text-xs" style={{ color: "var(--danger)" }}>Online payment is temporarily unavailable.</p>}
    </section>
  );
}

export function ContractPreview(i: { ownerName: string; tenantName: string; address: string; rent: number; terms: LeaseTerms }) {
  const c = contractText(i);
  return (
    <details data-tour="deal-contract" className="mb-5 rounded-lg border bg-surface p-5" style={{ borderColor: "var(--border)" }} open>
      <summary className="cursor-pointer font-semibold">{c.title} — preview</summary>
      <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed">{c.clauses.map((x) => <li key={x}>{x}</li>)}</ol>
      <p className="mt-3 text-xs text-text-muted">Prototype template. Have a UAE lawyer review it before real use.</p>
    </details>
  );
}
