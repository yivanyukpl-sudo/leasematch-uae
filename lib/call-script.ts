// Scripted transcripts for the *simulated* agent phone call. No call is ever
// placed and no telephony provider is involved — this exists to demo how an
// AI agent would phone a landlord about an ad (and what it would bring back),
// before any real voice integration is built.
//
// Scripts are generated from the ad's real details so the simulation feels
// specific, and always open with the agent disclosing that it's an AI
// calling on a tenant's behalf — which a real version would legally need to
// do in most jurisdictions anyway.

import type { CallLine } from "./db";

export const callScenarios = {
  available: "Available — books a viewing",
  negotiable: "Open to negotiating",
  let: "Already rented",
  voicemail: "No answer — leaves voicemail",
} as const;

export type CallScenario = keyof typeof callScenarios;

export type CallScriptInput = {
  seed: string;
  scenario?: CallScenario | "random";
  listingTitle: string;
  sourceSite: string;
  priceText: string | null;
  location: string | null;
  advertiserName: string | null;
  tenantFirstName: string;
  tenantBudget: number | null;
};

export type CallScript = {
  scenario: CallScenario;
  calleeLabel: string;
  lines: CallLine[];
  summary: string;
  outcome: string;
};

function hash(s: string): number {
  let h = 2166136261;
  for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return h;
}

function parseAed(text: string | null): number | null {
  if (!text) return null;
  const m = text.replace(/,/g, "").match(/(\d{4,7})/);
  return m ? Number(m[1]) : null;
}

function aed(n: number) {
  return `AED ${n.toLocaleString("en-US")}`;
}

const viewingSlots = ["tomorrow at 6:30 pm", "Saturday at 11 am", "Thursday at 5 pm", "Sunday at 4 pm"];
const calleeNames = ["Omar", "Priya", "Daniel", "Mariam", "Ravi", "Sofia"];

