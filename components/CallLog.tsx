import type { AgentCall } from "@/lib/db";

export function CallLog({ calls, title }: { calls: AgentCall[]; title?: string }) {
  return (
    <section>
      {title && <h2 className="font-display mb-3 text-lg font-semibold">{title}</h2>}
      <ul className="space-y-3">
        {calls.map((c) => (
          <li key={c.id} className="rounded-lg border bg-surface p-4" style={{ borderColor: "var(--border)" }}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-medium">{c.outcome}</p>
              <span className="text-xs text-text-muted">
                {c.created_at} UTC · {Math.floor(c.duration_seconds / 60)}:
                {String(c.duration_seconds % 60).padStart(2, "0")} · simulated
              </span>
            </div>
            <p className="text-sm text-text-muted">
              {c.listing_title} · {c.callee_label}
            </p>
            <p className="mt-2 text-sm">{c.summary}</p>
            <details className="mt-2">
              <summary className="cursor-pointer text-xs font-medium text-text-muted">Transcript</summary>
              <ol className="mt-2 space-y-1.5 text-sm">
                {c.transcript.map((l, i) => (
                  <li key={i}>
                    <span className="font-semibold">{l.speaker === "agent" ? "Agent (AI): " : "Advertiser: "}</span>
                    {l.text}
                  </li>
                ))}
              </ol>
            </details>
          </li>
        ))}
      </ul>
    </section>
  );
}
