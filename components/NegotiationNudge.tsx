"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { draftCounterOfferAction, postMessageAction } from "@/app/dashboard/actions";

export function NegotiationNudge({
  leaseId,
  askingPrice,
  comparableAvg,
  comparableCount,
}: {
  leaseId: string;
  askingPrice: number;
  comparableAvg: number;
  comparableCount: number;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const overBy = Math.round(((askingPrice - comparableAvg) / comparableAvg) * 100);

  async function getDraft() {
    setLoading(true);
    try {
      const { draft } = await draftCounterOfferAction(leaseId);
      setDraft(
        draft ??
          `The AI agent isn't connected yet (set OPENAI_API_KEY to enable drafting) — but here's the gist: mention that comparable ${comparableCount > 1 ? "listings" : "listing"} average AED ${comparableAvg.toLocaleString()}/year, and propose a number closer to that before signing.`
      );
    } finally {
      setLoading(false);
    }
  }

  async function sendDraft() {
    if (!draft) return;
    const fd = new FormData();
    fd.set("leaseId", leaseId);
    fd.set("body", draft);
    await postMessageAction(fd);
    setSent(true);
    router.refresh();
  }

  return (
    <div
      className="mb-4 rounded-md border p-4 text-sm"
      style={{ borderColor: "var(--gold)", background: "var(--gold-soft)" }}
    >
      <p className="mb-1 font-medium">Wait — before you sign, a note from your agent</p>
      <p className="mb-3 text-text-muted">
        This listing is AED {askingPrice.toLocaleString()}/year, about {overBy}% above the{" "}
        {comparableCount} comparable live listing{comparableCount === 1 ? "" : "s"} of this type
        in {comparableCount === 1 ? "this area" : "the same area"}, which average AED{" "}
        {comparableAvg.toLocaleString()}/year. You&apos;re welcome to sign at the asking price —
        just flagging it in case you&apos;d rather negotiate first.
      </p>

      {!draft ? (
        <button
          type="button"
          onClick={getDraft}
          disabled={loading}
          className="rounded-md border px-3 py-1.5 text-xs font-medium disabled:opacity-60"
          style={{ borderColor: "var(--accent)" }}
        >
          {loading ? "Drafting…" : "Draft a counter-offer message for the landlord"}
        </button>
      ) : sent ? (
        <p className="text-xs text-text-muted">✓ Sent to the amendment chat below.</p>
      ) : (
        <div>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={5}
            className="mb-2 w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2"
            style={{ borderColor: "var(--border)", background: "var(--surface)" }}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={sendDraft}
              className="rounded-md px-3 py-1.5 text-xs font-medium"
              style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
            >
              Send to landlord via chat
            </button>
            <button
              type="button"
              onClick={() => setDraft(null)}
              className="rounded-md border px-3 py-1.5 text-xs font-medium"
              style={{ borderColor: "var(--border)" }}
            >
              Discard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
