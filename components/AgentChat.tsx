"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Message = { role: "user" | "assistant"; content: string };

const STARTERS = [
  "I need a 2-bedroom near Dubai Marina under AED 130k",
  "What's realistic for a studio under AED 40k?",
  "Find me something furnished in Downtown Dubai",
];

const MODE_CHOICES = [
  {
    label: "Browse LeaseMatch's verified listings",
    text: "Let's start with LeaseMatch's own verified database, please.",
  },
  {
    label: "Also check listings from across the web",
    text: "Please also search other UAE property sites on the web, not just LeaseMatch's own listings — I understand those won't be verified by LeaseMatch.",
  },
];

export function AgentChat({ agentConfigured }: { agentConfigured: boolean }) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: agentConfigured
        ? "Hi — I'm your LeaseMatch agent. Would you like to start by browsing LeaseMatch's own verified database, or should I also pull in listings from other UAE property sites around the web? Web results are real, but I can't verify the poster or price on those, so I'll always flag them clearly."
        : "The AI agent isn't connected yet — add OPENAI_API_KEY to the environment to enable it (see .env.local.example). Until then, use the dashboard to browse and apply directly.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [appliedThisTurn, setAppliedThisTurn] = useState(false);
  const [inquiryDraftedThisTurn, setInquiryDraftedThisTurn] = useState(false);
  const [inquirySentThisTurn, setInquirySentThisTurn] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  async function send(text: string) {
    if (!text.trim() || loading) return;
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessages((m) => [...m, { role: "assistant", content: data.error || "Something went wrong." }]);
        return;
      }
      setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
      if (data.actions?.some((a: { type: string }) => a.type === "applied")) {
        setAppliedThisTurn(true);
        router.refresh();
      }
      if (data.actions?.some((a: { type: string }) => a.type === "external_inquiry_drafted")) {
        setInquiryDraftedThisTurn(true);
      }
      if (data.actions?.some((a: { type: string }) => a.type === "external_inquiry_sent")) {
        setInquirySentThisTurn(true);
      }
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "Network error — try again." }]);
    } finally {
      setLoading(false);
      requestAnimationFrame(() => {
        listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
      });
    }
  }

  return (
    <div
      className="flex flex-col rounded-lg border bg-surface"
      style={{ borderColor: "var(--border)", height: 560 }}
    >
      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.map((m, i) => (
          <div
            key={i}
            className="max-w-[85%] rounded-md px-3 py-2 text-sm"
            style={{
              marginLeft: m.role === "user" ? "auto" : 0,
              background: m.role === "user" ? "var(--accent)" : "var(--bg)",
              color: m.role === "user" ? "var(--accent-ink)" : "var(--text)",
              border: m.role === "user" ? "none" : "1px solid var(--border)",
              whiteSpace: "pre-wrap",
            }}
          >
            {m.role === "assistant" ? <Linkified text={m.content} /> : m.content}
          </div>
        ))}
        {loading && (
          <div
            className="max-w-[85%] rounded-md border px-3 py-2 text-sm text-text-muted"
            style={{ borderColor: "var(--border)" }}
          >
            Thinking…
          </div>
        )}
        {appliedThisTurn && (
          <p className="text-xs text-text-muted">
            ✓ Application submitted — check{" "}
            <Link href="/dashboard/applications" className="underline">
              your applications
            </Link>{" "}
            for status.
          </p>
        )}
        {inquirySentThisTurn ? (
          <p className="text-xs text-text-muted">
            ✓ Sent — you can see it anytime in{" "}
            <Link href="/dashboard/inquiries" className="underline">
              your external inquiries
            </Link>
            , including any reply.
          </p>
        ) : (
          inquiryDraftedThisTurn && (
            <p className="text-xs text-text-muted">
              ✓ Draft saved — keep talking here to edit it or say the word to send it. It&apos;s
              also visible in{" "}
              <Link href="/dashboard/inquiries" className="underline">
                your external inquiries
              </Link>
              .
            </p>
          )
        )}
      </div>

      {messages.length <= 1 && agentConfigured && (
        <div className="border-t px-4 py-3" style={{ borderColor: "var(--border)" }}>
          <div className="mb-2 flex flex-wrap gap-2">
            {MODE_CHOICES.map((c) => (
              <button
                key={c.label}
                type="button"
                onClick={() => send(c.text)}
                className="rounded-full px-3 py-1.5 text-xs font-medium"
                style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
              >
                {c.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {STARTERS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => send(s)}
                className="rounded-full border px-3 py-1 text-xs"
                style={{ borderColor: "var(--border)" }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex gap-2 border-t p-3"
        style={{ borderColor: "var(--border)" }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={agentConfigured ? "Tell your agent what you need…" : "Agent not connected"}
          disabled={!agentConfigured || loading}
          className="flex-1 rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 disabled:opacity-60"
          style={{ borderColor: "var(--border)" }}
        />
        <button
          type="submit"
          disabled={!agentConfigured || loading}
          className="rounded-md px-4 py-2 text-sm font-medium disabled:opacity-60"
          style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
        >
          Send
        </button>
      </form>
    </div>
  );
}

// Turns bare https:// URLs in an agent reply into links that open in a new
// tab (the agent writes plain text; URLs are pasted bare by design).
function Linkified({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s<>"')\]]+)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (!/^https?:\/\//.test(part)) return part;
        const url = part.replace(/[.,;:!?]+$/, "");
        const trailing = part.slice(url.length);
        return (
          <span key={i}>
            <a href={url} target="_blank" rel="noopener noreferrer nofollow" className="break-all underline" style={{ color: "var(--accent)" }}>
              {url}
            </a>
            {trailing}
          </span>
        );
      })}
    </>
  );
}
