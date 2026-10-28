import { getInspection, getLeaseById } from "./db";

// The creator always; for a handover inspection, both parties of the lease.
export function canAccessInspection(inspectionId: string, profileId: string): boolean {
  const insp = getInspection(inspectionId);
  if (!insp) return false;
  if (insp.created_by === profileId) return true;
  if (insp.lease_id) {
    const lease = getLeaseById(insp.lease_id);
    return Boolean(lease && (lease.tenant_id === profileId || lease.provider_id === profileId));
  }
  return false;
}
