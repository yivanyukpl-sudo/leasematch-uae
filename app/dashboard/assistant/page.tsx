import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { AgentChat } from "@/components/AgentChat";
import { getSession } from "@/lib/auth";
import { isAgentConfigured } from "@/lib/ai";

export default async function AssistantPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "tenant") redirect("/dashboard");

  return (
    <div className="flex flex-col flex-1">
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
        <h1 className="font-display text-2xl font-semibold mb-1">Your agent</h1>
        <p className="text-sm text-text-muted mb-6">
          Describe what you&apos;re looking for in your own words — your agent searches real
          live listings, tells you honestly if your budget is out of line with the market, and
          can apply on your behalf once you confirm.
        </p>
        <AgentChat agentConfigured={isAgentConfigured()} />
      </main>
    </div>
  );
}
