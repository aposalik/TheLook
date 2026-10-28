export type OutfitFeedbackSignal = "like" | "dislike";

export type OutfitFeedbackEvent = {
  id: string;
  itemIds: string[];
  signal: OutfitFeedbackSignal;
  createdAt: number;
};

export function normalizeOutfitFeedback(input: unknown, limit = 100): OutfitFeedbackEvent[] {
  if (!Array.isArray(input)) return [];
  const events: OutfitFeedbackEvent[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const value = raw as Record<string, unknown>;
    if (typeof value.id !== "string" || !value.id.trim()) continue;
    if (value.signal !== "like" && value.signal !== "dislike") continue;
    if (!Number.isFinite(value.createdAt)) continue;
    if (!Array.isArray(value.itemIds)) continue;
    const itemIds = [...new Set(value.itemIds.filter((id): id is string => typeof id === "string" && Boolean(id.trim())))].slice(0, 12);
    if (!itemIds.length) continue;
    events.push({ id: value.id, itemIds, signal: value.signal, createdAt: value.createdAt as number });
  }
  return events.sort((a, b) => a.createdAt - b.createdAt).slice(-Math.max(1, limit));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  const intersection = [...a].filter((id) => b.has(id)).length;
  const union = new Set([...a, ...b]).size;
  return union ? intersection / union : 0;
}

export function feedbackAdjustment(itemIds: string[], feedback: OutfitFeedbackEvent[]): number {
  if (!feedback.length || !itemIds.length) return 0;
  const candidate = new Set(itemIds);
  let weighted = 0;
  let weightTotal = 0;
  for (const event of feedback) {
    const similarity = jaccard(candidate, new Set(event.itemIds));
    if (similarity < 0.25) continue;
    const recency = 0.75 + 0.25 * ((feedback.indexOf(event) + 1) / feedback.length);
    const weight = similarity * recency;
    weighted += weight * (event.signal === "like" ? 1 : -1);
    weightTotal += weight;
  }
  if (!weightTotal) return 0;
  return Math.max(-0.12, Math.min(0.12, 0.12 * (weighted / weightTotal)));
}
