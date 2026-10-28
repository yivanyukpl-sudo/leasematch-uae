// Answers questions during the guided deal. OpenAI with lease context when
// configured; otherwise a small built-in FAQ so the helper always answers.

import type { Lease, Property } from "./db";
import { getOpenAI, OPENAI_MODEL } from "./openai";
import { isClaudeConfigured } from "./claude";
import { askClaudeDealAssistant } from "./deal-assistant-claude";
import { getPackage, PACKAGES, STAY_IN_APP_ARGUMENT } from "./packages";

const FAQ: { match: RegExp; answer: string }[] = [
  { match: /direct|outside|bypass|cheaper|why (pay|should)|worth/i, answer: STAY_IN_APP_ARGUMENT.join(" ") },
  { match: /deposit/i, answer: "A security deposit is commonly about 5% of the annual rent for unfurnished homes. It's refunded at move-out less documented damage — that's why the photo condition report matters." },
  { match: /cheque|check|instal/i, answer: "Rent in the UAE is often paid in 1–4 cheques a year; more cheques usually means a slightly higher rent. Agree the number in the contract terms." },
  { match: /ejari|tawtheeq|regist/i, answer: "Tenancy contracts are registered with Ejari in Dubai or Tawtheeq in Abu Dhabi. The LeaseMatch contract is prepared so it can be registered." },
  { match: /dewa|addc|utilit|chiller/i, answer: "Utilities are usually paid by the tenant. Record the meter readings in the condition report on move-in day — the photo inspection has a step for meters." },
  { match: /package|99|149|199|combo/i, answer: PACKAGES.map((p) => `${p.name} — AED ${p.price}: ${p.includes[0].toLowerCase()}.`).join(" ") },
  { match: /key|handover|report/i, answer: "Collect keys only in person at the property, after a confirmed payment, and sign the condition report with photos. Never pay a 'holding deposit' to a stranger." },
];

export async function answerDealQuestion(i: { question: string; lease: Lease; property: Property | null; role: "tenant" | "owner" }): Promise<string> {
  const pkg = getPackage(i.lease.package);
  const system = `You are the LeaseMatch deal assistant guiding the ${i.role === "tenant" ? "tenant" : "landlord"} through a residential tenancy contract in the UAE. Reply in English, briefly (max 90 words), no Markdown. Never invent facts about the property — use only the context. If asked whether they can go direct without the app, explain honestly: ${STAY_IN_APP_ARGUMENT.join(" ")} Recommend a lawyer for complex cases.`;
  const context = `Context: "${i.property?.title ?? "—"}", ${i.property?.location ?? ""}, AED ${i.property?.price ?? "?"}/year. Stage: ${i.lease.stage}. Package: ${pkg ? `${pkg.name} (AED ${pkg.price})` : "not chosen"}. Terms: ${i.lease.terms ?? "not filled yet"}.\n\nQuestion: ${i.question}`;
  if (isClaudeConfigured()) {
    const answer = await askClaudeDealAssistant(system, context);
    if (answer) return answer;
  }
  const openai = getOpenAI();
  if (openai) {
    try {
      const res = await openai.responses.create({
        model: OPENAI_MODEL,
        instructions: system,
        input: context,
      });
      const text = res.output_text.trim();
      if (text) return text;
    } catch (e) {
      console.error("[deal-assistant] OpenAI failed, using FAQ:", e instanceof Error ? e.message.slice(0, 120) : e);
    }
  }
  const hit = FAQ.find((f) => f.match.test(i.question));
  return hit
    ? hit.answer
    : "I'll help with every step: terms, package, photo inspection, signatures, payment and keys. Ask about the deposit, cheques, Ejari, utilities, or why it's better to sign through LeaseMatch.";
}
