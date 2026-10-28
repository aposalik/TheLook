export type StylistVerdict = "strong" | "acceptable" | "reject";
export type SwapRole = "base" | "top" | "overshirt" | "outer" | "bottom" | "shoes" | "accessory" | "none";

export type VisualScores = {
  palette: number;
  silhouette: number;
  layering: number;
  occasion: number;
};

export type StylistJudgmentEntry = {
  lookId: string;
  rank: number;
  verdict: StylistVerdict;
  visualScores: VisualScores;
  issues: string[];
  preferredSwapRole: SwapRole;
  title: string;
  reason: string;
};

export type StylistJudgment = {
  judgments: StylistJudgmentEntry[];
};

const VERDICTS = new Set<StylistVerdict>(["strong", "acceptable", "reject"]);
const SWAP_ROLES = new Set<SwapRole>(["base", "top", "overshirt", "outer", "bottom", "shoes", "accessory", "none"]);
const VISUAL_SCORE_NAMES = ["palette", "silhouette", "layering", "occasion"] as const;

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value as Record<string, unknown>;
}

function boundedScore(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${label} must be a finite number between 0 and 1`);
  }
  return value;
}

function boundedText(value: unknown, label: string, min: number, max: number): string {
  if (typeof value !== "string") throw new Error(`${label} must be a string`);
  const text = value.trim();
  if (text.length < min || text.length > max) throw new Error(`${label} must be ${min}..${max} characters`);
  return text;
}

export function parseStylistJudgment(input: unknown, validLookIds: string[]): StylistJudgment {
  const root = record(input, "judgment");
  if (!Array.isArray(root.judgments)) throw new Error("judgment.judgments must be an array");
  if (new Set(validLookIds).size !== validLookIds.length) throw new Error("validLookIds must be unique");
  if (root.judgments.length !== validLookIds.length) throw new Error("Gemini must judge every supplied candidate exactly once");

  const validIds = new Set(validLookIds);
  const seenIds = new Set<string>();
  const seenRanks = new Set<number>();
  const judgments = root.judgments.map((raw, index): StylistJudgmentEntry => {
    const entry = record(raw, `judgments[${index}]`);
    const lookId = boundedText(entry.lookId, `judgments[${index}].lookId`, 1, 80);
    if (!validIds.has(lookId)) throw new Error(`Unknown lookId: ${lookId}`);
    if (seenIds.has(lookId)) throw new Error(`Duplicate lookId: ${lookId}`);
    seenIds.add(lookId);

    const rank = entry.rank;
    if (!Number.isInteger(rank) || (rank as number) < 1 || (rank as number) > validLookIds.length) throw new Error(`Invalid rank for ${lookId}`);
    if (seenRanks.has(rank as number)) throw new Error(`Duplicate rank: ${rank}`);
    seenRanks.add(rank as number);

    if (typeof entry.verdict !== "string" || !VERDICTS.has(entry.verdict as StylistVerdict)) throw new Error(`Invalid verdict for ${lookId}`);
    const rawScores = record(entry.visualScores, `${lookId}.visualScores`);
    const visualScores = Object.fromEntries(
      VISUAL_SCORE_NAMES.map((name) => [name, boundedScore(rawScores[name], `${lookId}.visualScores.${name}`)]),
    ) as VisualScores;

    if (!Array.isArray(entry.issues) || entry.issues.length > 5) throw new Error(`${lookId}.issues must contain at most five strings`);
    const issues = entry.issues.map((issue, issueIndex) => boundedText(issue, `${lookId}.issues[${issueIndex}]`, 1, 240));
    if (typeof entry.preferredSwapRole !== "string" || !SWAP_ROLES.has(entry.preferredSwapRole as SwapRole)) {
      throw new Error(`Invalid preferredSwapRole for ${lookId}`);
    }

    return {
      lookId,
      rank: rank as number,
      verdict: entry.verdict as StylistVerdict,
      visualScores,
      issues,
      preferredSwapRole: entry.preferredSwapRole as SwapRole,
      title: boundedText(entry.title, `${lookId}.title`, 2, 60),
      reason: boundedText(entry.reason, `${lookId}.reason`, 10, 500),
    };
  });

  return { judgments: judgments.sort((a, b) => a.rank - b.rank) };
}

export function assertAvailableSwapRoles<T extends { lookId: string; roles: string[] }>(candidates: T[], judgment: StylistJudgment): void {
  const byId = new Map(candidates.map((candidate) => [candidate.lookId, candidate]));
  for (const entry of judgment.judgments) {
    const candidate = byId.get(entry.lookId);
    if (!candidate) throw new Error(`Judgment references unavailable candidate ${entry.lookId}`);
    if (entry.preferredSwapRole !== "none" && !candidate.roles.includes(entry.preferredSwapRole)) {
      throw new Error(`Gemini suggested unavailable role ${entry.preferredSwapRole} for ${entry.lookId}`);
    }
  }
}

export function rankJudgedCandidates<T extends { lookId: string }>(candidates: T[], judgment: StylistJudgment) {
  const byId = new Map(candidates.map((candidate) => [candidate.lookId, candidate]));
  return judgment.judgments
    .filter((entry) => entry.verdict !== "reject")
    .map((entry) => {
      const candidate = byId.get(entry.lookId);
      if (!candidate) throw new Error(`Judgment references unavailable candidate ${entry.lookId}`);
      return {
        ...candidate,
        stylistVerdict: entry.verdict,
        visualScores: entry.visualScores,
        stylistIssues: entry.issues,
        preferredSwapRole: entry.preferredSwapRole,
        stylistTitle: entry.title,
        aiReason: entry.reason,
        reason: entry.reason,
      };
    });
}
