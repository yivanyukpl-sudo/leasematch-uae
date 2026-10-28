"use client";

import { useRef, useState } from "react";
import { saveHandoverAction } from "@/app/dashboard/actions";

type Current = {
  method: "in_person" | "mail" | null;
  date: string | null;
  time: string | null;
  place: string | null;
  address: string | null;
  recipient: string | null;
  phone: string | null;
  notes: string | null;
};

// The tenant's separate window for choosing how to receive the keys: in hand
// at a meeting with the landlord (date, time, place) or by mail.
export function KeyHandoverDialog({
  leaseId,
  propertyAddress,
  tenantName,
  current,
  error,
}: {
  leaseId: string;
  propertyAddress: string;
  tenantName: string;
  current: Current;
  error?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [method, setMethod] = useState<"in_person" | "mail">(current.method ?? "in_person");
  const [placeKind, setPlaceKind] = useState<"apartment" | "other">(
    current.place && current.place !== propertyAddress ? "other" : "apartment"
  );
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.showModal()}
        data-tour="deal-keys-choose"
        className="w-full rounded-md px-4 py-2.5 text-sm font-semibold"
        style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
      >
        {current.method ? "Change how I receive the keys" : "🔑 Choose how to receive the keys"}
      </button>
      {error && <p className="mt-2 text-xs" style={{ color: "var(--danger)" }}>{error}</p>}

      <dialog
        ref={ref}
        className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-xl border bg-surface p-0 backdrop:bg-black/40"
        style={{ borderColor: "var(--border)" }}
        onClick={(e) => {
          if (e.target === ref.current) ref.current?.close();
        }}
      >
        <form action={saveHandoverAction} className="p-5" onSubmit={() => ref.current?.close()}>
          <input type="hidden" name="leaseId" value={leaseId} />
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-semibold">How do you want to receive the keys?</h2>
              <p className="mt-0.5 text-xs text-text-muted">The landlord confirms your choice. You can change it until then.</p>
            </div>
            <button type="button" onClick={() => ref.current?.close()} aria-label="Close" className="text-lg leading-none text-text-muted">
              ×
            </button>
          </div>

          <fieldset className="mt-4 grid gap-2 sm:grid-cols-2">
            <legend className="sr-only">Handover method</legend>
            {(
              [
                ["in_person", "🤝 In hand", "Meet the landlord at a date, time and place"],
                ["mail", "📦 By mail", "Tracked delivery to an address you give"],
              ] as const
            ).map(([value, label, hint]) => (
              <label
                key={value}
                className="cursor-pointer rounded-lg border p-3 text-sm"
                style={method === value ? { borderColor: "var(--accent)", background: "var(--gold-soft)" } : { borderColor: "var(--border)" }}
              >
                <input type="radio" name="method" value={value} checked={method === value} onChange={() => setMethod(value)} className="sr-only" />
                <b className="block">{label}</b>
                <span className="text-xs text-text-muted">{hint}</span>
              </label>
            ))}
          </fieldset>

          {method === "in_person" ? (
            <div className="mt-4 space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium">Date</span>
                  <input type="date" name="date" required min={today} defaultValue={current.date ?? ""} className="w-full rounded-md border px-3 py-2" style={{ borderColor: "var(--border)" }} />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium">Time</span>
                  <input type="time" name="time" required defaultValue={current.time ?? "10:00"} className="w-full rounded-md border px-3 py-2" style={{ borderColor: "var(--border)" }} />
                </label>
              </div>
              <div>
                <span className="mb-1 block text-xs font-medium">Place</span>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      ["apartment", "At the apartment"],
                      ["other", "Another location"],
                    ] as const
                  ).map(([value, label]) => (
                    <label key={value} className="flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-xs" style={{ borderColor: placeKind === value ? "var(--accent)" : "var(--border)" }}>
                      <input type="radio" name="placeKind" checked={placeKind === value} onChange={() => setPlaceKind(value)} />
                      {label}
                    </label>
                  ))}
                </div>
                {placeKind === "apartment" ? (
                  <>
                    <input type="hidden" name="place" value={propertyAddress} />
                    <p className="mt-2 rounded-md p-2 text-xs" style={{ background: "var(--field)" }}>📍 {propertyAddress}</p>
                  </>
                ) : (
                  <input
                    name="place"
                    required
                    minLength={3}
                    placeholder="e.g. the agency office, Marina Plaza, Level 2"
                    defaultValue={current.place && current.place !== propertyAddress ? current.place : ""}
                    className="mt-2 w-full rounded-md border px-3 py-2"
                    style={{ borderColor: "var(--border)" }}
                  />
                )}
              </div>
            </div>
          ) : (
            <div className="mt-4 space-y-3 text-sm">
              <label className="block">
                <span className="mb-1 block text-xs font-medium">Delivery address</span>
                <textarea
                  name="address"
                  required
                  minLength={10}
                  rows={2}
                  placeholder="Building, flat, street, area, emirate"
                  defaultValue={current.address ?? ""}
                  className="w-full rounded-md border px-3 py-2"
                  style={{ borderColor: "var(--border)" }}
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium">Recipient</span>
                  <input name="recipient" required defaultValue={current.recipient ?? tenantName} className="w-full rounded-md border px-3 py-2" style={{ borderColor: "var(--border)" }} />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium">Phone (optional)</span>
                  <input name="phone" type="tel" defaultValue={current.phone ?? ""} placeholder="+971 5…" className="w-full rounded-md border px-3 py-2" style={{ borderColor: "var(--border)" }} />
                </label>
              </div>
              <p className="text-xs text-text-muted">Use tracked courier with a signature on delivery.</p>
            </div>
          )}

          <label className="mt-3 block text-sm">
            <span className="mb-1 block text-xs font-medium">Note for the landlord (optional)</span>
            <input name="notes" maxLength={300} defaultValue={current.notes ?? ""} className="w-full rounded-md border px-3 py-2" style={{ borderColor: "var(--border)" }} />
          </label>

          <div className="mt-5 flex justify-end gap-2">
            <button type="button" onClick={() => ref.current?.close()} className="rounded-md border px-4 py-2 text-sm" style={{ borderColor: "var(--border)" }}>
              Cancel
            </button>
            <button type="submit" className="rounded-md px-4 py-2 text-sm font-semibold" style={{ background: "var(--accent)", color: "var(--accent-ink)" }}>
              Send to landlord
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
