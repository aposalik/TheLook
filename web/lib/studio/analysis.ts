import {
  inferLegacyGarmentSemantics,
  type Item,
  type OutfitArchetype,
  validateOutfitCandidate,
} from "../recommend";
import type { OutfitStudioDocument, StudioWearingRole } from "./document";

export const MANUAL_ANALYSIS_VERSION = "manual-v1" as const;
export type ManualAnalysisSeverity = "info" | "warning" | "error";
export type ManualAnalysisIssue = { code: string; severity: ManualAnalysisSeverity; itemIds: string[]; message: string };
export type ManualLookAnalysis = {
  engineVersion: typeof MANUAL_ANALYSIS_VERSION;
  hardValid: boolean;
  issues: ManualAnalysisIssue[];
  scores: { compatibility: number; palette: number; silhouette: number; formality: number; layering: number; footwear: number; total: number };
  archetype: OutfitArchetype | "custom";
  tags: string[];
  explanation: string;
};

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const roleToCandidate = (role: StudioWearingRole): string => ({ base: "base", mid: "overshirt", outer: "outer", bottom: "bottom", shoe: "shoes", accessory: "accessory" })[role]!;
const violationMessages: Record<string, string> = {
  "invalid-outfit-core": "Add one bottom (or one dress) to complete the outfit.",
  "multiple-shoes": "Keep one footwear choice in a single outfit.",
  "invalid-base-layer": "The base garment is not suitable for this layering role.",
  "invalid-mid-layer": "This middle layer needs a more substantial open layer.",
  "invalid-outer-layer": "This outer garment is not suitable as the final layer.",
  "competing-collared-shirts": "These collared layers compete; make one layer more substantial.",
  "competing-upper-patterns": "Two patterned upper layers compete for attention.",
  "hood-under-pullover-layer": "A hood under a pullover layer will bunch up.",
  "hoodie-under-shirt-or-overshirt": "A hoodie is too bulky under this shirt-like layer.",
  "bulky-base-under-lighter-layer": "The inner layer is bulkier than the layer above it.",
  "extreme-formality-gap": "The pieces span very different levels of formality.",
  "polished-shirt-with-lounge-bottom": "The tailored top and lounge bottom pull in different directions.",
};

function formula(roles: StudioWearingRole[]): string {
  if (roles.includes("outer") && roles.includes("mid")) return "Three layer";
  if (roles.includes("outer")) return "With layer";
  if (roles.includes("mid")) return "Layered";
  return "Simple";
}

export function analyzeManualLook(document: OutfitStudioDocument): ManualLookAnalysis {
  const nodes = document.nodes.slice().sort((a, b) => a.zIndex - b.zIndex);
  const items = nodes.map((node) => ({ ...node.itemSnapshot, id: node.itemId, image: "", source: node.itemSource, semantics: node.itemSnapshot.semantics ?? inferLegacyGarmentSemantics(node.itemSnapshot as Item) } as Item));
  const lookFormula = formula(nodes.map((node) => node.wearingRole));
  const roles = nodes.map((node) => node.wearingRole === "base" && lookFormula === "Simple" ? "top" : roleToCandidate(node.wearingRole));
  const validation = validateOutfitCandidate(lookFormula, items, roles);
  const issues: ManualAnalysisIssue[] = validation.violations.map((code) => ({ code, severity: ["invalid-outfit-core", "multiple-shoes", "invalid-base-layer", "invalid-mid-layer", "invalid-outer-layer"].includes(code) ? "error" : "warning", itemIds: items.map((item) => item.id), message: violationMessages[code] ?? "This outfit has a compatibility issue." }));
  if (!items.length) issues.push({ code: "empty-look", severity: "info", itemIds: [], message: "Add garments to receive outfit feedback." });
  const formalities = items.map((item) => item.formality).filter((value): value is number => typeof value === "number");
  const formality = formalities.length > 1 ? clamp(1 - (Math.max(...formalities) - Math.min(...formalities)) * .16) : .82;
  const colors = new Set(items.map((item) => item.palette || item.color).filter(Boolean));
  const palette = clamp(.94 - Math.max(0, colors.size - 3) * .12);
  const upperCount = nodes.filter((node) => ["base", "mid", "outer"].includes(node.wearingRole)).length;
  const layering = clamp(validation.valid ? .9 : .46 - validation.violations.filter((code) => code.includes("layer") || code.includes("hood") || code.includes("collared")).length * .08);
  const footwear = nodes.some((node) => node.wearingRole === "shoe") ? .9 : .62;
  const silhouette = clamp(.88 - Math.max(0, upperCount - 3) * .12);
  const compatibility = clamp((layering + formality) / 2);
  const total = clamp(.30 * compatibility + .18 * palette + .16 * silhouette + .16 * formality + .12 * layering + .08 * footwear);
  const tags = [...new Set([items.some((item) => item.semantics?.isLoungewear) ? "relaxed" : "everyday", upperCount >= 2 ? "layered" : "streamlined", ...(nodes.some((node) => node.wearingRole === "shoe") ? ["grounded"] : [])])];
  const archetype: ManualLookAnalysis["archetype"] = upperCount >= 2 ? "relaxed-layered" : items.some((item) => item.category === "dress") ? "dress" : "safe-casual";
  return { engineVersion: MANUAL_ANALYSIS_VERSION, hardValid: validation.valid, issues, scores: { compatibility, palette, silhouette, formality, layering, footwear, total }, archetype, tags, explanation: validation.valid ? `A ${tags.join(", ")} look with ${Math.round(total * 100)}% deterministic cohesion.` : `Saved creative look with ${issues.length} compatibility warning${issues.length === 1 ? "" : "s"}; these do not block saving.` };
}
