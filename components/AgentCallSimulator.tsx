"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { CallLine } from "@/lib/db";
import type { CallScript } from "@/lib/call-script";
import { callScenarios } from "@/lib/call-script";
import {
  saveSimulatedCallAction,
  startSimulatedCallAction,
  type CallTarget,
} from "@/app/dashboard/market/actions";

// A *simulated* AI phone call to a landlord/advertiser. Nothing is dialled:
// the server builds a scripted transcript from the ad's details and this
// component plays it back like a live call (optionally voiced with the
// browser's own speech synthesis), then saves it to the call log.

type Phase = "idle" | "dialing" | "ringing" | "live" | "ended";

function maskPhone(phone: string | null) {
  if (!phone) return "the number on the ad";
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 4 ? `+${digits.slice(0, 3)} ••• ••${digits.slice(-3)}` : "the number on the ad";
}

function fmt(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function AgentCallSimulator({
  target,
  calleePhone,
  followUpHref,
}: {
  target: CallTarget;
  calleePhone: string | null;
  followUpHref?: string;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [scenario, setScenario] = useState<string>("random");
  const [voice, setVoice] = useState(false);
  const [script, setScript] = useState<CallScript | null>(null);
  const [shown, setShown] = useState<CallLine[]>([]);
  const [typing, setTyping] = useState<{ speaker: CallLine["speaker"]; text: string } | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [saved, setSaved] = useState(false);
  const [heard, setHeard] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const cancelled = useRef(false);
  const seedRef = useRef<string>("");
  const heardRef = useRef(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (phase !== "live") return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [phase]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [shown, typing]);

  useEffect(
    () => () => {
      cancelled.current = true;
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    },
    []
  );

  function speak(line: CallLine): Promise<void> {
    const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
    if (!voice || !synth) return Promise.resolve();
    return new Promise((resolve) => {
      const u = new SpeechSynthesisUtterance(line.text.replace(/^\[Voicemail\]\s*/, ""));
      const voices = synth.getVoices().filter((v) => v.lang.startsWith("en"));
      const agentVoice = voices.find((v) => /female|samantha|serena|karen|moira/i.test(v.name)) ?? voices[0];
      const calleeVoice = voices.find((v) => v !== agentVoice && /male|daniel|alex|fred|rishi/i.test(v.name)) ?? voices[1] ?? voices[0];
      u.voice = (line.speaker === "agent" ? agentVoice : calleeVoice) ?? null;
      u.rate = 1.05;
      u.onend = () => resolve();
      u.onerror = () => resolve();
      synth.speak(u);
    });
  }

  async function save(linesHeard: number, sc: string) {
    const res = await saveSimulatedCallAction({ target, seed: seedRef.current, scenario: sc, linesHeard });
    if ("error" in res && res.error) setError(res.error);
    else {
      setSaved(true);
      router.refresh();
    }
  }

  async function startCall() {
    setError(null);
    setSaved(false);
    setShown([]);
    setTyping(null);
    setElapsed(0);
    heardRef.current = 0;
    setHeard(0);
    cancelled.current = false;

    const res = await startSimulatedCallAction(target, scenario);
    if ("error" in res) {
      setError(res.error ?? "Couldn't start the call");
      return;
    }
    seedRef.current = res.seed;
    setScript(res.script);

    setPhase("dialing");
    await sleep(1400);
    if (cancelled.current) return;
    setPhase("ringing");
    await sleep(res.script.scenario === "voicemail" ? 3600 : 2400);
    if (cancelled.current) return;
    setPhase("live");

    for (const line of res.script.lines) {
      if (cancelled.current) return;
      const words = line.text.split(" ");
      const voicePromise = speak(line);
      for (let i = 1; i <= words.length; i++) {
        if (cancelled.current) return;
        setTyping({ speaker: line.speaker, text: words.slice(0, i).join(" ") });
        await sleep(voice ? 55 : 38);
      }
      await voicePromise;
      if (cancelled.current) return;
      setTyping(null);
      setShown((s) => [...s, line]);
      heardRef.current += 1;
      setHeard(heardRef.current);
      await sleep(voice ? 250 : 650);
    }
    setPhase("ended");
    await save(res.script.lines.length, res.script.scenario);
  }

  async function hangUp() {
    cancelled.current = true;
    window.speechSynthesis?.cancel();
    setTyping(null);
    setPhase("ended");
    if (script && heardRef.current > 0) await save(heardRef.current, script.scenario);
  }

  const active = phase === "dialing" || phase === "ringing" || phase === "live";
  const speaking = typing?.speaker;

  return (
    <div className="overflow-hidden rounded-xl border bg-surface" style={{ borderColor: "var(--border)" }}>
      <div className="flex items-center justify-between gap-3 border-b px-5 py-3" style={{ borderColor: "var(--border)" }}>
        <div>
          <p className="font-medium">Have the agent call the advertiser</p>
          <p className="text-xs text-text-muted">
            Simulation only — no real call is placed and nothing is dialled.
          </p>
        </div>
        <span
          className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
          style={{ background: "var(--gold-soft)", color: "var(--gold)" }}
        >
          Simulated
        </span>
      </div>

      {phase === "idle" && (
        <div className="space-y-3 p-5">
          <p className="text-sm text-text-muted">
            Your agent would call {maskPhone(calleePhone)}, say up front that it&apos;s an AI calling for
            you, then ask about availability, cheques, deposit and a viewing. It never agrees to
            anything on your behalf.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-xs text-text-muted">
              Simulated response{" "}
              <select
                value={scenario}
                onChange={(e) => setScenario(e.target.value)}
                className="ml-1 rounded-md border bg-surface px-2 py-1 text-xs"
                style={{ borderColor: "var(--border)" }}
              >
                <option value="random">Surprise me</option>
                {Object.entries(callScenarios).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-1.5 text-xs text-text-muted">
              <input type="checkbox" checked={voice} onChange={(e) => setVoice(e.target.checked)} />
              Play voices (browser speech)
            </label>
          </div>
          <button
            type="button"
            onClick={startCall}
            className="rounded-md px-4 py-2 text-sm font-medium"
            style={{ background: "var(--success)", color: "#fff" }}
          >
            📞 Start simulated call
          </button>
          {error && <p className="text-sm" style={{ color: "var(--danger)" }}>{error}</p>}
        </div>
      )}

      {phase !== "idle" && script && (
        <div className="grid md:grid-cols-[220px_1fr]">
          <div className="flex flex-col items-center justify-center gap-3 bg-[#0e2a4d] p-6 text-white">
            <div className="relative flex h-20 w-20 items-center justify-center">
              {(phase === "dialing" || phase === "ringing") && (
                <>
                  <span className="absolute inset-0 animate-ping rounded-full bg-white/20" />
                  <span className="absolute inset-2 animate-pulse rounded-full bg-white/10" />
                </>
              )}
              <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-white/15 font-display text-2xl">
                {script.calleeLabel[0]}
              </span>
            </div>
            <p className="text-center text-sm font-medium">{script.calleeLabel}</p>
            <p className="font-mono text-xs text-white/70">
              {phase === "dialing" && "Dialling…"}
              {phase === "ringing" && "Ringing…"}
              {phase === "live" && fmt(elapsed)}
              {phase === "ended" && "Call ended"}
            </p>
            <div className="flex h-8 items-end gap-1" aria-hidden>
              {Array.from({ length: 9 }).map((_, i) => (
                <span
                  key={i}
                  className="w-1 rounded-full"
                  style={{
                    height: phase === "live" && speaking ? `${20 + ((i * 37 + elapsed * 13) % 80)}%` : "15%",
                    background: speaking === "agent" ? "#d4ac63" : "#9db6e4",
                    transition: "height 160ms",
                  }}
                />
              ))}
            </div>
            <p className="h-4 text-[11px] text-white/60">
              {phase === "live" && speaking ? (speaking === "agent" ? "Agent speaking" : "Advertiser speaking") : ""}
            </p>
            {active && (
              <button
                type="button"
                onClick={hangUp}
                className="rounded-full px-4 py-1.5 text-xs font-semibold"
                style={{ background: "var(--danger)" }}
              >
                Hang up
              </button>
            )}
          </div>

          <div className="flex flex-col">
            <div ref={listRef} className="h-72 space-y-2.5 overflow-y-auto p-4">
              {phase !== "live" && phase !== "ended" && (
                <p className="text-center text-xs text-text-muted">Live transcript will appear here…</p>
              )}
              {shown.map((l, i) => (
                <TranscriptLine key={i} line={l} />
              ))}
              {typing && <TranscriptLine line={typing} live />}
            </div>
            {phase === "ended" && (
              <div className="border-t p-4 text-sm" style={{ borderColor: "var(--border)", background: "var(--bg)" }}>
                <p className="font-medium">
                  {heard < script.lines.length ? "Call ended early" : script.outcome}
                </p>
                {heard >= script.lines.length && (
                  <p className="mt-1 text-text-muted">{script.summary}</p>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <span className="text-xs text-text-muted">
                    {saved ? "✓ Saved to your call log" : error ? error : "Saving…"}
                  </span>
                  {followUpHref && (
                    <a href={followUpHref} className="text-xs font-medium underline">
                      Follow up by email
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => setPhase("idle")}
                    className="rounded-md border px-3 py-1 text-xs font-medium"
                    style={{ borderColor: "var(--border)" }}
                  >
                    New call
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function TranscriptLine({ line, live }: { line: CallLine; live?: boolean }) {
  const agent = line.speaker === "agent";
  return (
    <div className={`flex ${agent ? "justify-start" : "justify-end"}`}>
      <div
        className="max-w-[85%] rounded-lg px-3 py-2 text-sm"
        style={{
          background: agent ? "var(--gold-soft)" : "var(--bg)",
          border: agent ? "none" : "1px solid var(--border)",
        }}
      >
        <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
          {agent ? "LeaseMatch agent (AI)" : "Advertiser"}
        </p>
        {line.text}
        {live && <span className="ml-0.5 inline-block h-3 w-1 animate-pulse bg-current align-middle opacity-60" />}
      </div>
    </div>
  );
}
