"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { amenityOptions, propertyTypes } from "@/lib/schemas";

const inputClass =
  "w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2";

export function NewPropertyForm() {
  const router = useRouter();
  const [amenities, setAmenities] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function toggleAmenity(a: string) {
    setAmenities((prev) =>
      prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]
    );
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const payload = {
      title: String(form.get("title") || ""),
      propertyType: String(form.get("propertyType") || ""),
      location: String(form.get("location") || ""),
      price: String(form.get("price") || ""),
      beds: String(form.get("beds") || "0"),
      baths: String(form.get("baths") || "1"),
      sqft: String(form.get("sqft") || ""),
      furnished: String(form.get("furnished") || "unfurnished"),
      description: String(form.get("description") || ""),
      amenities,
    };

    const res = await fetch("/api/properties", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Something went wrong");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <>
      <h1 className="font-display text-2xl font-semibold mb-1">Add a property</h1>
      <p className="text-sm text-text-muted mb-6">
        New listings start as pending verification before they go live to tenants.
      </p>

      <form
        onSubmit={onSubmit}
        className="space-y-4 rounded-lg border bg-surface p-6"
        style={{ borderColor: "var(--border)" }}
      >
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="title">
            Listing title
          </label>
          <input
            id="title"
            name="title"
            required
            placeholder="e.g. Marina view 2BR with balcony"
            className={inputClass}
            style={{ borderColor: "var(--border)" }}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="propertyType">
              Property type
            </label>
            <select
              id="propertyType"
              name="propertyType"
              required
              className={inputClass}
              style={{ borderColor: "var(--border)" }}
            >
              {propertyTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="location">
              Location
            </label>
            <input
              id="location"
              name="location"
              required
              placeholder="e.g. Dubai Marina"
              className={inputClass}
              style={{ borderColor: "var(--border)" }}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="price">
              Annual rent (AED)
            </label>
            <input
              id="price"
              name="price"
              type="number"
              min={0}
              required
              className={inputClass}
              style={{ borderColor: "var(--border)" }}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="beds">
              Bedrooms
            </label>
            <input
              id="beds"
              name="beds"
              type="number"
              min={0}
              defaultValue={1}
              className={inputClass}
              style={{ borderColor: "var(--border)" }}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="baths">
              Bathrooms
            </label>
            <input
              id="baths"
              name="baths"
              type="number"
              min={0}
              defaultValue={1}
              className={inputClass}
              style={{ borderColor: "var(--border)" }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="sqft">
              Size (sqft)
            </label>
            <input
              id="sqft"
              name="sqft"
              type="number"
              min={0}
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
              className={inputClass}
              style={{ borderColor: "var(--border)" }}
            >
              <option value="unfurnished">Unfurnished</option>
              <option value="furnished">Furnished</option>
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Amenities</label>
          <div className="flex flex-wrap gap-2">
            {amenityOptions.map((a) => (
              <button
                type="button"
                key={a}
                onClick={() => toggleAmenity(a)}
                className="rounded-full border px-3 py-1 text-xs font-medium"
                style={{
                  borderColor: amenities.includes(a) ? "var(--accent)" : "var(--border)",
                  background: amenities.includes(a) ? "var(--gold-soft)" : "transparent",
                }}
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="description">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            rows={4}
            className={inputClass}
            style={{ borderColor: "var(--border)" }}
          />
        </div>

        {error && (
          <p className="text-sm" style={{ color: "var(--danger)" }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md py-2.5 text-sm font-medium disabled:opacity-60"
          style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
        >
          {loading ? "Saving…" : "Add property"}
        </button>
      </form>
    </>
  );
}
