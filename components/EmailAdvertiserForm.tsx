"use client";

import { useActionState } from "react";
import { emailAdvertiserAction } from "@/app/dashboard/market/actions";

export function EmailAdvertiserForm({
  listingId,
  defaultTo,
  defaultBody,
  emailConfigured,
  isResultsPage,
}: {
  isResultsPage: boolean;
  listingId: string;
  defaultTo: string;
  defaultBody: string;
  emailConfigured: boolean;
}) {
  const [state, action, pending] = useActionState(emailAdvertiserAction, undefined);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="listingId" value={listingId} />
      {isResultsPage && (
        <label className="block text-xs font-medium text-text-muted">
          Which ad on that page? (building, beds, price)
          <input
            name="adTitle"
            required
            maxLength={200}
            placeholder="e.g. Princess Tower 2BR, sea view, AED 140,000"
            className="mt-1 w-full rounded-md border bg-surface px-3 py-2 text-sm outline-none focus:ring-2"
            style={{ borderColor: "var(--border)" }}
          />
        </label>
      )}
      <label className="block text-xs font-medium text-text-muted">
        To — the advertiser&apos;s email from the ad
        <input
          name="toEmail"
          type="email"
          required
          defaultValue={defaultTo}
          placeholder="agent@agency.ae"
          className="mt-1 w-full rounded-md border bg-surface px-3 py-2 text-sm outline-none focus:ring-2"
          style={{ borderColor: "var(--border)" }}
        />
      </label>
      {!defaultTo && (
        <p className="text-xs text-text-muted">
          This ad didn&apos;t show an email address in search results. Most portals hide it behind
          a contact button, so open the ad, copy the agent&apos;s or agency&apos;s email, and paste it
          above. The agent never guesses addresses.
        </p>
      )}
      <label className="block text-xs font-medium text-text-muted">
        Message
        <textarea
          name="body"
          required
          rows={9}
          defaultValue={defaultBody}
          className="mt-1 w-full rounded-md border bg-surface px-3 py-2 text-sm outline-none focus:ring-2"
          style={{ borderColor: "var(--border)" }}
        />
      </label>
      <p className="text-xs text-text-muted">
        A footer is added saying it was sent via LeaseMatch on your behalf, and that LeaseMatch
        hasn&apos;t verified this listing. Replies come back into your External inquiries thread.
      </p>
      {state?.error && (
        <p className="text-sm" style={{ color: "var(--danger)" }}>
          {state.error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          name="intent"
          value="send"
          disabled={pending}
          className="rounded-md px-4 py-2 text-sm font-medium disabled:opacity-60"
          style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
        >
          {emailConfigured ? "Send email" : "Continue to send"}
        </button>
        <button
          type="submit"
          name="intent"
          value="draft"
          disabled={pending}
          className="rounded-md border px-4 py-2 text-sm font-medium disabled:opacity-60"
          style={{ borderColor: "var(--border)" }}
        >
          Save as draft
        </button>
      </div>
      {!emailConfigured && (
        <p className="text-xs text-text-muted">
          In-app sending isn&apos;t connected (no Mailgun keys), so the next page lets you send it
          from your own email app in one click.
        </p>
      )}
    </form>
  );
}