export function buildCallScript(input: CallScriptInput): CallScript {
  const h = hash(input.seed);
  const scenario: CallScenario =
    input.scenario && input.scenario !== "random"
      ? input.scenario
      : // Weighted toward the useful outcomes: voicemail is rare.
        (["available", "negotiable", "available", "let", "negotiable", "voicemail"] as const)[h % 6];

  const calleeName = calleeNames[h % calleeNames.length];
  const calleeLabel = input.advertiserName
    ? `${calleeName} · ${input.advertiserName}`
    : `${calleeName} (advertiser)`;
  // Portal titles are keyword-stuffed ("1BR | Building | Balcony | Views") and
  // addresses long; keep the first parts so the call sounds natural.
  const unit = input.listingTitle.split(/\s*[|•]\s*/).slice(0, 2).join(", ");
  const place = input.location?.split(",").slice(0, 2).join(",").trim();
  const area = place ? ` in ${place}` : "";
  const asking = parseAed(input.priceText);
  const slot = viewingSlots[h % viewingSlots.length];
  const tenant = input.tenantFirstName;

  const intro: CallLine[] = [
    {
      speaker: "agent",
      text: `Hi, good afternoon. This is Leah, an AI assistant from LeaseMatch, calling on behalf of a prospective tenant, ${tenant}. I'm calling about your ad on ${input.sourceSite} for "${unit}"${area}. Is now a good time for a quick two-minute call?`,
    },
  ];

  if (scenario === "voicemail") {
    const lines: CallLine[] = [
      { speaker: "callee", text: `[Voicemail] You've reached ${calleeName}. Please leave a message after the tone.` },
      {
        speaker: "agent",
        text: `Hi ${calleeName}, this is Leah, an AI assistant from LeaseMatch, calling for a tenant named ${tenant} about "${unit}" on ${input.sourceSite}. ${tenant} would like to know if it's still available and to arrange a viewing. We'll follow up by email as well. Thank you!`,
      },
    ];
    return {
      scenario,
      calleeLabel,
      lines,
      outcome: "No answer — voicemail left",
      summary: `No answer from ${calleeName}. The agent left a voicemail asking about availability and a viewing for "${unit}". Suggested next step: send the email inquiry so there's a written thread.`,
    };
  }

  const greeting: CallLine = {
    speaker: "callee",
    text: `Hi Leah — sure, go ahead. An AI calling, that's new. Which unit was it again?`,
  };

  if (scenario === "let") {
    const lines: CallLine[] = [
      ...intro,
      greeting,
      { speaker: "agent", text: `"${unit}"${area}${input.priceText ? `, listed at ${input.priceText}` : ""}. Is it still available?` },
      {
        speaker: "callee",
        text: "Ah, sorry — that one was rented last week. The ad should have come down, I'll get it removed. I do have a similar unit in the same building coming up at the start of next month.",
      },
      { speaker: "agent", text: "Thanks for letting me know. Could you share the details of the similar unit — size, rent, and when it can be viewed?" },
      {
        speaker: "callee",
        text: `It's a slightly higher floor, same layout${asking ? `, around ${aed(Math.round((asking * 1.04) / 1000) * 1000)}` : ""}. Viewings from next week. Send me an email and I'll reply with photos.`,
      },
      { speaker: "agent", text: `Perfect, I'll pass that to ${tenant} and follow up by email. Thank you for your time, ${calleeName}.` },
    ];
    return {
      scenario,
      calleeLabel,
      lines,
      outcome: "Already rented — similar unit offered",
      summary: `"${unit}" is already rented (the ad is stale). ${calleeName} offered a similar unit in the same building from next month${asking ? `, roughly ${aed(Math.round((asking * 1.04) / 1000) * 1000)}/yr` : ""}, and asked for an email to send photos.`,
    };
  }

  const availability: CallLine[] = [
    ...intro,
    greeting,
    { speaker: "agent", text: `"${unit}"${area}${input.priceText ? `, listed at ${input.priceText}` : ""}. Is it still available, and from when?` },
    { speaker: "callee", text: "Yes, still available. It's vacant now, so the tenant can move in from the first of next month." },
    {
      speaker: "agent",
      text: `Great. A few quick questions for ${tenant}: how many cheques would you accept, and is the security deposit the standard five percent?`,
    },
    { speaker: "callee", text: "Four cheques is fine. Deposit is five percent, and DEWA is in the tenant's name." },
  ];

  if (scenario === "negotiable") {
    const target = asking ? Math.round((asking * (input.tenantBudget && input.tenantBudget < asking ? 0.93 : 0.95)) / 1000) * 1000 : null;
    const agreed = asking && target ? Math.round((asking + target) / 2 / 1000) * 1000 : null;
    const lines: CallLine[] = [
      ...availability,
      {
        speaker: "agent",
        text: target
          ? `Understood. ${tenant} has documents ready and could commit to 12 months quickly. Would you consider ${aed(target)} per year with four cheques?`
          : `Understood. ${tenant} has documents ready. Is there any flexibility on the rent for a quick, 12-month commitment?`,
      },
      {
        speaker: "callee",
        text: agreed
          ? `I can't go that low, but for a tenant ready to sign this week I could do ${aed(agreed)} on four cheques.`
          : "For a tenant ready to sign this week I could take a little off — let's say five percent on four cheques.",
      },
      { speaker: "agent", text: `That's helpful, thank you. I can't commit on ${tenant}'s behalf, but I'll take that back to them right away. Could they view it ${slot}?` },
      { speaker: "callee", text: `${slot[0].toUpperCase()}${slot.slice(1)} works. I'll send the exact location by email.` },
      { speaker: "agent", text: `Perfect. I'll confirm in writing shortly. Thanks, ${calleeName}!` },
    ];
    return {
      scenario,
      calleeLabel,
      lines,
      outcome: agreed ? `Negotiable — counter at ${aed(agreed)}/yr` : "Negotiable — ~5% off offered",
      summary: `Available from the 1st of next month; 4 cheques, 5% deposit, DEWA in tenant's name. ${calleeName} countered ${agreed ? `at ${aed(agreed)}/yr${asking ? ` (down from ${aed(asking)})` : ""}` : "with roughly 5% off"} if ${tenant} signs this week. Provisional viewing ${slot} — not confirmed on ${tenant}'s behalf; awaiting their go-ahead.`,
    };
  }

  const lines: CallLine[] = [
    ...availability,
    { speaker: "agent", text: `Thanks. ${tenant} would love to see it. Would ${slot} work for a viewing?` },
    { speaker: "callee", text: "Yes, that works. Ask them to bring a copy of their Emirates ID or passport." },
    { speaker: "agent", text: `Noted. I'll confirm by email with ${tenant}'s details. Thank you, ${calleeName} — have a good day.` },
  ];
  return {
    scenario,
    calleeLabel,
    lines,
    outcome: `Available — viewing ${slot}`,
    summary: `Still available, vacant now, move-in from the 1st of next month. 4 cheques accepted, 5% deposit, DEWA in tenant's name. Viewing arranged for ${slot}; bring Emirates ID or passport.`,
  };
}

// Rough spoken duration of a transcript, in seconds.
export function estimateDurationSeconds(lines: CallLine[]): number {
  const words = lines.reduce((n, l) => n + l.text.split(/\s+/).length, 0);
  return Math.round(words / 2.6) + lines.length * 2;
}
