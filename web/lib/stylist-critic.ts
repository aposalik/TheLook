import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp, { type OverlayOptions } from "sharp";
import { askGeminiJson, geminiConfigured, parseDataImage, type InlineImage } from "./gemini";
import { normalizeOutfitFeedback, type OutfitFeedbackEvent } from "./outfit-feedback";
import {
  buildScoreBreakdownFromVisuals,
  recommend,
  type Item,
  type Look,
  type OutfitScoreBreakdown,
  type StylePreferences,
} from "./recommend";
import {
  allowedSwapRolesForCandidate,
  assertAvailableSwapRoles,
  buildCriticResponseSchema,
  parseStylistJudgment,
  rankJudgedCandidates,
  type VisualScores,
} from "./stylist-judge";

export type CandidateLook = Look & { lookId: string };

export type CandidatePanelSummary = {
  lookId: string;
  formula: string;
  selectionMode: string;
  archetype: string;
  roles: string[];
  itemIds: string[];
};

export type CriticRequest = {
  candidates?: Look[];
  wardrobeItems?: Item[];
  anchors?: string[];
  recentlyUsedItemIds?: string[];
  seed?: number;
  preferences?: StylePreferences;
  feedback?: OutfitFeedbackEvent[];
};

export type CriticResponse = {
  looks: Look[];
  rejected: string[];
  source: "gemini" | "deterministic";
  warning?: string;
};

export type CriticDependencies = {
  isGeminiConfigured?: () => boolean;
  askCritic?: (args: {
    prompt: string;
    images: InlineImage[];
    responseSchema: Record<string, unknown>;
    temperature: number;
  }) => Promise<unknown>;
  fetchImage?: (item: Item) => Promise<Buffer>;
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function truncateLabel(text: string, maxLen: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= maxLen) return clean;
  return `${clean.slice(0, Math.max(1, maxLen - 2))}..`;
}

function cloneLook(look: Look): Look {
  return {
    ...look,
    items: look.items.map((item) => ({
      ...item,
      ...(item.slots ? { slots: [...item.slots] } : {}),
      ...(item.seasons ? { seasons: [...item.seasons] } : {}),
      ...(item.styles ? { styles: [...item.styles] } : {}),
      ...(item.semantics ? { semantics: { ...item.semantics } } : {}),
    })),
    roles: [...look.roles],
    ...(look.scoreBreakdown ? { scoreBreakdown: { ...look.scoreBreakdown } } : {}),
    ...(look.visualScores ? { visualScores: { ...look.visualScores } } : {}),
    ...(look.stylistIssues ? { stylistIssues: [...look.stylistIssues] } : {}),
  };
}

function isValidCandidateLook(value: unknown): value is Look {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<Look>;
  if (typeof candidate.formula !== "string" || !candidate.formula.trim()) return false;
  if (!Array.isArray(candidate.items) || candidate.items.length === 0) return false;
  if (!Array.isArray(candidate.roles) || candidate.roles.length !== candidate.items.length) return false;
  return candidate.items.every((item) => Boolean(item && typeof item === "object" && typeof item.id === "string" && item.id.trim()));
}

export function assignCandidateIds(candidates: Look[]): CandidateLook[] {
  return candidates.map((candidate, index) => ({
    ...cloneLook(candidate),
    deterministicReason: candidate.deterministicReason ?? candidate.reason,
    lookId: `candidate_${index + 1}`,
  }));
}

export function stripCandidateId(candidate: CandidateLook): Look {
  const { lookId: _lookId, ...look } = candidate;
  void _lookId;
  return look;
}

