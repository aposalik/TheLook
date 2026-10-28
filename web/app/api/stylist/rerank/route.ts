import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import { readFile } from "node:fs/promises";
import sharp, { type OverlayOptions } from "sharp";
import { askGeminiJson, geminiConfigured, parseDataImage } from "@/lib/gemini";
import { normalizeOutfitFeedback, type OutfitFeedbackEvent } from "@/lib/outfit-feedback";
import type { VisualScores } from "@/lib/stylist-judge";
import {
  buildReason,
  buildRollingRack,
  buildScoreBreakdownFromVisuals,
  inferArchetype,
  recommend,
  repairOutfitFromRack,
  stampOutfitRolesOnItems,
  validateOutfitCandidate,
  type Item,
  type Look,
  type RollingRack,
  type StylePreferences,
} from "@/lib/recommend";

export const runtime = "nodejs";

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function fetchItemImageBuffer(item: Item): Promise<Buffer> {
  const inline = parseDataImage(item.image);
  if (inline) {
    return Buffer.from(inline.data, "base64");
  }
  if (item.image?.startsWith("http://") || item.image?.startsWith("https://")) {
    const res = await fetch(item.image, { cache: "no-store", signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`Could not fetch garment image (${res.status})`);
    return Buffer.from(await res.arrayBuffer());
  }
  const relative = (item.image || "").replace(/^\/+/, "");
  const full = path.resolve(process.cwd(), "public", relative);
  const root = path.resolve(process.cwd(), "public") + path.sep;
  if (!full.startsWith(root)) throw new Error("Invalid catalog image path");
  return readFile(full);
}

async function buildContactSheet(rackItems: Item[]): Promise<{
  image: { data: string; mimeType: string };
  indexedItems: Array<{ rackIndex: number; itemId: string; title: string; roles: string[] }>;
}> {
  const COLS = 4;
  const CELL_W = 260;
  const CELL_H = 260;
  const IMG_H = 205;
  const items = rackItems.slice(0, 20);
  const rows = Math.max(1, Math.ceil(items.length / COLS));
  const width = COLS * CELL_W;
  const height = rows * CELL_H;

  const composites: OverlayOptions[] = [];
  const indexedItems: Array<{ rackIndex: number; itemId: string; title: string; roles: string[] }> = [];

  await Promise.all(
    items.map(async (item, index) => {
      const col = index % COLS;
      const row = Math.floor(index / COLS);
      const x = col * CELL_W;
      const y = row * CELL_H;
      const roles = item.slots && item.slots.length ? item.slots : [item.slot];
      indexedItems.push({
        rackIndex: index + 1,
        itemId: item.id,
        title: item.title,
        roles,
      });

      try {
        if (item.image) {
          const raw = await fetchItemImageBuffer(item);
          const thumb = await sharp(raw)
            .rotate()
            .resize({ width: CELL_W - 24, height: IMG_H - 16, fit: "contain", background: { r: 247, g: 245, b: 240, alpha: 1 } })
            .jpeg({ quality: 76 })
            .toBuffer();
          composites.push({ input: thumb, left: x + 12, top: y + 8 });
        }
      } catch {
        // Keep label tile even if a single image URL fails
      }

      const shortId = item.id.length > 22 ? `${item.id.slice(0, 20)}..` : item.id;
      const shortTitle = item.title.length > 26 ? `${item.title.slice(0, 24)}..` : item.title;
      const roleStr = roles.join("/");
      const labelSvg = Buffer.from(
        `<svg width="${CELL_W}" height="52" xmlns="http://www.w3.org/2000/svg">
          <rect x="6" y="2" width="${CELL_W - 12}" height="46" rx="8" fill="#1A1A1A"/>
          <text x="14" y="20" fill="#F5E6C8" font-family="sans-serif" font-size="12" font-weight="bold">[#${index + 1}] ${escapeXml(shortId)} (${escapeXml(roleStr)})</text>
          <text x="14" y="38" fill="#FFFFFF" font-family="sans-serif" font-size="11">${escapeXml(shortTitle)}</text>
        </svg>`,
      );
      composites.push({ input: labelSvg, left: x, top: y + IMG_H });
    }),
  );

  const sheet = await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 247, g: 245, b: 240 },
    },
  })
    .composite(composites)
    .jpeg({ quality: 78 })
    .toBuffer();

  return {
    image: { data: sheet.toString("base64"), mimeType: "image/jpeg" },
    indexedItems: indexedItems.sort((a, b) => a.rackIndex - b.rackIndex),
  };
}

