"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { roleLabels, roles } from "@/lib/schemas";

const inputClass =
  "w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2";

export default function SignupPage() {
  const router = useRouter();
  const [role, setRole] = useState<(typeof roles)[number]>("tenant");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const payload = {
      fullName: String(form.get("fullName") || ""),
      email: String(form.get("email") || ""),
      password: String(form.get("password") || ""),
      role,
      companyName: String(form.get("companyName") || ""),
    };
    const res = await fetch("/api/auth/signup", {
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

  const needsCompany = role === "broker" || role === "pm";

  return (
    <div className="flex flex-col flex-1 items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <div
          className="rounded-lg border bg-surface p-6"
          style={{ borderColor: "var(--border)" }}
        >
          <h1 className="font-display text-xl font-semibold mb-1">Create your account</h1>
          <p className="text-sm text-text-muted mb-6">
            Tell us who you are — you can add property or search details next.
          </p>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">I am a…</label>
              <div className="grid grid-cols-1 gap-2">
                {roles.map((r) => (
                  <label
                    key={r}
                    className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer"
                    style={{
                      borderColor: role === r ? "var(--accent)" : "var(--border)",
                      background: role === r ? "var(--gold-soft)" : "transparent",
                    }}
                  >
                    <input
                      type="radio"
                      name="roleChoice"
                      value={r}
                      checked={role === r}
                      onChange={() => setRole(r)}
                      className="accent-[var(--accent)]"
                    />
                    {roleLabels[r]}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="fullName">
                Full name
              </label>
              <input id="fullName" name="fullName" required className={inputClass} style={{ borderColor: "var(--border)" }} />
            </div>

            {needsCompany && (
              <div>
                <label className="mb-1 block text-sm font-medium" htmlFor="companyName">
                  Company name
                </label>
                <input
                  id="companyName"
                  name="companyName"
                  required={needsCompany}
                  className={inputClass}
                  style={{ borderColor: "var(--border)" }}
                />
              </div>
            )}

            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="email">
                Email
              </label>
              <input id="email" name="email" type="email" required className={inputClass} style={{ borderColor: "var(--border)" }} />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                minLength={8}
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
              {loading ? "Creating account…" : "Create account"}
            </button>
          </form>
        </div>
        <p className="mt-4 text-center text-sm text-text-muted">
          Already have an account?{" "}
          <Link href="/login" className="font-medium" style={{ color: "var(--accent)" }}>
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
