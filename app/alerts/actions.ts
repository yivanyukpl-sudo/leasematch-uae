"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { notifyProvidersAboutTenant } from "@/lib/alerts";
import { createSavedAlert, deactivateSavedAlert } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";

const opt = (v: FormDataEntryValue | null) => (v == null || String(v).trim() === "" ? null : String(v).trim().slice(0, 80));
const num = (v: FormDataEntryValue | null) => (v == null || String(v).trim() === "" || Number.isNaN(Number(v)) ? null : Number(v));

export async function saveAlertAction(formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!rateLimit(`alert:${session.sub}`, 20, 60 * 60).ok) return;
  const kind = session.role === "tenant" ? "listing" : "tenant";
  const alert = createSavedAlert({
    profile_id: session.sub,
    kind,
    location: opt(formData.get("location")),
    max_price: num(formData.get("maxPrice")),
    min_beds: num(formData.get("minBeds")),
    property_type: opt(formData.get("type")),
    note: opt(formData.get("note")),
  });
  if (kind === "listing") await notifyProvidersAboutTenant(alert);
  revalidatePath("/listings");
  revalidatePath("/dashboard");
  const back = String(formData.get("back") || "/dashboard");
  redirect(back.startsWith("/") ? `${back}${back.includes("?") ? "&" : "?"}alert=saved` : "/dashboard");
}

export async function deleteAlertAction(formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/login");
  deactivateSavedAlert(String(formData.get("alertId") || ""), session.sub);
  revalidatePath("/dashboard");
  revalidatePath("/listings");
}