export function assertCandidatesUnmutated(originals: CandidateLook[], judged: CandidateLook[]): void {
  const byId = new Map(originals.map((candidate) => [candidate.lookId, candidate]));
  for (const entry of judged) {
    const original = byId.get(entry.lookId);
    if (!original) {
      throw new Error(`Judged output references unknown candidate ${entry.lookId}`);
    }
    if (entry.formula !== original.formula) {
      throw new Error(`Candidate ${entry.lookId} mutated formula from ${original.formula} to ${entry.formula}`);
    }
    if (entry.roles.length !== original.roles.length || entry.roles.some((role, idx) => role !== original.roles[idx])) {
      throw new Error(`Candidate ${entry.lookId} mutated roles`);
    }
    if (entry.items.length !== original.items.length || entry.items.some((item, idx) => item?.id !== original.items[idx]?.id)) {
      throw new Error(`Candidate ${entry.lookId} mutated garment item IDs`);
    }
  }
}

export function blendCriticScoreBreakdown(
  deterministic: OutfitScoreBreakdown | undefined,
  visualScores: VisualScores,
  items: Item[],
  preferences?: StylePreferences,
  feedback?: OutfitFeedbackEvent[],
): OutfitScoreBreakdown {
  const critic = buildScoreBreakdownFromVisuals(visualScores, items, preferences ?? {}, feedback ?? []);
  if (!deterministic) return critic;

  const compatibility = clamp01(0.7 * deterministic.compatibility + 0.3 * critic.compatibility);
  const palette = clamp01(0.7 * deterministic.palette + 0.3 * critic.palette);
  const silhouette = clamp01(0.7 * deterministic.silhouette + 0.3 * critic.silhouette);
  const formality = clamp01(0.7 * deterministic.formality + 0.3 * critic.formality);
  const style = clamp01(0.7 * deterministic.style + 0.3 * critic.style);
  const footwear = clamp01(0.7 * deterministic.footwear + 0.3 * critic.footwear);
  const preference = clamp01(deterministic.preference);
  const total = clamp01(
    0.28 * compatibility +
      0.16 * palette +
      0.14 * silhouette +
      0.16 * formality +
      0.1 * style +
      0.1 * footwear +
      0.06 * preference,
  );

  return {
    compatibility,
    palette,
    silhouette,
    formality,
    style,
    footwear,
    preference,
    total,
  };
}

