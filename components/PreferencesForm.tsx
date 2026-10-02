"use client";

import { useState } from "react";
import { savePreferences } from "@/app/dashboard/actions";
import { commonLocations, propertyTypes } from "@/lib/schemas";
import type { TenantPreferences } from "@/lib/db";

const inputClass =
  "w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2";

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border px-3 py-1 text-xs font-medium"
      style={{
        borderColor: active ? "var(--accent)" : "var(--border)",
        background: active ? "var(--gold-soft)" : "transparent",
      }}
    >
      {children}
    </button>
  );
}

export function PreferencesForm({ initial }: { initial?: TenantPreferences }) {
  const [types, setTypes] = useState<string[]>(initial?.property_types ?? []);
  const [locations, setLocations] = useState<string[]>(initial?.locations ?? []);

  return (
    <form
      action={savePreferences}
      className="space-y-4 rounded-lg border bg-surface p-6"
      style={{ borderColor: "var(--border)" }}
    >
      <div>
        <label className="mb-1 block text-sm font-medium">Property types</label>
        <div className="flex flex-wrap gap-2">
          {propertyTypes.map((t) => (
            <Chip
              key={t}
              active={types.includes(t)}
              onClick={() =>
                setTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]))
              }
            >
              {t}
            </Chip>
          ))}
        </div>
        {types.map((t) => (
          <input key={t} type="hidden" name="propertyTypes" value={t} />
        ))}
        <p className="mt-1 text-xs text-text-muted">Leave blank to match any type.</p>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Preferred locations</label>
        <div className="flex flex-wrap gap-2">
          {commonLocations.map((l) => (
            <Chip
              key={l}
              active={locations.includes(l)}
              onClick={() =>
                setLocations((prev) => (prev.includes(l) ? prev.filter((x) => x !== l) : [...prev, l]))
              }
            >
              {l}
            </Chip>
          ))}
        </div>
        {locations.map((l) => (
          <input key={l} type="hidden" name="locations" value={l} />
        ))}
        <p className="mt-1 text-xs text-text-muted">Leave blank to match any location.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="budget">
            Budget (AED/year)
          </label>
          <input
            id="budget"
            name="budget"
            type="number"
            min={0}
            defaultValue={initial?.budget ?? ""}
            className={inputClass}
            style={{ borderColor: "var(--border)" }}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="furnished">
            Furnishing
          </label>
          <select
            id="furnished"
            name="furnished"
            defaultValue={initial?.furnished ?? ""}
            className={inputClass}
            style={{ borderColor: "var(--border)" }}
          >
            <option value="">No preference</option>
            <option value="furnished">Furnished</option>
            <option value="unfurnished">Unfurnished</option>
          </select>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="notes">
          Anything else?
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          defaultValue={initial?.notes ?? ""}
          className={inputClass}
          style={{ borderColor: "var(--border)" }}
        />
      </div>

      <button
        type="submit"
        className="w-full rounded-md py-2.5 text-sm font-medium"
        style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
      >
        Save preferences
      </button>
    </form>
  );
}
