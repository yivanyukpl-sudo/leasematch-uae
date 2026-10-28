"use client";

import { useCallback, useEffect, useState } from "react";

export type TourStep = { target?: string; title: string; body: string };

// A click-through guide: highlights one element at a time with a short
// explanation. Opens automatically on the first visit to a screen (per
// browser) and can be replayed from the "Guide" button.
export function GuideTour({ id, steps, label = "Page guide" }: { id: string; steps: TourStep[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const key = `lm-tour-${id}`;

  useEffect(() => {
    let seen = true;
    try {
      seen = localStorage.getItem(key) === "1";
    } catch {
      /* storage blocked: don't auto-open */
    }
    if (!seen) {
      const t = setTimeout(() => setOpen(true), 600);
      return () => clearTimeout(t);
    }
  }, [key]);

  const visibleSteps = steps;
  const step = visibleSteps[i];

  const measure = useCallback(() => {
    if (!step?.target) return setRect(null);
    const el = document.querySelector(`[data-tour="${step.target}"]`);
    if (!el) return setRect(null);
    // Bring the target near the top so the tip card fits below it.
    window.scrollTo({ top: Math.max(0, el.getBoundingClientRect().top + window.scrollY - 96), behavior: "smooth" });
    setTimeout(() => setRect(el.getBoundingClientRect()), 350);
  }, [step]);

  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(measure);
    const onResize = () => measure();
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, [open, measure]);

  function close() {
    setOpen(false);
    setI(0);
    try {
      localStorage.setItem(key, "1");
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") setI((x) => Math.min(x + 1, visibleSteps.length - 1));
      if (e.key === "ArrowLeft") setI((x) => Math.max(x - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, visibleSteps.length]);

  const pad = 8;
  // Below the target if it fits, else above it, else pinned to the bottom
  // of the screen (for targets taller than the viewport).
  const CARD_H = 240;
  const cardTop = rect
    ? rect.bottom + 14 + CARD_H < window.innerHeight
      ? rect.bottom + 14
      : rect.top - 14 - CARD_H > 16
        ? rect.top - 14 - CARD_H
        : window.innerHeight - CARD_H - 16
    : undefined;
  const cardLeft = rect ? Math.min(Math.max(16, rect.left), window.innerWidth - 360) : undefined;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed z-40 flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-bold shadow-lg"
        style={{
          right: "calc(16px + env(safe-area-inset-right, 0px))",
          bottom: "calc(16px + env(safe-area-inset-bottom, 0px))",
          background: "var(--gold-bright)",
          color: "#0b1a33",
        }}
        aria-label={label}
      >
        ? Guide
      </button>
      {open && step && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={label}>
          {rect ? (
            <div
              className="pointer-events-none fixed rounded-xl transition-all duration-300"
              style={{
                top: rect.top - pad,
                left: rect.left - pad,
                width: rect.width + pad * 2,
                height: rect.height + pad * 2,
                boxShadow: "0 0 0 9999px rgba(11,26,51,.55)",
                outline: "3px solid var(--gold-bright)",
              }}
            />
          ) : (
            <div className="fixed inset-0" style={{ background: "rgba(11,26,51,.55)" }} />
          )}
          <div
            className="fixed w-[min(340px,calc(100vw-32px))] rounded-2xl bg-white p-5 shadow-2xl"
            style={rect ? { top: cardTop, left: cardLeft } : { top: "50%", left: "50%", transform: "translate(-50%,-50%)" }}
          >
            <p className="text-xs font-bold text-text-muted">
              Step {i + 1} of {visibleSteps.length}
            </p>
            <p className="mt-1 text-base font-extrabold">{step.title}</p>
            <p className="mt-1 text-sm text-text-muted">{step.body}</p>
            <div className="mt-4 flex items-center gap-2">
              <button type="button" onClick={close} className="text-xs font-bold text-text-muted">
                Skip
              </button>
              <span className="flex-1" />
              {i > 0 && (
                <button type="button" onClick={() => setI(i - 1)} className="rounded-xl border px-3 py-1.5 text-sm font-bold">
                  ←
                </button>
              )}
              <button
                type="button"
                onClick={() => (i < visibleSteps.length - 1 ? setI(i + 1) : close())}
                className="rounded-xl px-4 py-1.5 text-sm font-bold"
                style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
              >
                {i < visibleSteps.length - 1 ? "Next →" : "Got it"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