export async function defaultFetchItemImageBuffer(item: Item): Promise<Buffer> {
  const inline = parseDataImage(item.image || "");
  if (inline) {
    return Buffer.from(inline.data, "base64");
  }
  if (item.image?.startsWith("http://") || item.image?.startsWith("https://")) {
    const res = await fetch(item.image, { cache: "no-store", signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`Could not fetch garment image (${res.status})`);
    return Buffer.from(await res.arrayBuffer());
  }
  const relative = (item.image || "").replace(/^\/+/, "");
  if (!relative) {
    throw new Error(`Missing image path for item ${item.id}`);
  }
  const publicRoot = path.resolve(process.cwd(), "public");
  const full = path.resolve(publicRoot, relative);
  if (!full.startsWith(publicRoot + path.sep)) {
    throw new Error("Invalid catalog image path");
  }
  return readFile(full);
}

function buildPlaceholderSvg(item: Item, role: string, width: number, height: number): Buffer {
  const swatchHex = /^#[0-9a-f]{6}$/i.test(item.color ?? "") ? item.color : "#8A8480";
  const roleLabel = escapeXml(truncateLabel(role.toUpperCase(), 14));
  const titleLabel = escapeXml(truncateLabel(item.title || item.id, 20));
  return Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="${width - 2}" height="${height - 2}" rx="8" fill="#F7F5F0" stroke="#C4A882" stroke-width="1.5" stroke-dasharray="5 4"/>
      <circle cx="${Math.floor(width / 2)}" cy="${Math.floor(height * 0.34)}" r="16" fill="${swatchHex}" stroke="#D8CEC1" stroke-width="1.5"/>
      <text x="${Math.floor(width / 2)}" y="${Math.floor(height * 0.60)}" text-anchor="middle" fill="#735F43" font-family="sans-serif" font-size="11" font-weight="bold">${roleLabel}</text>
      <text x="${Math.floor(width / 2)}" y="${Math.floor(height * 0.74)}" text-anchor="middle" fill="#1A1A1A" font-family="sans-serif" font-size="11">${titleLabel}</text>
      <text x="${Math.floor(width / 2)}" y="${Math.floor(height * 0.89)}" text-anchor="middle" fill="#8A8480" font-family="sans-serif" font-size="10">Preview unavailable</text>
    </svg>`,
  );
}

export async function buildCandidateContactSheet(
  candidates: CandidateLook[],
  options: { fetchImage?: (item: Item) => Promise<Buffer> } = {},
): Promise<{ image: InlineImage; panels: CandidatePanelSummary[] }> {
  if (candidates.length === 0) {
    throw new Error("At least one candidate look is required to build a contact sheet");
  }

  const fetchImage = options.fetchImage ?? defaultFetchItemImageBuffer;
  const maxCols = Math.min(6, Math.max(2, ...candidates.map((c) => c.items.length)));
  const OUTER_PAD = 20;
  const PANEL_GAP = 18;
  const PANEL_HEADER_H = 44;
  const PANEL_PAD_X = 16;
  const PANEL_PAD_BOTTOM = 14;
  const SLOT_W = 196;
  const SLOT_H = 224;
  const SLOT_GAP = 12;
  const IMG_W = 176;
  const IMG_H = 144;

  const PANEL_W = PANEL_PAD_X * 2 + maxCols * SLOT_W + (maxCols - 1) * SLOT_GAP;
  const PANEL_H = PANEL_HEADER_H + SLOT_H + PANEL_PAD_BOTTOM;
  const WIDTH = OUTER_PAD * 2 + PANEL_W;
  const HEIGHT = OUTER_PAD * 2 + candidates.length * PANEL_H + (candidates.length - 1) * PANEL_GAP;

  const panels: CandidatePanelSummary[] = candidates.map((candidate) => ({
    lookId: candidate.lookId,
    formula: candidate.formula,
    selectionMode: candidate.selectionMode,
    archetype: candidate.archetype,
    roles: [...candidate.roles],
    itemIds: candidate.items.map((item) => item.id),
  }));

  const panelOverlayGroups: OverlayOptions[][] = await Promise.all(
    candidates.map(async (candidate, panelIdx) => {
      const panelX = OUTER_PAD;
      const panelY = OUTER_PAD + panelIdx * (PANEL_H + PANEL_GAP);

      const headerTitle = `${candidate.lookId} · ${candidate.formula}`;
      const headerMeta = `${candidate.selectionMode} · ${candidate.archetype}`;

      const panelFrameSvg = Buffer.from(
        `<svg width="${PANEL_W}" height="${PANEL_H}" xmlns="http://www.w3.org/2000/svg">
          <rect x="0" y="0" width="${PANEL_W}" height="${PANEL_H}" rx="14" fill="#FFFFFF" stroke="#D8CEC1" stroke-width="2"/>
          <path d="M 14 0 L ${PANEL_W - 14} 0 Q ${PANEL_W} 0 ${PANEL_W} 14 L ${PANEL_W} ${PANEL_HEADER_H} L 0 ${PANEL_HEADER_H} L 0 14 Q 0 0 14 0 Z" fill="#1A1A1A"/>
          <text x="16" y="27" fill="#F5E6C8" font-family="sans-serif" font-size="14" font-weight="bold">${escapeXml(truncateLabel(headerTitle, 44))}</text>
          <text x="${PANEL_W - 16}" y="27" text-anchor="end" fill="#D8CEC1" font-family="sans-serif" font-size="12">${escapeXml(truncateLabel(headerMeta, 42))}</text>
        </svg>`,
      );

      const visibleCount = Math.min(maxCols, candidate.items.length);
      const slotOverlayLists = await Promise.all(
        candidate.items.slice(0, visibleCount).map(async (item, slotIdx) => {
          const role = candidate.roles[slotIdx] ?? item.slot ?? "piece";
          const slotX = panelX + PANEL_PAD_X + slotIdx * (SLOT_W + SLOT_GAP);
          const slotY = panelY + PANEL_HEADER_H + 6;
          const imgX = slotX + Math.floor((SLOT_W - IMG_W) / 2);
          const imgY = slotY + 32;

          const slotCardSvg = Buffer.from(
            `<svg width="${SLOT_W}" height="${SLOT_H - 6}" xmlns="http://www.w3.org/2000/svg">
              <rect x="0" y="0" width="${SLOT_W}" height="${SLOT_H - 6}" rx="10" fill="#FAF8F4" stroke="#E8E3DB" stroke-width="1.5"/>
              <rect x="10" y="6" width="${SLOT_W - 20}" height="20" rx="5" fill="#EDE5D8"/>
              <text x="${Math.floor(SLOT_W / 2)}" y="20" text-anchor="middle" fill="#735F43" font-family="sans-serif" font-size="10" font-weight="bold">${escapeXml(truncateLabel(role.toUpperCase(), 20))}</text>
              <text x="${Math.floor(SLOT_W / 2)}" y="${SLOT_H - 28}" text-anchor="middle" fill="#1A1A1A" font-family="sans-serif" font-size="11" font-weight="bold">${escapeXml(truncateLabel(item.title || item.id, 24))}</text>
              <text x="${Math.floor(SLOT_W / 2)}" y="${SLOT_H - 13}" text-anchor="middle" fill="#8A8480" font-family="sans-serif" font-size="9">${escapeXml(truncateLabel(item.id, 26))}</text>
            </svg>`,
          );

          let thumbOverlay: OverlayOptions;
          try {
            if (!item.image) {
              throw new Error("Missing image");
            }
            const raw = await fetchImage(item);
            const thumb = await sharp(raw)
              .rotate()
              .resize({
                width: IMG_W,
                height: IMG_H,
                fit: "contain",
                background: { r: 255, g: 255, b: 255, alpha: 1 },
              })
              .jpeg({ quality: 78 })
              .toBuffer();
            thumbOverlay = { input: thumb, left: imgX, top: imgY };
          } catch {
            thumbOverlay = {
              input: buildPlaceholderSvg(item, role, IMG_W, IMG_H),
              left: imgX,
              top: imgY,
            };
          }

          return [
            { input: slotCardSvg, left: slotX, top: slotY } satisfies OverlayOptions,
            thumbOverlay,
          ];
        }),
      );

      return [
        { input: panelFrameSvg, left: panelX, top: panelY } satisfies OverlayOptions,
        ...slotOverlayLists.flat(),
      ];
    }),
  );

  const sheet = await sharp({
    create: {
      width: WIDTH,
      height: HEIGHT,
      channels: 3,
      background: { r: 237, g: 232, b: 223 },
    },
  })
    .composite(panelOverlayGroups.flat())
    .jpeg({ quality: 80 })
    .toBuffer();

  return {
    image: { data: sheet.toString("base64"), mimeType: "image/jpeg" },
    panels,
  };
}

export function buildCriticPrompt(
  candidates: CandidateLook[],
  anchors: string[],
  preferences: StylePreferences,
): string {
  const candidateMetadata = candidates.map((candidate) => ({
    lookId: candidate.lookId,
    formula: candidate.formula,
    selectionMode: candidate.selectionMode,
    archetype: candidate.archetype,
    roles: candidate.roles,
    allowedSwapRoles: allowedSwapRolesForCandidate(candidate.roles),
    deterministicScore: Number(candidate.score.toFixed(3)),
    pieces: candidate.items.map((item, idx) => ({
      role: candidate.roles[idx] ?? item.slot,
      id: item.id,
      title: item.title,
      color: item.color,
      palette: item.palette,
      colorRole: item.color_role,
      fit: item.fit,
      formality: item.formality,
      material: item.material,
      semantics: item.semantics,
    })),
  }));

  const validIdsText = candidates.map((c) => c.lookId).join(", ");

  return `You are an editorial fashion critic evaluating ${candidates.length} pre-built outfit candidates shown in the attached Candidate Outfit Contact Sheet image.
Each horizontal panel in the contact sheet represents one complete outfit candidate, labeled with its lookId (${validIdsText}), formula, archetype, and garment slots arranged in role order.

STRICT RULES — YOU ARE A CRITIC, NOT A COMPOSER:
1. Judge ONLY the supplied candidate IDs (${validIdsText}). You must judge every supplied candidate exactly once.
2. Assign each candidate a unique integer rank from 1 to ${candidates.length} (1 = strongest overall).
3. Do NOT introduce, invent, or replace garments.
4. Do NOT modify item IDs, roles, formulas, or locked anchors.
5. Rank candidates based on visible palette harmony, texture, silhouette balance, layering visibility, occasion, weather (if provided), and user style preferences.
6. Hard deterministic physical and layering constraints have already been applied in Stage 1 and remain authoritative.
7. "preferredSwapRole" is advisory only (it does not execute a swap) and MUST be "none" or one of that candidate's "allowedSwapRoles".
8. Keep each "title" concise (2 to 60 characters), each "reason" concise (10 to 500 characters, 1–2 sentences explaining why the look works or what falls short), and each item in "issues" under 240 characters (0 to 5 strings).
9. Every visualScores field ("palette", "silhouette", "layering", "occasion") must be a finite number between 0 and 1.

VERDICT GUIDANCE:
- "strong": Cohesive palette, silhouette, textures, layering, and context fit.
- "acceptable": Viable outfit with minor flaws or one weaker element.
- "reject": Clear visual clash, poor proportion balance, or poor context fit compared to stronger alternatives.

LIVE_WEATHER_FORECAST:
${preferences.weather ? JSON.stringify(preferences.weather) : "None provided"}

USER_PREFERENCES:
${JSON.stringify(preferences)}

LOCKED_ANCHORS:
${JSON.stringify(anchors)}

CANDIDATE_OUTFITS:
${JSON.stringify(candidateMetadata)}`;
}

const SAFE_CRITIC_UNAVAILABLE_WARNING = "Visual critic unavailable; using deterministic outfit ranking.";
const SAFE_CRITIC_NOT_CONFIGURED_WARNING = "Visual critic is not configured; using deterministic outfit ranking.";
const SAFE_CRITIC_INVALID_KEY_WARNING = "Visual critic API key was rejected; using deterministic outfit ranking.";
const SAFE_CRITIC_RATE_LIMIT_WARNING = "Visual critic is temporarily rate-limited or busy; using deterministic outfit ranking.";
const SAFE_CRITIC_NETWORK_WARNING = "Visual critic could not reach Gemini; using deterministic outfit ranking.";
const SAFE_ALL_REJECTED_WARNING = "Visual critic rejected all candidates; using deterministic outfit ranking.";

export function classifyCriticFailureWarning(error: unknown): string {
  const message = (error instanceof Error ? error.message : String(error ?? "")).toLowerCase();
  if (message.includes("not configured")) return SAFE_CRITIC_NOT_CONFIGURED_WARNING;
  if (
    message.includes("api key not valid") ||
    message.includes("api_key_invalid") ||
    message.includes(" 401:") ||
    message.includes(" 403:")
  ) {
    return SAFE_CRITIC_INVALID_KEY_WARNING;
  }
  if (
    message.includes(" 429:") ||
    message.includes(" 503:") ||
    message.includes("quota") ||
    message.includes("overloaded")
  ) {
    return SAFE_CRITIC_RATE_LIMIT_WARNING;
  }
  if (
    message.includes("fetch failed") ||
    message.includes("enotfound") ||
    message.includes("econnrefused") ||
    message.includes("timed out") ||
    message.includes("timeout") ||
    message.includes("cert")
  ) {
    return SAFE_CRITIC_NETWORK_WARNING;
  }
  return SAFE_CRITIC_UNAVAILABLE_WARNING;
}

export async function critiqueAndRerankCandidates(
  req: CriticRequest,
  deps: CriticDependencies = {},
): Promise<CriticResponse> {
  const wardrobeItems = Array.isArray(req.wardrobeItems) ? req.wardrobeItems.slice(0, 60) : [];
  const anchors = Array.isArray(req.anchors) ? req.anchors.slice(0, 12) : [];
  const recentlyUsedItemIds = Array.isArray(req.recentlyUsedItemIds) ? req.recentlyUsedItemIds.slice(0, 30) : [];
  const seed = typeof req.seed === "number" && Number.isFinite(req.seed) ? req.seed : Date.now();
  const preferences = req.preferences ?? {};
  const feedback = normalizeOutfitFeedback(req.feedback);

  const suppliedCandidates = Array.isArray(req.candidates)
    ? req.candidates.filter(isValidCandidateLook).slice(0, 8)
    : [];

  const sourceCandidates =
    suppliedCandidates.length > 0
      ? suppliedCandidates.map(cloneLook)
      : recommend(anchors, 3, {
          extraItems: wardrobeItems,
          recentlyUsedItemIds,
          seed,
          preferences,
          feedback,
          candidateLimit: 5,
        }).map(cloneLook);

  const deterministicTop3 = sourceCandidates.slice(0, 3).map((candidate) => ({
    ...cloneLook(candidate),
    deterministicReason: candidate.deterministicReason ?? candidate.reason,
  }));

  if (sourceCandidates.length === 0) {
    return {
      looks: [],
      rejected: [],
      source: "deterministic",
      warning: SAFE_CRITIC_UNAVAILABLE_WARNING,
    };
  }

  const isConfigured = deps.isGeminiConfigured ?? geminiConfigured;
  if (!isConfigured()) {
    return {
      looks: deterministicTop3,
      rejected: [],
      source: "deterministic",
      warning: SAFE_CRITIC_NOT_CONFIGURED_WARNING,
    };
  }

  const askCritic =
    deps.askCritic ??
    ((args: {
      prompt: string;
      images: InlineImage[];
      responseSchema: Record<string, unknown>;
      temperature: number;
    }) => askGeminiJson<unknown>(args));

  try {
    const taggedCandidates = assignCandidateIds(sourceCandidates);
    const validLookIds = taggedCandidates.map((candidate) => candidate.lookId);
    const { image: contactSheet } = await buildCandidateContactSheet(taggedCandidates, {
      fetchImage: deps.fetchImage,
    });

    const raw = await askCritic({
      prompt: buildCriticPrompt(taggedCandidates, anchors, preferences),
      images: [contactSheet],
      responseSchema: buildCriticResponseSchema(validLookIds),
      temperature: 0.2,
    });

    const judgment = parseStylistJudgment(raw, validLookIds);
    assertAvailableSwapRoles(taggedCandidates, judgment);
    const ranked = rankJudgedCandidates(taggedCandidates, judgment);
    assertCandidatesUnmutated(taggedCandidates, ranked);

    const rejected = judgment.judgments
      .filter((entry) => entry.verdict === "reject")
      .map((entry) => `${entry.lookId}: ${entry.issues[0] ?? entry.reason}`);

    if (ranked.length === 0) {
      return {
        looks: deterministicTop3,
        rejected,
        source: "deterministic",
        warning: SAFE_ALL_REJECTED_WARNING,
      };
    }

    const finalLooks = ranked.slice(0, 3).map((candidate): Look => {
      const blendedBreakdown = blendCriticScoreBreakdown(
        candidate.scoreBreakdown,
        candidate.visualScores!,
        candidate.items,
        preferences,
        feedback,
      );
      const cleanLook = stripCandidateId(candidate);
      return {
        ...cleanLook,
        deterministicReason: candidate.deterministicReason ?? candidate.reason,
        scoreBreakdown: blendedBreakdown,
        score: blendedBreakdown.total,
        cohesion: blendedBreakdown.compatibility,
      };
    });

    return {
      looks: finalLooks,
      rejected,
      source: "gemini",
    };
  } catch (error) {
    if (!deps.askCritic) {
      console.error("[stylist-critic] Stage 2 fallback:", error instanceof Error ? error.message : String(error));
    }
    return {
      looks: deterministicTop3,
      rejected: [],
      source: "deterministic",
      warning: classifyCriticFailureWarning(error),
    };
  }
}
