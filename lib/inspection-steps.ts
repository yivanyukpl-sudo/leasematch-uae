// Guided photo inspection: the order of rooms and exactly what to shoot in
// each, so the AI gets photos it can judge and the tenant misses nothing.

export type InspectionStep = { key: string; title: string; icon: string; shots: string[]; checks: string };

export const INSPECTION_STEPS: InspectionStep[] = [
  { key: "entrance", title: "Entrance & front door", icon: "🚪", shots: ["Door from outside and the lock", "Hallway, wide shot"], checks: "door and lock condition, signs of forced entry, cleanliness" },
  { key: "kitchen", title: "Kitchen", icon: "🍳", shots: ["Kitchen, wide shot", "Hob/oven and extractor", "Sink and the pipes under it", "Fridge, door open"], checks: "appliances, leaks under the sink, grease and mould, cabinets" },
  { key: "bathroom", title: "Bathrooms", icon: "🛁", shots: ["Wide shot", "Tile grout and ceiling corners", "Water heater", "Toilet and fittings close up"], checks: "mould, rust, leaks, ventilation, water heater" },
  { key: "rooms", title: "Bedrooms & living room", icon: "🛏️", shots: ["Each room, wide shot", "Ceiling corners (damp shows here)", "Floor and walls near windows", "Built-in wardrobes"], checks: "damp patches, cracks, floor and wardrobe condition" },
  { key: "windows", title: "Windows & balcony", icon: "🪟", shots: ["Windows open", "Sills and frames", "Balcony"], checks: "gaps and condensation, mould on frames, balcony condition" },
  { key: "ac", title: "AC & chiller", icon: "❄️", shots: ["Each AC unit or vent", "Thermostat", "Chiller meter if separate"], checks: "dirty filters, leaks, missing covers, AC condition" },
  { key: "meters", title: "Meters", icon: "🔢", shots: ["Electricity/water meter (digits visible)", "Gas meter if any"], checks: "readable readings for the condition report" },
];

export function stepByKey(key: string) {
  return INSPECTION_STEPS.find((s) => s.key === key);
}

export type Severity = "high" | "medium" | "low";
export type PhotoIssue = { severity: Severity; title: string; detail: string };
export type PhotoAnalysis = {
  quality: "ok" | "retake";
  retakeReason: string | null;
  condition: 1 | 2 | 3 | 4 | 5;
  issues: PhotoIssue[];
  summary: string;
  demo?: boolean;
};

const order: Record<Severity, number> = { high: 0, medium: 1, low: 2 };

export function summarize(analyses: { step: string; a: PhotoAnalysis }[]) {
  const issues = analyses.flatMap(({ step, a }) => a.issues.map((i) => ({ ...i, step }))).sort((x, y) => order[x.severity] - order[y.severity]);
  const scores = analyses.map(({ a }) => a.condition);
  const avg = scores.length ? scores.reduce((p, c) => p + c, 0) / scores.length : 0;
  const high = issues.filter((i) => i.severity === "high").length;
  const verdict: "good" | "check" | "warning" = high > 0 ? "warning" : issues.some((i) => i.severity === "medium") ? "check" : "good";
  return { issues, avg: Math.round(avg * 10) / 10, high, verdict };
}
