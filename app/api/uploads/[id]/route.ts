import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getUpload, inspectionIdsForUpload } from "@/lib/db";
import { canAccessInspection } from "@/lib/inspection-access";
import { readUpload } from "@/lib/uploads";

export const runtime = "nodejs";

// Inspection photos: visible to the uploader and, for a handover, the other
// party of the lease.
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/uploads/[id]">) {
  const { id } = await ctx.params;
  const upload = getUpload(id);
  if (!upload) return new NextResponse("Not found", { status: 404 });
  if (upload.kind !== "photo") {
    const session = await getSession();
    const allowed = session && (session.sub === upload.owner_id || inspectionIdsForUpload(upload.id).some((i) => canAccessInspection(i, session.sub)));
    if (!allowed) return new NextResponse("Not found", { status: 404 });
  }
  let body: Buffer;
  try {
    body = await readUpload(upload);
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
  return new NextResponse(new Uint8Array(body), {
    headers: {
      "Content-Type": upload.mime,
      "Content-Length": String(body.length),
      "Content-Security-Policy": "sandbox; default-src 'none'",
      "Cache-Control": upload.kind === "photo" ? "public, max-age=31536000, immutable" : "private, no-store",
    },
  });
}
