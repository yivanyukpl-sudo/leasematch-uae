import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { PreferencesForm } from "@/components/PreferencesForm";
import { getSession } from "@/lib/auth";
import { getTenantPreferences } from "@/lib/db";

export default async function PreferencesPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "tenant") redirect("/dashboard");

  const prefs = getTenantPreferences(session.sub);

  return (
    <div className="flex flex-col flex-1">
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
        <h1 className="font-display text-2xl font-semibold mb-1">Search preferences</h1>
        <p className="text-sm text-text-muted mb-6">
          Tell us what you&apos;re looking for and we&apos;ll score every live listing against it.
        </p>
        <PreferencesForm initial={prefs} />
      </main>
    </div>
  );
}
