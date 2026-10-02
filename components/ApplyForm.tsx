"use client";

import { submitApplication } from "@/app/dashboard/actions";

const inputClass =
  "w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2";

export function ApplyForm({ propertyId }: { propertyId: string }) {
  return (
    <form
      action={submitApplication}
      className="space-y-4 rounded-lg border bg-surface p-6"
      style={{ borderColor: "var(--border)" }}
    >
      <input type="hidden" name="propertyId" value={propertyId} />
      <h2 className="font-display text-lg font-semibold">Apply for this property</h2>

      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="occupation">
          Occupation
        </label>
        <input
          id="occupation"
          name="occupation"
          required
          placeholder="e.g. Marketing manager"
          className={inputClass}
          style={{ borderColor: "var(--border)" }}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="monthlyIncome">
            Monthly income (AED)
          </label>
          <input
            id="monthlyIncome"
            name="monthlyIncome"
            type="number"
            min={0}
            className={inputClass}
            style={{ borderColor: "var(--border)" }}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="moveIn">
            Preferred move-in
          </label>
          <input
            id="moveIn"
            name="moveIn"
            placeholder="e.g. Flexible, or a date"
            className={inputClass}
            style={{ borderColor: "var(--border)" }}
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="note">
          Note to the provider (optional)
        </label>
        <textarea
          id="note"
          name="note"
          rows={3}
          className={inputClass}
          style={{ borderColor: "var(--border)" }}
        />
      </div>

      <button
        type="submit"
        className="w-full rounded-md py-2.5 text-sm font-medium"
        style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
      >
        Submit application
      </button>
    </form>
  );
}
