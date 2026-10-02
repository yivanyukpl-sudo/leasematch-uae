"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const inputClass = "w-full rounded-md border bg-surface px-3 py-2 text-sm outline-none focus:ring-2";

const PROGRESS = [
  "Planning searches for your criteria…",
  "Searching Bayut…",
  "Searching Dubizzle…",
  "Reading result pages for individual ads…",
  "Checking every link came from a real search result…",
];

export function MarketSearchForm({
  defaults,
  agentConfigured,
  locations,
  propertyTypes,
}: {
  defaults: { area: string; propertyType: string; maxBudget: string; furnished: string };
  agentConfigured: boolean;
  locations: readonly string[];
  propertyTypes: readonly string[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading) return;
    const t = setInterval(() => setStep((s) => Math.min(s + 1, PROGRESS.length - 1)), 7000);
    return () => clearInterval(t);
  }, [loading]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const f = new FormData(e.currentTarget);
    const payload = {
      area: String(f.get("area") || ""),
      propertyType: String(f.get("propertyType") || "Apartment"),
      beds: String(f.get("beds") || "Any"),
      maxBudget: String(f.get("maxBudget") || "") || undefined,
      furnished: String(f.get("furnished") || "any"),
      sites: f.getAll("sites").map(String),
      notes: String(f.get("notes") || "") || undefined,
    };
    setStep(0);
    setLoading(true);
    try {
      const res = await fetch("/api/market/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Search failed");
        return;
      }
      router.push(`/dashboard/market?search=${data.searchId}`);
      router.refresh();
    } catch {
      setError("Network error — try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-xl border bg-surface p-5"
      style={{ borderColor: "var(--border)" }}
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs font-medium text-text-muted sm:col-span-2">
          Area
          <input
            name="area"
            list="market-areas"
            required
            defaultValue={defaults.area}
            placeholder="e.g. Dubai Marina"
            className={`${inputClass} mt-1`}
            style={{ borderColor: "var(--border)" }}
          />
          <datalist id="market-areas">
            {locations.map((l) => (
              <option key={l} value={l} />
            ))}
          </datalist>
        </label>
        <label className="text-xs font-medium text-text-muted">
          Type
          <select name="propertyType" defaultValue={defaults.propertyType} className={`${inputClass} mt-1`} style={{ borderColor: "var(--border)" }}>
            {propertyTypes.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-text-muted">
          Bedrooms
          <select name="beds" defaultValue="Any" className={`${inputClass} mt-1`} style={{ borderColor: "var(--border)" }}>
            {["Any", "Studio", "1", "2", "3", "4+"].map((b) => (
              <option key={b}>{b}</option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-text-muted">
          Max budget (AED/yr)
          <input
            name="maxBudget"
            type="number"
            min={1000}
            step={1000}
            defaultValue={defaults.maxBudget}
            className={`${inputClass} mt-1`}
            style={{ borderColor: "var(--border)" }}
          />
        </label>
        <label className="text-xs font-medium text-text-muted">
          Furnishing
          <select name="furnished" defaultValue={defaults.furnished} className={`${inputClass} mt-1`} style={{ borderColor: "var(--border)" }}>
            <option value="any">Any</option>
            <option value="furnished">Furnished</option>
            <option value="unfurnished">Unfurnished</option>
          </select>
        </label>
        <label className="text-xs font-medium text-text-muted sm:col-span-2">
          Anything else? (optional)
          <input
            name="notes"
            maxLength={300}
            placeholder="e.g. near the metro, pet friendly, sea view"
            className={`${inputClass} mt-1`}
            style={{ borderColor: "var(--border)" }}
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4 text-sm">
          <span className="text-xs font-medium text-text-muted">Search on</span>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" name="sites" value="bayut" defaultChecked /> Bayut
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" name="sites" value="dubizzle" defaultChecked /> Dubizzle
          </label>
        </div>
        <button
          type="submit"
          disabled={!agentConfigured || loading}
          className="rounded-md px-5 py-2 text-sm font-medium disabled:opacity-60"
          style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
        >
          {loading ? "Searching…" : "Search live ads"}
        </button>
      </div>

      {loading && (
        <div className="mt-4 rounded-md border p-3 text-sm" style={{ borderColor: "var(--border)", background: "var(--bg)" }}>
          <p className="font-medium">{PROGRESS[step]}</p>
          <p className="mt-1 text-xs text-text-muted">
            This usually takes 30–90 seconds — the agent runs several real web searches.
          </p>
        </div>
      )}
      {!agentConfigured && (
        <p className="mt-3 text-xs text-text-muted">
          The agent isn&apos;t connected — add <code>OPENAI_API_KEY</code> to <code>.env.local</code>.
        </p>
      )}
      {error && (
        <p className="mt-3 text-sm" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      )}
    </form>
  );
}
