"use client";

import { useState } from "react";
import { askDealAssistantAction } from "@/app/dashboard/actions";

type Step = { id: string; title: string; done: boolean; optional?: boolean };

// The chat-style helper that leads each step of the contract.
export function DealAssistant({ leaseId, steps, current, message }: { leaseId: string; steps: Step[]; current: string; message: string }) {
  const [q, setQ] = useState("");
  const [thread, setThread] = useState<{ role: "me" | "bot"; text: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const doneCount = steps.filter((s) => s.done && !s.optional).length;
  const total = steps.filter((s) => !s.optional).length;

  async function ask(text: string) {
    if (!text.trim() || busy) return;
    setThread((t) => [...t, { role: "me", text }]);
    setQ("");
    setBusy(true);
    const { answer } = await askDealAssistantAction(leaseId, text);
    setBusy(false);
    setThread((t) => [...t, { role: "bot", text: answer }]);
  }

  return (
    <section data-tour="deal-assistant" className="rounded-xl border bg-surface p-5">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-extrabold text-white" style={{ background: "var(--accent)" }}>AI</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-extrabold">Deal assistant</p>
          <p className="text-xs text-text-muted">Guides every step of the contract · {doneCount} of {total} done</p>
        </div>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-field">
        <div className="h-full rounded-full" style={{ width: `${(doneCount / total) * 100}%`, background: "var(--gold-bright)" }} />
      </div>
      <ol className="mt-4 flex flex-wrap gap-1.5 text-xs">
        {steps.map((s) => (
          <li
            key={s.id}
            className="rounded-full px-2.5 py-1 font-semibold"
            style={
              s.id === current
                ? { background: "var(--accent)", color: "var(--accent-ink)" }
                : s.done
                  ? { background: "var(--success-soft)", color: "var(--success)" }
                  : { background: "var(--field)", color: "var(--text-muted)" }
            }
          >
            {s.done ? "✓ " : ""}
            {s.title}
            {s.optional && !s.done ? " (recommended)" : ""}
          </li>
        ))}
      </ol>
      <div className="mt-4 space-y-2">
        <p className="max-w-[90%] rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm" style={{ background: "var(--gold-soft)" }}>{message}</p>
        {thread.map((m, i) => (
          <p
            key={i}
            className={`max-w-[90%] rounded-2xl px-4 py-2.5 text-sm ${m.role === "me" ? "ml-auto" : ""}`}
            style={m.role === "me" ? { background: "var(--accent)", color: "var(--accent-ink)" } : { background: "var(--field)" }}
          >
            {m.text}
          </p>
        ))}
        {busy && <p className="text-xs text-text-muted">Assistant is typing…</p>}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {["Why pay if I can go direct?", "What about the deposit?", "How many cheques?"].map((s) => (
          <button key={s} type="button" onClick={() => ask(s)} className="rounded-full border bg-white px-3 py-1 text-xs font-semibold">
            {s}
          </button>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(q);
        }}
        className="mt-3 flex gap-2"
      >
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask the assistant about any step…" className="min-w-0 flex-1 text-sm" />
        <button disabled={busy || !q.trim()} className="rounded-xl px-4 py-2 text-sm font-bold disabled:opacity-50" style={{ background: "var(--accent)", color: "var(--accent-ink)" }}>
          Ask
        </button>
      </form>
    </section>
  );
}
