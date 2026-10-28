"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { createInspection, finishInspection, getInspection, getLeaseById, getPropertyById } from "@/lib/db";


export async function startInspectionAction(formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/login");
  const leaseId = String(formData.get("leaseId") || "") || null;
  let propertyId = String(formData.get("propertyId") || "");
  let purpose: "viewing" | "handover" | "listing" = "viewing";
  if (leaseId) {
    const lease = getLeaseById(leaseId);
    if (!lease || (lease.tenant_id !== session.sub && lease.provider_id !== session.sub)) redirect("/dashboard");
    propertyId = lease.property_id;
    purpose = "handover";
  }
  const property = getPropertyById(propertyId);
  if (!property) redirect("/dashboard");
  if (!leaseId) {
    if (property.provider_id === session.sub) purpose = "listing";
    else if (session.role !== "tenant") redirect("/dashboard");
  }
  const insp = createInspection({ propertyId, leaseId, createdBy: session.sub, purpose });
  redirect(`/dashboard/inspections/${insp.id}`);
}

export async function finishInspectionAction(formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/login");
  const insp = getInspection(String(formData.get("inspectionId") || ""));
  if (!insp || insp.created_by !== session.sub) return;
  finishInspection(insp.id);
  revalidatePath(`/dashboard/inspections/${insp.id}`);
  if (insp.lease_id) revalidatePath(`/dashboard/leases/${insp.lease_id}`);
}

