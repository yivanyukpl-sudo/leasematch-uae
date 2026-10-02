import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { NewPropertyForm } from "@/components/NewPropertyForm";
import { getSession } from "@/lib/auth";

const PROVIDER_ROLES = new Set(["owner", "broker", "pm"]);

export default async function NewPropertyPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!PROVIDER_ROLES.has(session.role)) redirect("/dashboard");

  return (
    <div className="flex flex-col flex-1">
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
        <NewPropertyForm />
      </main>
    </div>
  );
}