type ComposedOutfitRaw = {
  formula?: string;
  selectionMode?: "safe" | "balanced" | "expressive" | "alternate";
  itemIds?: string[];
  roles?: string[];
  title?: string;
  reason?: string;
  visualScores?: VisualScores;
};

const COMPOSE_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: "OBJECT",
  required: ["outfits"],
  properties: {
    outfits: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        required: ["formula", "selectionMode", "itemIds", "roles", "title", "reason", "visualScores"],
        properties: {
          formula: {
            type: "STRING",
            enum: ["Simple", "Layered", "With layer", "Three layer", "Dress"],
          },
          selectionMode: {
            type: "STRING",
            enum: ["safe", "balanced", "expressive", "alternate"],
          },
          itemIds: {
            type: "ARRAY",
            items: { type: "STRING" },
          },
          roles: {
            type: "ARRAY",
            items: { type: "STRING" },
          },
          title: { type: "STRING" },
          reason: { type: "STRING" },
          visualScores: {
            type: "OBJECT",
            required: ["palette", "silhouette", "layering", "occasion"],
            properties: {
              palette: { type: "NUMBER" },
              silhouette: { type: "NUMBER" },
              layering: { type: "NUMBER" },
              occasion: { type: "NUMBER" },
            },
          },
        },
      },
    },
  },
};

function heroTopBottomKey(items: Item[], roles: string[]): string {
  const bottom = items[roles.indexOf("bottom")] ?? items[roles.indexOf("dress")];
  const heroUpper =
    items[roles.indexOf("outer")] ??
    items[roles.indexOf("overshirt")] ??
    items[roles.indexOf("top")] ??
    items[roles.indexOf("base")];
  return `${heroUpper?.id ?? "none"}|${bottom?.id ?? "none"}`;
}

