import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { getSession } from "@/lib/auth";
import { AgentCallSimulator } from "@/components/AgentCallSimulator";
import { CallLog } from "@/components/CallLog";
import {
  getExternalInquiryById,
  getMarketListing,
  listAgentCalls,
  listExternalInquiryMessages,
} from "@/lib/db";
import { isEmailConfigured, replyToAddressFor } from "@/lib/email";
import { replyExternalInquiryAction, sendExternalInquiryAction } from "@/app/dashboard/actions";
import { markInquirySentManuallyAction } from "@/app/dashboard/market/actions";

const notices: Record<string, string> = {
  "email-not-connected":
    "In-app email sending isn't connected on this instance, so your message is saved as a draft. Use \"Open in my email app\" below to send it from your own mailbox in one click.",
  "send-failed":
    "The email provider rejected the send, so your message is saved as a draft. Check the Mailgun settings and try again, or send it from your own email app.",
};

export default async function InquiryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string }>;
}) {
  const { id } = await params;
  const { notice } = await searchParams;
  const session = await getSession();
  if (!session) redirect("/login");

  const inquiry = getExternalInquiryById(id);
  if (!inquiry) notFound();
  if (inquiry.tenant_id !== session.sub) redirect("/dashboard/inquiries");

  const messages = listExternalInquiryMessages(id);
  const draftMessage = messages.find((m) => m.direction === "outbound");
  const emailConfigured = isEmailConfigured();
  const replyTo = replyToAddressFor(id);
  const marketListing = inquiry.market_listing_id ? getMarketListing(inquiry.market_listing_id) : undefined;
  const calls = listAgentCalls(session.sub, { inquiryId: id });
  const mailto = `mailto:${inquiry.contact_email}?subject=${encodeURIComponent(
    `Inquiry about "${inquiry.listing_title}"`
  )}&body=${encodeURIComponent(draftMessage?.body ?? "")}`;

  return (
    <div className="flex flex-col flex-1">
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
        <p className="text-sm text-text-muted">
          {inquiry.source_site}
          {inquiry.listing_url ? (
            <>
              {" · "}
              <a href={inquiry.listing_url} target="_blank" rel="noreferrer" className="underline">
                View original listing
              </a>
            </>
          ) : null}
        </p>
        <h1 className="font-display text-2xl font-semibold mb-1">{inquiry.listing_title}</h1>
        <p className="text-sm text-text-muted mb-6">To: {inquiry.contact_email}</p>

        {notice && notices[notice] && inquiry.status === "draft" && (
          <p className="mb-4 rounded-md border p-3 text-sm" style={{ borderColor: "var(--accent)" }}>
            {notices[notice]}
          </p>
        )}

        <div
          className="mb-6 rounded-md border p-3 text-xs"
          style={{ borderColor: "var(--border)", background: "var(--gold-soft)", color: "var(--gold)" }}
        >
          ⚠️ Unverified, third-party listing — found on {inquiry.source_site}, not part of
          LeaseMatch&apos;s verified database. LeaseMatch is not the agent for this property.
          Consider LeaseMatch&apos;s own verified listings first when a close match exists.
        </div>

        <div
          className="rounded-lg border bg-surface p-6"
          style={{ borderColor: "var(--border)" }}
        >
          {inquiry.status === "draft" ? (
            <>
              <h2 className="font-display text-lg font-semibold mb-2">Review before sending</h2>
              <p className="text-sm text-text-muted mb-4">
                Your agent drafted this message. Nothing has been sent — edit it if you&apos;d
                like, then send it yourself.
              </p>
              {!emailConfigured && (
                <p
                  className="mb-4 rounded-md border p-3 text-xs text-text-muted"
                  style={{ borderColor: "var(--border)" }}
                >
                  Email sending isn&apos;t connected yet — set <code>MAILGUN_API_KEY</code> and{" "}
                  <code>MAILGUN_DOMAIN</code> in the environment to actually send this (see
                  .env.local.example). You can still edit and save the draft below.
                </p>
              )}
              <form action={sendExternalInquiryAction} className="space-y-3">
                <input type="hidden" name="inquiryId" value={inquiry.id} />
                <textarea
                  name="body"
                  required
                  rows={8}
                  defaultValue={draftMessage?.body}
                  className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2"
                  style={{ borderColor: "var(--border)" }}
                />
                <button
                  type="submit"
                  className="w-full rounded-md py-2 text-sm font-medium disabled:opacity-60"
                  style={
                    emailConfigured
                      ? { background: "var(--accent)", color: "var(--accent-ink)" }
                      : { border: "1px solid var(--border)" }
                  }
                >
                  {emailConfigured ? "Send inquiry" : "Save draft"}
                </button>
              </form>
              {!emailConfigured && (
                <div className="mt-4 border-t pt-4" style={{ borderColor: "var(--border)" }}>
                  <p className="mb-2 text-sm font-medium">Send it from your own email instead</p>
                  <p className="mb-3 text-xs text-text-muted">
                    Opens your mail app with the saved draft filled in. Save any edits above first.
                    Replies then go to your own inbox, not this thread.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <a
                      href={mailto}
                      className="rounded-md px-4 py-2 text-sm font-medium"
                      style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
                    >
                      Open in my email app
                    </a>
                    <form action={markInquirySentManuallyAction}>
                      <input type="hidden" name="inquiryId" value={inquiry.id} />
                      <button
                        type="submit"
                        className="rounded-md border px-4 py-2 text-sm font-medium"
                        style={{ borderColor: "var(--border)" }}
                      >
                        I&apos;ve sent it
                      </button>
                    </form>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <h2 className="font-display text-lg font-semibold mb-4">Conversation</h2>
              <ul className="mb-4 max-h-96 space-y-3 overflow-y-auto">
                {messages.map((m) => (
                  <li
                    key={m.id}
                    className="max-w-[85%] rounded-md px-3 py-2 text-sm"
                    style={{
                      marginLeft: m.direction === "outbound" ? "auto" : 0,
                      background: m.direction === "outbound" ? "var(--accent)" : "var(--bg)",
                      color: m.direction === "outbound" ? "var(--accent-ink)" : "var(--text)",
                      border: m.direction === "outbound" ? "none" : "1px solid var(--border)",
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    <p className="mb-0.5 text-[11px] opacity-75">{m.sender_label}</p>
                    {m.body}
                  </li>
                ))}
              </ul>

              {emailConfigured ? (
                <form action={replyExternalInquiryAction} className="flex gap-2">
                  <input type="hidden" name="inquiryId" value={inquiry.id} />
                  <input
                    type="text"
                    name="body"
                    required
                    placeholder="Reply…"
                    className="flex-1 rounded-md border px-3 py-2 text-sm outline-none focus:ring-2"
                    style={{ borderColor: "var(--border)" }}
                  />
                  <button
                    type="submit"
                    className="rounded-md px-4 py-2 text-sm font-medium"
                    style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
                  >
                    Send
                  </button>
                </form>
              ) : (
                <p className="text-xs text-text-muted">
                  Email sending isn&apos;t connected — replies can&apos;t be sent from here right
                  now.
                </p>
              )}

              {replyTo && (
                <p className="mt-4 text-xs text-text-muted">
                  A real reply sent to <code>{replyTo}</code> shows up in this thread
                  automatically.
                </p>
              )}
            </>
          )}
        </div>

        <section className="mt-6">
          <AgentCallSimulator
            target={{ inquiryId: inquiry.id, marketListingId: marketListing?.id }}
            calleePhone={inquiry.contact_phone}
          />
        </section>

        {calls.length > 0 && (
          <div className="mt-6">
            <CallLog calls={calls} title="Simulated calls about this listing" />
          </div>
        )}

        <div className="mt-6">
          <Link href="/dashboard/inquiries" className="text-sm font-medium" style={{ color: "var(--accent)" }}>
            ← Back to external inquiries
          </Link>
        </div>
      </main>
    </div>
  );
}
