import { deleteAlertAction, saveAlertAction } from "@/app/alerts/actions";
import type { SavedAlert } from "@/lib/db";
import { aedPerYear } from "@/lib/format";

// Shown when nothing matches yet: instead of going back to portals and
// commission-charging agents, the user waits inside LeaseMatch.
export function StayAndWait({
  role,
  filters,
  back,
  alerts,
  justSaved,
  waitingCount,
}: {
  role: "tenant" | "provider";
  filters?: { location?: string; maxPrice?: number; minBeds?: number; type?: string };
  back: string;
  alerts: SavedAlert[];
  justSaved?: boolean;
  waitingCount?: number;
}) {
  const tenant = role === "tenant";
  return (
    <div data-tour="stay-and-wait" className="rounded-2xl border bg-surface p-6" style={{ borderColor: "var(--border)" }}>
      <p className="text-3xl" aria-hidden>{tenant ? "🔔" : "⏳"}</p>
      <h2 className="mt-2 text-xl font-semibold">{tenant ? "Nothing yet — stay with us" : "No tenants yet — no need to go elsewhere"}</h2>
      <p className="mt-2 max-w-2xl text-sm text-text-muted">
        {tenant
          ? "Landlords, property managers and agents who charge their commission to the landlord (not you) add new homes every day. Don't go back to portals and agency fees — we'll email you the moment a home matching your search appears, and your LeaseMatch agent keeps looking."
          : `Tenants join LeaseMatch every day.${waitingCount ? ` ${waitingCount} tenant(s) are waiting for a home like yours right now.` : ""} Keep your listing live — we'll email you as soon as a new tenant is looking in your area.`}
      </p>
      {justSaved ? (
        <p className="mt-4 rounded-md px-4 py-3 text-sm font-medium" style={{ background: "#e6f3ec", color: "#2f7d5e" }}>
          ✓ Done — we&apos;ll email you as soon as there&apos;s a match.
        </p>
      ) : (
        <form action={saveAlertAction} className="mt-4 flex flex-wrap items-end gap-2">
          <input type="hidden" name="back" value={back} />
          <label className="text-xs font-medium">
            Area
            <input name="location" defaultValue={filters?.location ?? ""} placeholder="e.g. Al Reem Island" className="mt-1 block rounded-md border px-3 py-2 text-sm" style={{ borderColor: "var(--border)" }} />
          </label>
          {tenant && (
            <>
              <label className="text-xs font-medium">
                Max AED/year
                <input name="maxPrice" type="number" min={0} step={500} defaultValue={filters?.maxPrice ?? ""} className="mt-1 block w-36 rounded-md border px-3 py-2 text-sm" style={{ borderColor: "var(--border)" }} />
              </label>
              <input type="hidden" name="minBeds" value={filters?.minBeds ?? ""} />
              <input type="hidden" name="type" value={filters?.type ?? ""} />
            </>
          )}
          <button className="rounded-md px-4 py-2 text-sm font-medium" style={{ background: "var(--accent)", color: "var(--accent-ink)" }}>
            {tenant ? "Notify me" : "Notify me about new tenants"}
          </button>
        </form>
      )}
      {alerts.length > 0 && (
        <ul className="mt-4 space-y-1.5 text-sm">
          {alerts.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-2 rounded-md px-3 py-2" style={{ background: "var(--bg)" }}>
              <span>
                🔔 {a.location ?? "Any area"}
                {a.max_price ? ` · up to ${aedPerYear(a.max_price)}` : ""}
              </span>
              <form action={deleteAlertAction}>
                <input type="hidden" name="alertId" value={a.id} />
                <button className="text-xs font-medium" style={{ color: "var(--danger)" }}>Turn off</button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