function verifyAndGuardComposedLooks(
  rawRoot: unknown,
  rack: RollingRack,
  allItemsById: Map<string, Item>,
  anchorIds: string[],
  preferences: StylePreferences,
  feedback: OutfitFeedbackEvent[],
): { validLooks: Look[]; rejectedReasons: string[] } {
  if (!rawRoot || typeof rawRoot !== "object") return { validLooks: [], rejectedReasons: [] };
  const rootObj = rawRoot as { outfits?: unknown; agentOutfits?: unknown };
  const list = Array.isArray(rootObj.outfits)
    ? rootObj.outfits
    : Array.isArray(rootObj.agentOutfits)
      ? rootObj.agentOutfits
      : [];

  const coreAnchors = anchorIds.filter((id) => {
    const it = allItemsById.get(id);
    return it && it.category !== "accessory" && it.slot !== "accessory";
  });

  const validLooks: Look[] = [];
  const rejectedReasons: string[] = [];
  const seenSignatures = new Set<string>();
  const seenHeroPairs = new Set<string>();
  const bothUpperAndBottomAnchored = coreAnchors.length >= 2;

  for (const raw of list.slice(0, 6)) {
    if (!raw || typeof raw !== "object") continue;
    const entry = raw as ComposedOutfitRaw;
    const formula = typeof entry.formula === "string" ? entry.formula : "";
    if (!["Simple", "Layered", "With layer", "Three layer", "Dress"].includes(formula)) continue;
    if (!Array.isArray(entry.itemIds) || !Array.isArray(entry.roles)) continue;
    if (entry.itemIds.length !== entry.roles.length || entry.itemIds.length < 2) continue;

    let items: Item[] = [];
    let missing = false;
    for (const id of entry.itemIds) {
      const rawStr = typeof id === "string" ? id.trim() : String(id ?? "").trim();
      const cleanId = rawStr.replace(/^\[#?\d+\]\s*/, "").trim();
      const rackTagMatch = rawStr.match(/^\[?#?(\d+)\]?$/);
      const found =
        allItemsById.get(rawStr) ??
        allItemsById.get(cleanId) ??
        (rackTagMatch ? allItemsById.get(`#${rackTagMatch[1]}`) : undefined);
      if (!found) {
        missing = true;
        break;
      }
      items.push(found);
    }
    if (missing) continue;

    let roles = entry.roles.map((r) => String(r));
    if (coreAnchors.some((anchorId) => !items.some((it) => it.id === anchorId))) continue;

    // Post-Generation Hard Guardrail: validate or auto-swap offending non-anchor slot from rack
    const initialCheck = validateOutfitCandidate(formula, items, roles);
    if (!initialCheck.valid) {
      const repaired = repairOutfitFromRack(formula, items, roles, rack, coreAnchors);
      if (!repaired) {
        rejectedReasons.push(`${formula}: ${initialCheck.violations.join(", ")}`);
        continue;
      }
      items = repaired.items;
      roles = repaired.roles;
    }

    const sig = items.map((it) => it.id).sort().join("|");
    if (seenSignatures.has(sig)) continue;

    const heroPair = heroTopBottomKey(items, roles);
    if (!bothUpperAndBottomAnchored && seenHeroPairs.has(heroPair) && validLooks.length < 3) {
      // Avoid clone outfits that reuse the exact same hero top + bottom
      continue;
    }

    seenSignatures.add(sig);
    seenHeroPairs.add(heroPair);

    const scoreBreakdown = buildScoreBreakdownFromVisuals(entry.visualScores, items, preferences, feedback);
    const deterministicReason = buildReason(formula, items, roles, preferences);
    const reason = typeof entry.reason === "string" && entry.reason.trim().length >= 10
      ? entry.reason.trim()
      : deterministicReason;
    const title = typeof entry.title === "string" && entry.title.trim().length >= 2
      ? entry.title.trim()
      : formula;

    const targetModes: Array<"safe" | "balanced" | "expressive"> = ["safe", "balanced", "expressive"];
    const selectionMode = targetModes[validLooks.length] ?? "alternate";

    const stampedItems = stampOutfitRolesOnItems(items, roles);

    validLooks.push({
      formula,
      archetype: inferArchetype(formula, stampedItems, preferences),
      selectionMode,
      items: stampedItems,
      roles,
      score: scoreBreakdown.total,
      cohesion: scoreBreakdown.compatibility,
      scoreBreakdown,
      reason,
      deterministicReason,
      aiReason: reason,
      stylistTitle: title,
      stylistVerdict: "strong",
      visualScores: entry.visualScores ?? {
        palette: scoreBreakdown.palette,
        silhouette: scoreBreakdown.silhouette,
        layering: scoreBreakdown.compatibility,
        occasion: scoreBreakdown.formality,
      },
      stylistIssues: [],
      preferredSwapRole: "none",
    });
  }

  return { validLooks, rejectedReasons };
}

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    candidates?: Look[];
    wardrobeItems?: Item[];
    anchors?: string[];
    recentlyUsedItemIds?: string[];
    seed?: number;
    preferences?: StylePreferences;
    feedback?: OutfitFeedbackEvent[];
  };

  const wardrobeItems = Array.isArray(body.wardrobeItems) ? body.wardrobeItems.slice(0, 60) : [];
  const anchors = Array.isArray(body.anchors) ? body.anchors.slice(0, 12) : [];
  const recentlyUsedItemIds = Array.isArray(body.recentlyUsedItemIds) ? body.recentlyUsedItemIds.slice(0, 30) : [];
  const seed = typeof body.seed === "number" && Number.isFinite(body.seed) ? body.seed : Date.now();
  const preferences = body.preferences ?? {};
  const feedback = normalizeOutfitFeedback(body.feedback);

  // Stage 1: Build the Smart Rolling Rack (12 to 20 diverse items)
  const rack = buildRollingRack({
    extraItems: wardrobeItems,
    anchorIds: anchors,
    recentlyUsedItemIds,
    preferences,
    feedback,
    seed,
    maxItems: 18,
  });

  const fallbackLooks = Array.isArray(body.candidates) && body.candidates.length > 0
    ? body.candidates.slice(0, 3)
    : recommend(anchors, 3, {
        extraItems: wardrobeItems,
        recentlyUsedItemIds,
        seed,
        preferences,
        feedback,
      });

  if (!geminiConfigured() || rack.items.length < 2) {
    return NextResponse.json({
      looks: fallbackLooks.slice(0, 3),
      rejected: [],
      source: "deterministic",
    });
  }

  try {
    const allItemsById = new Map<string, Item>();
    rack.items.forEach((item, idx) => {
      allItemsById.set(item.id, item);
      allItemsById.set(`#${idx + 1}`, item);
      allItemsById.set(String(idx + 1), item);
    });
    for (const item of wardrobeItems) if (!allItemsById.has(item.id)) allItemsById.set(item.id, item);
    for (const look of fallbackLooks) {
      for (const item of look.items) if (!allItemsById.has(item.id)) allItemsById.set(item.id, item);
    }

    // Build 1 Contact Sheet grid image of the Rolling Rack
    const { image: contactSheetImage, indexedItems } = await buildContactSheet(rack.items);

    const rackMetadata = rack.items.map((item, idx) => ({
      rackTag: `#${idx + 1}`,
      id: item.id,
      title: item.title,
      category: item.category,
      slots: item.slots ?? [item.slot],
      layer: item.layer,
      color: item.color,
      palette: item.palette,
      color_role: item.color_role,
      fit: item.fit,
      formality: item.formality,
      material: item.material,
      styles: item.styles,
      semantics: item.semantics,
    }));

    // Stage 2: Gemini Vision Stylist Composer
    const raw = await askGeminiJson<unknown>({
      images: [contactSheetImage],
      responseSchema: COMPOSE_RESPONSE_SCHEMA,
      temperature: 0.35,
      prompt: `You are a celebrity fashion stylist working from a curated Rolling Rack of ${rack.items.length} garments shown in the attached Contact Sheet image.
Each tile in the Contact Sheet is labeled with its short rackTag ([#1], [#2], etc.), its item ID, and its allowed slot roles.

YOUR TASK:
Compose 5 distinct, complete outfits from RACK_ITEMS (ranked 1 to 5). Keep each "reason" concise (1-2 sentences) and use short rackTags (e.g. "#1", "#4", "#9") or exact item IDs in "itemIds":
- Outfit 1 ("safe"): Clean, effortless, high-confidence daily wear with timeless proportions.
- Outfit 2 ("balanced"): Intentional layering, texture contrast, or modern proportion play (e.g., relaxed/wide trousers balanced by a structured top, or 3-layer depth: Base + Mid + Outer).
- Outfit 3 ("expressive"): Editorial/styled look using real fashion techniques — such as the "sandwich rule" (echoing shoe/hat/outerwear color or weight while keeping the middle grounded), tonal dressing, or modern city-boy/streetwear wide-on-wide silhouettes anchored by substantial footwear.
- Outfits 4 & 5 ("alternate"): Two strong backup looks with different pieces in case any primary look fails a physical constraint.

ANTI-CLONE DIVERSITY RULE:
- Do NOT produce 5 variations of the same outfit!
- Unless both top and bottom are locked in LOCKED_ANCHORS, every outfit MUST use a different hero top + bottom combination.

VALID FORMULAS & EXACT ROLES ARRAYS:
- "Simple": roles ["top", "bottom", "shoes"] (or append "accessory")
- "Layered": roles ["base", "overshirt", "bottom", "shoes"] (2 upper layers: base tee/shirt under mid overshirt/cardigan/knit)
- "With layer": roles ["base", "outer", "bottom", "shoes"] (base/top under outer jacket/coat/bomber)
- "Three layer": roles ["base", "overshirt", "outer", "bottom", "shoes"] (3 upper layers: base tee + mid overshirt/knit + outer jacket/coat)
- "Dress": roles ["dress", "shoes"]

HARD PHYSICAL & LAYERING GUARDRAILS (MUST OBEY):
1. Use ONLY exact item IDs from RACK_ITEMS, and every outfit MUST include all LOCKED_ANCHORS: ${JSON.stringify(anchors)}.
2. Respect garment slots:
   - "base" role requires an item with "innerwear" or base "top" capability.
   - "overshirt" role requires a mid-layer piece ("top" + "outerwear", cardigan, overshirt, half-zip, V-neck knit).
   - "outer" role requires an "outerwear" jacket, bomber, blazer, or coat.
3. Physical bulk must increase from inner to outer layer (never put a heavy hoodie/sweater under a lighter shirt).
4. Never layer two collared shirts together unless the outer is a substantial overshirt/shacket/jacket.
5. Never stack two competing patterns (e.g., striped shirt + striped/checked layer) on the upper body.
6. Never put a hoodie underneath a pullover sweater, button-up shirt, cotton overshirt, or cardigan (a hoodie can only be worn solo as "Simple" or under a heavy outer jacket/coat as "With layer").
7. Never pair a formal/polished dress button-up shirt with loungewear sweatpants.
8. If LIVE_WEATHER_FORECAST is provided, match the warmth, layering depth, and fabrics to the temperature & weather conditions, and mention how the look fits the weather in "reason".

LIVE_WEATHER_FORECAST:
${preferences.weather ? JSON.stringify(preferences.weather) : "None provided"}

USER PREFERENCES:
${JSON.stringify(preferences)}

LOCKED_ANCHORS (MUST BE INCLUDED IN EVERY OUTFIT):
${JSON.stringify(anchors)}

CONTACT_SHEET_INDEX:
${JSON.stringify(indexedItems)}

RACK_ITEMS:
${JSON.stringify(rackMetadata)}`,
    });

    // Stage 3: Post-Generation Hard Guardrail (validateOutfitCandidate + single-slot rack repair)
    const { validLooks, rejectedReasons } = verifyAndGuardComposedLooks(
      raw,
      rack,
      allItemsById,
      anchors,
      preferences,
      feedback,
    );

    // Top up from fallbackLooks if fewer than 3 survived validation
    const finalLooks: Look[] = [...validLooks];
    const seenSigs = new Set(finalLooks.map((l) => l.items.map((i) => i.id).sort().join("|")));
    for (const fb of fallbackLooks) {
      if (finalLooks.length >= 3) break;
      const sig = fb.items.map((i) => i.id).sort().join("|");
      if (seenSigs.has(sig)) continue;
      seenSigs.add(sig);
      finalLooks.push(fb);
    }

    if (!finalLooks.length) {
      return NextResponse.json({
        looks: fallbackLooks.slice(0, 3),
        rejected: rejectedReasons,
        source: "deterministic",
        warning: "Gemini candidates failed physical guardrails; used pruned rack fallback.",
      });
    }

    return NextResponse.json({
      looks: finalLooks.slice(0, 3),
      rejected: rejectedReasons,
      source: validLooks.length > 0 ? "gemini" : "deterministic",
    });
  } catch (error) {
    return NextResponse.json({
      looks: fallbackLooks.slice(0, 3),
      rejected: [],
      source: "deterministic",
      warning: error instanceof Error ? error.message : String(error),
    });
  }
}
