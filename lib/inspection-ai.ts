// Analyses one inspection photo with OpenAI vision. Without a key (or if the
// call fails) it returns a clearly labelled demo analysis so the flow can be
// tried; demo results are never presented as a real assessment.

import { getOpenAI, OPENAI_MODEL } from "./openai";
import { stepByKey, type PhotoAnalysis } from "./inspection-steps";

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    quality: { type: "string", enum: ["ok", "retake"] },
    retakeReason: { type: ["string", "null"] },
    condition: { type: "integer", enum: [1, 2, 3, 4, 5] },
    issues: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          severity: { type: "string", enum: ["high", "medium", "low"] },
          title: { type: "string" },
          detail: { type: "string" },
        },
        required: ["severity", "title", "detail"],
      },
    },
    summary: { type: "string" },
  },
  required: ["quality", "retakeReason", "condition", "issues", "summary"],
};

const DEMO: Record<string, PhotoAnalysis> = {
  entrance: { quality: "ok", retakeReason: null, condition: 4, issues: [{ severity: "low", title: "Scuffs on the door", detail: "Minor scratches near the lock — note them in the condition report." }], summary: "Door and lock work." },
  kitchen: { quality: "ok", retakeReason: null, condition: 3, issues: [{ severity: "medium", title: "Signs of a leak under the sink", detail: "Dark stains in the cabinet — ask the landlord to check the trap before move-in." }], summary: "Clean kitchen, plumbing needs a check." },
  bathroom: { quality: "ok", retakeReason: null, condition: 2, issues: [{ severity: "high", title: "Possible mould in a ceiling corner", detail: "Dark patches above the shower suggest damp and weak ventilation. Agree a fix before signing." }, { severity: "low", title: "Discoloured grout", detail: "Cosmetic; photograph it for the condition report." }], summary: "Needs attention: damp in the bathroom." },
  rooms: { quality: "ok", retakeReason: null, condition: 4, issues: [], summary: "Rooms in good condition, no visible damp." },
  windows: { quality: "ok", retakeReason: null, condition: 3, issues: [{ severity: "medium", title: "Condensation on the glass", detail: "May indicate poor ventilation or a worn seal." }], summary: "Windows work; condensation possible." },
  ac: { quality: "ok", retakeReason: null, condition: 3, issues: [{ severity: "medium", title: "Dirty AC filter", detail: "Ask for AC servicing before move-in — common in UAE contracts." }], summary: "AC works but needs servicing." },
  meters: { quality: "retake", retakeReason: "The meter digits are blurry — shoot closer, without glare.", condition: 4, issues: [], summary: "Retake so the readings are legible for the report." },
};

export async function analyzePhoto(buf: Buffer, mime: string, stepKey: string): Promise<PhotoAnalysis> {
  const step = stepByKey(stepKey);
  const openai = getOpenAI();
  if (openai && step) {
    try {
      const res = await openai.responses.create({
        model: OPENAI_MODEL,
        instructions:
          "You inspect the condition of rental homes in the UAE. Judge the photo honestly and carefully: describe only what is visible. Never invent defects; if the photo is dark, blurry or doesn't show what's needed, set quality=retake and say why. Write in English, briefly and practically for the tenant (what to check or ask the landlord to fix).",
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: `Inspection step: ${step.title}. Check: ${step.checks}.` },
              { type: "input_image", image_url: `data:${mime};base64,${buf.toString("base64")}`, detail: "auto" },
            ],
          },
        ],
        text: { format: { type: "json_schema", name: "photo_analysis", strict: true, schema } },
      });
      return JSON.parse(res.output_text) as PhotoAnalysis;
    } catch (e) {
      console.error("[inspection-ai] vision failed, using demo analysis:", e instanceof Error ? e.message.slice(0, 120) : e);
    }
  }
  const d = DEMO[stepKey] ?? DEMO.rooms;
  return { ...d, demo: true };
}
