import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { GuideTour } from "@/components/GuideTour";
import { TOURS } from "@/lib/tours";
import { finishInspectionAction } from "../actions";
import { getSession } from "@/lib/auth";
import { getInspection, getPropertyById, listInspectionPhotos } from "@/lib/db";
import { canAccessInspection } from "@/lib/inspection-access";
import { INSPECTION_STEPS, stepByKey, summarize, type PhotoAnalysis } from "@/lib/inspection-steps";

const sevStyle = {
  high: { background: "#fbecea", color: "var(--danger)", label: "Important" },
  medium: { background: "var(--gold-soft)", color: "var(--gold)", label: "Check" },
  low: { background: "var(--field)", color: "var(--text-muted)", label: "Minor" },
} as const;

export default async function InspectionPage({ params, searchParams }: PageProps<"/dashboard/inspections/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const session = await getSession();
  if (!session) redirect("/login");
  const insp = getInspection(id);
  if (!insp || !canAccessInspection(id, session.sub)) notFound();
  const property = getPropertyById(insp.property_id);
  const photos = listInspectionPhotos(id).map((p) => ({ ...p, a: JSON.parse(p.analysis ?? "{}") as PhotoAnalysis }));
  const byStep = (k: string) => photos.filter((p) => p.step === k);
  const mine = insp.created_by === session.sub;
  const firstOpen = INSPECTION_STEPS.find((s) => byStep(s.key).length === 0)?.key;
  const showSummary = insp.status === "done" || sp.summary === "1" || (!firstOpen && typeof sp.step !== "string");
  const stepKey = typeof sp.step === "string" && stepByKey(sp.step) ? sp.step : firstOpen ?? INSPECTION_STEPS[0].key;
  const step = stepByKey(stepKey)!;
  const idx = INSPECTION_STEPS.findIndex((s) => s.key === stepKey);
  const next = INSPECTION_STEPS[idx + 1];
  const sum = summarize(photos.map((p) => ({ step: p.step, a: p.a })));
  const anyDemo = photos.some((p) => p.a.demo);
  const backHref = insp.lease_id ? `/dashboard/leases/${insp.lease_id}` : `/properties/${insp.property_id}`;

  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
        <Link href={backHref} className="text-sm font-bold" style={{ color: "var(--gold)" }}>← Back</Link>
        <p className="mt-4 text-sm font-medium uppercase tracking-wide" style={{ color: "var(--gold)" }}>AI photo inspection · {insp.purpose === "handover" ? "move-in condition report" : insp.purpose === "listing" ? "listing quality" : "viewing check"}</p>
        <h1 className="font-display mt-1 text-2xl">{property?.title}</h1>

        <GuideTour id="inspection" steps={TOURS.inspection} />
        <ol className="mt-5 flex flex-wrap gap-1.5" data-tour="inspection-steps">
          {INSPECTION_STEPS.map((s, i) => {
            const done = byStep(s.key).length > 0;
            const active = !showSummary && s.key === stepKey;
            return (
              <li key={s.key}>
                <Link
                  href={`/dashboard/inspections/${id}?step=${s.key}`}
                  className="block rounded-full px-3 py-1.5 text-xs font-bold"
                  style={active ? { background: "var(--accent)", color: "var(--accent-ink)" } : done ? { background: "var(--success-soft)", color: "var(--success)" } : { background: "var(--field)", color: "var(--text-muted)" }}
                >
                  {done ? "✓" : i + 1} {s.title}
                </Link>
              </li>
            );
          })}
          <li>
            <Link href={`/dashboard/inspections/${id}?summary=1`} className="block rounded-full px-3 py-1.5 text-xs font-bold" style={showSummary ? { background: "var(--accent)", color: "var(--accent-ink)" } : { background: "var(--field)", color: "var(--text-muted)" }}>
              Summary
            </Link>
          </li>
        </ol>

        {anyDemo && (
          <p className="mt-4 rounded-xl p-3 text-sm" style={{ background: "var(--gold-soft)", color: "var(--gold)" }}>
            <b>Demo analysis.</b> The AI isn&apos;t connected right now, so the results below show how the check works — they are not an assessment of your photos.
          </p>
        )}

        {!showSummary ? (
          <section className="mt-6 rounded-xl border bg-surface p-6" data-tour="inspection-capture">
            <p className="text-xs font-bold text-text-muted">Step {idx + 1} of {INSPECTION_STEPS.length}</p>
            <h2 className="mt-1 text-xl font-extrabold">{step.icon} {step.title}</h2>
            <p className="mt-3 text-sm font-bold">Photograph:</p>
            <ul className="mt-1 space-y-1 text-sm">{step.shots.map((x) => <li key={x}>☐ {x}</li>)}</ul>
            <p className="mt-2 text-xs text-text-muted">The AI checks: {step.checks}.</p>

            {byStep(step.key).map((p) => (
              <div key={p.id} className="mt-5 grid gap-3 rounded-xl bg-[var(--field)] p-3 sm:grid-cols-[140px_1fr]">
                <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-white">
                  <Image src={`/api/uploads/${p.upload_id}`} alt={step.title} fill sizes="140px" className="object-cover" unoptimized />
                </div>
                <div className="text-sm">
                  {p.a.quality === "retake" ? (
                    <p className="font-bold" style={{ color: "var(--gold)" }}>↻ Retake: {p.a.retakeReason}</p>
                  ) : (
                    <p className="font-bold">Condition: {"★".repeat(p.a.condition)}{"☆".repeat(5 - p.a.condition)}</p>
                  )}
                  <p className="text-text-muted">{p.a.summary}</p>
                  <ul className="mt-2 space-y-1">
                    {p.a.issues.map((i, k) => (
                      <li key={k} className="rounded-lg px-2.5 py-1.5" style={{ background: sevStyle[i.severity].background }}>
                        <b style={{ color: sevStyle[i.severity].color }}>{sevStyle[i.severity].label}: {i.title}.</b> {i.detail}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}

            {typeof sp.error === "string" && <p className="mt-4 rounded-xl p-3 text-sm" style={{ background: "#fbecea", color: "var(--danger)" }}>{sp.error}</p>}

            {mine && insp.status === "in_progress" && (
              <form action={`/api/inspections/${id}/photo`} method="post" encType="multipart/form-data" className="mt-5 space-y-3">
                <input type="hidden" name="step" value={step.key} />
                <label htmlFor="photo" className="block rounded-xl border-2 border-dashed p-5 text-center text-sm">
                  <span className="block text-2xl">📷</span>
                  <b>{byStep(step.key).length ? "Add another photo" : "Take or choose a photo"}</b>
                  <span className="block text-xs text-text-muted">On a phone the camera opens. JPG, PNG or WebP up to 10 MB.</span>
                  <input id="photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" required className="mt-3 w-full text-sm" />
                </label>
                <div className="flex flex-wrap gap-2">
                  <button className="rounded-xl px-4 py-2 text-sm font-bold" style={{ background: "var(--accent)", color: "var(--accent-ink)" }}>Send to the AI check</button>
                  <Link href={next ? `/dashboard/inspections/${id}?step=${next.key}` : `/dashboard/inspections/${id}?summary=1`} className="rounded-xl border bg-white px-4 py-2 text-sm font-bold">
                    {byStep(step.key).length ? (next ? `Next: ${next.title} →` : "To summary →") : "Skip step"}
                  </Link>
                </div>
              </form>
            )}
          </section>
        ) : (
          <section className="mt-6 space-y-4" data-tour="inspection-summary">
            <div
              className="rounded-xl p-5"
              style={sum.verdict === "warning" ? { background: "#fbecea" } : sum.verdict === "check" ? { background: "var(--gold-soft)" } : { background: "var(--success-soft)" }}
            >
              <p className="text-lg font-extrabold">
                {photos.length === 0
                  ? "No photos yet"
                  : sum.verdict === "warning"
                    ? `Warning: ${sum.high} serious issue${sum.high === 1 ? "" : "s"} — discuss before signing`
                    : sum.verdict === "check"
                      ? "A few things to check before signing"
                      : "No serious issues found"}
              </p>
              {photos.length > 0 && <p className="text-sm">Average condition: {sum.avg} of 5 · photos: {photos.length} · steps done: {INSPECTION_STEPS.filter((s) => byStep(s.key).length).length} of {INSPECTION_STEPS.length}</p>}
            </div>
            {sum.issues.length > 0 && (
              <ul className="space-y-2">
                {sum.issues.map((i, k) => (
                  <li key={k} className="rounded-xl border bg-surface p-3 text-sm">
                    <span className="mr-2 rounded-full px-2 py-0.5 text-[11px] font-extrabold" style={{ background: sevStyle[i.severity].background, color: sevStyle[i.severity].color }}>{sevStyle[i.severity].label}</span>
                    <b>{i.title}</b> <span className="text-text-muted">· {stepByKey(i.step)?.title}</span>
                    <p className="mt-1 text-text-muted">{i.detail}</p>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-text-muted">
              The AI can be wrong and only sees what&apos;s in the photo. Check important defects in person and record them in the condition report.
            </p>
            {mine && insp.status === "in_progress" && photos.length > 0 && (
              <form action={finishInspectionAction}>
                <input type="hidden" name="inspectionId" value={id} />
                <button className="rounded-xl px-4 py-2 text-sm font-bold" style={{ background: "var(--accent)", color: "var(--accent-ink)" }}>Finish inspection</button>
              </form>
            )}
            {insp.status === "done" && <p className="text-sm font-bold" style={{ color: "var(--success)" }}>✓ Inspection finished {insp.finished_at} UTC</p>}
          </section>
        )}
      </main>
    </div>
  );
}
