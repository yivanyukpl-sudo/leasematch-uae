// "Stay in the app and wait": when a listing goes live, email tenants whose
// saved alert matches; when a tenant starts waiting, tell landlords and
// agents (who charge their commission to the landlord, never the tenant).

import { alertMatches } from "./alert-match";
import { activeAlerts, getProfileById, touchAlert, type Property, type SavedAlert } from "./db";
import { appUrl } from "./app-url";
import { sendEmail } from "./email";
import { aedPerYear } from "./format";

export async function notifyTenantsAboutListing(property: Property) {
  for (const a of activeAlerts("listing")) {
    if (a.profile_id === property.provider_id || !alertMatches(a, property)) continue;
    const p = getProfileById(a.profile_id);
    if (!p) continue;
    await sendEmail({
      to: p.email,
      subject: `New home matching your search: ${property.title}`,
      text: `A new verified listing is live on LeaseMatch: "${property.title}", ${property.location}, ${aedPerYear(property.price)}.\n\n${await appUrl(`/properties/${property.id}`)}\n\nYou asked us to notify you. Turn it off: ${await appUrl("/dashboard")}`,
    });
    touchAlert(a.id);
  }
}

export async function notifyProvidersAboutTenant(alert: SavedAlert) {
  for (const a of activeAlerts("tenant")) {
    if (a.profile_id === alert.profile_id) continue;
    if (a.location && alert.location && !alertMatches({ location: a.location, max_price: null, min_beds: null, property_type: null }, { location: alert.location, price: 0, beds: 99, property_type: "" })) continue;
    const p = getProfileById(a.profile_id);
    if (!p) continue;
    await sendEmail({
      to: p.email,
      subject: "A new tenant is looking in your area",
      text: `A tenant on LeaseMatch is looking for a home${alert.location ? ` in ${alert.location}` : ""}${alert.max_price ? ` up to ${aedPerYear(alert.max_price)}` : ""}. Publish or refresh your listing and we'll show it straight away.\n\n${await appUrl("/dashboard")}`,
    });
    touchAlert(a.id);
  }
}

export function waitingTenantsFor(properties: Property[]): number {
  return activeAlerts("listing").filter((a) => properties.some((p) => alertMatches(a, p))).length;
}

export function waitingTenantsTotal(): number {
  return activeAlerts("listing").length;
}
