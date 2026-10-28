import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { addInspectionPhoto, getInspection } from "@/lib/db";
import { analyzePhoto } from "@/lib/inspection-ai";
import { stepByKey } from "@/lib/inspection-steps";
import { rateLimit } from "@/lib/rate-limit";
import { readUpload, saveUpload, UploadError } from "@/lib/uploads";

export const runtime = "nodejs";
export const maxDuration = 120;

// Multipart POST from the inspection page: saves the photo privately, runs
// the AI analysis, and returns to the same step to show the result.
export async function POST(req: NextRequest, ctx: RouteContext<"/api/inspections/[id]/photo">) {
  const { id } = await ctx.params;
  const back = (step: string, extra = "") => NextResponse.redirect(new URL(`/dashboard/inspections/${id}?step=${step}${extra}`, req.url), 303);
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/login", req.url), 303);
  const insp = getInspection(id);
  if (!insp || insp.created_by !== session.sub || insp.status !== "in_progress") return NextResponse.redirect(new URL("/dashboard", req.url), 303);

  const form = await req.formData().catch(() => null);
  const step = String(form?.get("step") || "");
  if (!stepByKey(step)) return NextResponse.redirect(new URL(`/dashboard/inspections/${id}`, req.url), 303);
  if (!rateLimit(`inspection:${session.sub}`, 60, 60 * 60).ok) return back(step, "&error=" + encodeURIComponent("Too many photos this hour, try later"));
  const file = form?.get("photo");
  if (!(file instanceof File) || file.size === 0) return back(step, "&error=" + encodeURIComponent("Add a photo"));

  try {
    const upload = await saveUpload(file, { ownerId: session.sub, propertyId: insp.property_id, kind: "inspection" });
    if (upload.mime === "application/pdf") return back(step, "&error=" + encodeURIComponent("A photo is needed, not a PDF"));
    const analysis = await analyzePhoto(await readUpload(upload), upload.mime, step);
    addInspectionPhoto({ inspectionId: id, step, uploadId: upload.id, analysis });
  } catch (e) {
    if (e instanceof UploadError) return back(step, "&error=" + encodeURIComponent(e.message));
    console.error("[inspection photo] failed:", e instanceof Error ? e.message : e);
    return back(step, "&error=" + encodeURIComponent("Could not process the photo, try again"));
  }
  return back(step, "&done=1");
}
