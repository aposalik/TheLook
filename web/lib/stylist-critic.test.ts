import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";

import { recommend, type Item, type Look } from "./recommend";
import {
  assertCandidatesUnmutated,
  assignCandidateIds,
  buildCandidateContactSheet,
  classifyCriticFailureWarning,
  critiqueAndRerankCandidates,
} from "./stylist-critic";
import type { StylistJudgmentEntry, StylistVerdict, SwapRole } from "./stylist-judge";

function makeTinyPngDataUrl(r: number, g: number, b: number): Promise<string> {
  return sharp({
    create: { width: 48, height: 48, channels: 3, background: { r, g, b } },
  })
    .png()
    .toBuffer()
    .then((buf) => `data:image/png;base64,${buf.toString("base64")}`);
}

async function buildSampleWardrobe(): Promise<Item[]> {
  const [whitePng, navyPng, olivePng, leatherPng, trouserPng, denimPng, shoePng] = await Promise.all([
    makeTinyPngDataUrl(245, 245, 240),
    makeTinyPngDataUrl(30, 48, 84),
    makeTinyPngDataUrl(90, 102, 70),
    makeTinyPngDataUrl(95, 38, 44),
    makeTinyPngDataUrl(215, 206, 190),
    makeTinyPngDataUrl(74, 96, 128),
    makeTinyPngDataUrl(28, 42, 72),
  ]);

  return [
    {
      id: "tee_white",
      slot: "top",
      slots: ["innerwear", "top"],
      title: "White Crew Tee",
      color: "#F5F5F0",
      palette: "neutral",
      color_role: "neutral",
      image: whitePng,
      category: "upper",
      layer: "base",
      fit: "regular",
      formality: 1,
      gender: "men",
      seasons: ["all-season"],
      styles: ["minimal", "casual"],
      semantics: {
        garmentType: "t-shirt",
        pattern: "solid",
        patternScale: "none",
        fabric: "cotton",
        fabricWeight: "light",
        collarType: "crew",
        closure: "none",
        canWearOpen: false,
        layerRole: "base",
        silhouetteVolume: "low",
        length: "regular",
        isSubstantialLayer: false,
        isLoungewear: false,
        inferenceConfidence: "high",
      },
    },
    {
      id: "tee_navy",
      slot: "top",
      slots: ["innerwear", "top"],
      title: "Navy Heavy Tee",
      color: "#1E3054",
      palette: "cool",
      color_role: "neutral",
      image: navyPng,
      category: "upper",
      layer: "base",
      fit: "regular",
      formality: 1,
      gender: "men",
      seasons: ["all-season"],
      styles: ["minimal", "streetwear"],
      semantics: {
        garmentType: "t-shirt",
        pattern: "solid",
        patternScale: "none",
        fabric: "cotton",
        fabricWeight: "light",
        collarType: "crew",
        closure: "none",
        canWearOpen: false,
        layerRole: "base",
        silhouetteVolume: "low",
        length: "regular",
        isSubstantialLayer: false,
        isLoungewear: false,
        inferenceConfidence: "high",
      },
    },
    {
      id: "overshirt_olive",
      slot: "outerwear",
      slots: ["top", "outerwear"],
      title: "Olive Cotton Overshirt",
      color: "#5A6646",
      palette: "neutral",
      color_role: "neutral",
      image: olivePng,
      category: "upper",
      layer: "mid",
      fit: "relaxed",
      formality: 2,
      gender: "men",
      seasons: ["spring", "autumn"],
      styles: ["utility", "casual"],
      semantics: {
        garmentType: "overshirt",
        pattern: "solid",
        patternScale: "none",
        fabric: "cotton",
        fabricWeight: "medium",
        collarType: "point",
        closure: "buttons",
        canWearOpen: true,
        layerRole: "mid",
        silhouetteVolume: "medium",
        length: "regular",
        isSubstantialLayer: true,
        isLoungewear: false,
        inferenceConfidence: "high",
      },
    },
    {
      id: "bomber_burgundy",
      slot: "outerwear",
      slots: ["outerwear"],
      title: "Burgundy Leather Bomber",
      color: "#5F262C",
      palette: "warm",
      color_role: "accent",
      image: leatherPng,
      category: "upper",
      layer: "outer",
      fit: "relaxed",
      formality: 3,
      gender: "men",
      seasons: ["autumn", "winter"],
      styles: ["smart-casual", "streetwear"],
      semantics: {
        garmentType: "bomber-jacket",
        pattern: "solid",
        patternScale: "none",
        fabric: "leather",
        fabricWeight: "heavy",
        collarType: "point",
        closure: "zip",
        canWearOpen: true,
        layerRole: "outer",
        silhouetteVolume: "medium",
        length: "regular",
        isSubstantialLayer: true,
        isLoungewear: false,
        inferenceConfidence: "high",
      },
    },
    {
      id: "trouser_cream",
      slot: "bottom",
      slots: ["bottom"],
      title: "Cream Pleated Trousers",
      color: "#D7CEBE",
      palette: "neutral",
      color_role: "neutral",
      image: trouserPng,
      category: "bottom",
      layer: null,
      fit: "relaxed",
      formality: 3,
      gender: "men",
      seasons: ["spring", "autumn"],
      styles: ["smart-casual", "minimal"],
      semantics: {
        garmentType: "trousers",
        pattern: "solid",
        patternScale: "none",
        fabric: "cotton",
        fabricWeight: "medium",
        collarType: "none",
        closure: "zip",
        canWearOpen: false,
        silhouetteVolume: "medium",
        length: "regular",
        isSubstantialLayer: false,
        isLoungewear: false,
        inferenceConfidence: "high",
      },
    },
    {
      id: "jeans_blue",
      slot: "bottom",
      slots: ["bottom"],
      title: "Medium Wash Jeans",
      color: "#4A6080",
      palette: "cool",
      color_role: "neutral",
      image: denimPng,
      category: "bottom",
      layer: null,
      fit: "relaxed",
      formality: 2,
      gender: "men",
      seasons: ["all-season"],
      styles: ["casual", "streetwear"],
      semantics: {
        garmentType: "jeans",
        pattern: "solid",
        patternScale: "none",
        fabric: "denim",
        fabricWeight: "medium",
        collarType: "none",
        closure: "buttons",
        canWearOpen: false,
        silhouetteVolume: "medium",
        length: "regular",
        isSubstantialLayer: false,
        isLoungewear: false,
        inferenceConfidence: "high",
      },
    },
    {
      id: "sneaker_navy",
      slot: "shoe",
      slots: ["shoe"],
      title: "Navy Suede Sneakers",
      color: "#1C2A48",
      palette: "cool",
      color_role: "neutral",
      image: shoePng,
      category: "shoe",
      layer: null,
      fit: "regular",
      formality: 2,
      gender: "men",
      seasons: ["all-season"],
      styles: ["casual", "minimal"],
      semantics: {
        garmentType: "sneaker",
        pattern: "solid",
        patternScale: "none",
        fabric: "suede",
        fabricWeight: "medium",
        collarType: "none",
        closure: "none",
        canWearOpen: false,
        silhouetteVolume: "low",
        length: "regular",
        isSubstantialLayer: false,
        isLoungewear: false,
        inferenceConfidence: "high",
      },
    },
  ];
}

function buildFiveCandidates(wardrobe: Item[]): Look[] {
  const candidates = recommend(["tee_white"], 3, {
    catalogItems: [],
    extraItems: wardrobe,
    preferences: { gender: "men", occasion: "casual" },
    candidateLimit: 5,
    seed: 7,
  });
  assert.equal(candidates.length, 5, "Test wardrobe should generate 5 distinct deterministic candidates");
  return candidates;
}

function makeJudgmentForOrder(
  order: string[],
  overrides: Partial<Record<string, Partial<StylistJudgmentEntry>>> = {},
): { judgments: StylistJudgmentEntry[] } {
  return {
    judgments: order.map((lookId, index) => ({
      lookId,
      rank: index + 1,
      verdict: "strong" as StylistVerdict,
      visualScores: { palette: 0.91 - index * 0.05, silhouette: 0.88 - index * 0.04, layering: 0.9, occasion: 0.87 },
      issues: [],
      preferredSwapRole: "none" as SwapRole,
      title: `Curated Look ${lookId}`,
      reason: `Candidate ${lookId} achieves balanced proportions and color cohesion across its layers.`,
      ...overrides[lookId],
    })),
  };
}

test("1 & 10. All five deterministic candidates reach the critic, and Gemini reranks without changing item sets", async () => {
  const wardrobe = await buildSampleWardrobe();
  const candidates = buildFiveCandidates(wardrobe);

  let receivedPrompt = "";
  let receivedEnum: string[] = [];
  let receivedImageMime = "";

  const result = await critiqueAndRerankCandidates(
    {
      candidates,
      anchors: ["tee_white"],
      preferences: { gender: "men", occasion: "casual" },
    },
    {
      isGeminiConfigured: () => true,
      askCritic: async ({ prompt, images, responseSchema }) => {
        receivedPrompt = prompt;
        receivedImageMime = images[0]?.mimeType ?? "";
        const judgmentsProp = (responseSchema.properties as Record<string, unknown>).judgments as {
          items: { properties: { lookId: { enum: string[] } } };
        };
        receivedEnum = judgmentsProp.items.properties.lookId.enum;
        return makeJudgmentForOrder(["candidate_4", "candidate_2", "candidate_1", "candidate_5", "candidate_3"]);
      },
    },
  );

  assert.equal(receivedImageMime, "image/jpeg");
  assert.deepEqual(receivedEnum, ["candidate_1", "candidate_2", "candidate_3", "candidate_4", "candidate_5"]);
  assert.ok(!receivedPrompt.includes("RACK_ITEMS"), "Critic prompt must not expose a raw rack for composition");
  assert.ok(!receivedPrompt.includes("Compose 5 distinct"), "Critic prompt must not ask Gemini to compose outfits");

  assert.equal(result.source, "gemini");
  assert.equal(result.looks.length, 3);

  const expectedOrder = [candidates[3]!, candidates[1]!, candidates[0]!];
  result.looks.forEach((look, idx) => {
    const original = expectedOrder[idx]!;
    assert.equal("lookId" in look, false, "Returned Look must not leak route-local lookId");
    assert.equal(look.formula, original.formula);
    assert.deepEqual(look.roles, original.roles);
    assert.deepEqual(
      look.items.map((item) => item.id),
      original.items.map((item) => item.id),
    );
    assert.equal(look.stylistVerdict, "strong");
    assert.ok(look.score >= 0 && look.score <= 1);
    assert.ok(look.scoreBreakdown.total >= 0 && look.scoreBreakdown.total <= 1);
    assert.ok(look.stylistTitle?.startsWith("Curated Look candidate_"));
  });
});

test("2. Unknown candidate IDs are rejected and trigger deterministic fallback", async () => {
  const wardrobe = await buildSampleWardrobe();
  const candidates = buildFiveCandidates(wardrobe);

  const result = await critiqueAndRerankCandidates(
    { candidates, anchors: ["tee_white"] },
    {
      isGeminiConfigured: () => true,
      askCritic: async () =>
        makeJudgmentForOrder(["candidate_99", "candidate_2", "candidate_3", "candidate_4", "candidate_5"]),
    },
  );

  assert.equal(result.source, "deterministic");
  assert.ok(result.warning);
  assert.deepEqual(
    result.looks.map((look) => look.items.map((item) => item.id)),
    candidates.slice(0, 3).map((look) => look.items.map((item) => item.id)),
  );
});

test("3. Duplicate or missing candidate judgments are rejected and trigger deterministic fallback", async () => {
  const wardrobe = await buildSampleWardrobe();
  const candidates = buildFiveCandidates(wardrobe);

  const duplicateResult = await critiqueAndRerankCandidates(
    { candidates, anchors: ["tee_white"] },
    {
      isGeminiConfigured: () => true,
      askCritic: async () =>
        makeJudgmentForOrder(["candidate_1", "candidate_1", "candidate_3", "candidate_4", "candidate_5"]),
    },
  );
  assert.equal(duplicateResult.source, "deterministic");
  assert.ok(duplicateResult.warning);

  const missingResult = await critiqueAndRerankCandidates(
    { candidates, anchors: ["tee_white"] },
    {
      isGeminiConfigured: () => true,
      askCritic: async () => makeJudgmentForOrder(["candidate_1", "candidate_2", "candidate_3", "candidate_4"]),
    },
  );
  assert.equal(missingResult.source, "deterministic");
  assert.ok(missingResult.warning);
});

test("4. Invalid ranks and visual scores are rejected and trigger deterministic fallback", async () => {
  const wardrobe = await buildSampleWardrobe();
  const candidates = buildFiveCandidates(wardrobe);

  const invalidCases = [
    makeJudgmentForOrder(["candidate_1", "candidate_2", "candidate_3", "candidate_4", "candidate_5"], {
      candidate_1: { rank: 0 },
    }),
    makeJudgmentForOrder(["candidate_1", "candidate_2", "candidate_3", "candidate_4", "candidate_5"], {
      candidate_2: { rank: 1 },
    }),
    makeJudgmentForOrder(["candidate_1", "candidate_2", "candidate_3", "candidate_4", "candidate_5"], {
      candidate_3: { visualScores: { palette: 1.3, silhouette: 0.8, layering: 0.8, occasion: 0.8 } },
    }),
    makeJudgmentForOrder(["candidate_1", "candidate_2", "candidate_3", "candidate_4", "candidate_5"], {
      candidate_4: { visualScores: { palette: -0.1, silhouette: 0.8, layering: 0.8, occasion: 0.8 } },
    }),
  ];

  for (const invalidJudgment of invalidCases) {
    const result = await critiqueAndRerankCandidates(
      { candidates, anchors: ["tee_white"] },
      {
        isGeminiConfigured: () => true,
        askCritic: async () => invalidJudgment,
      },
    );
    assert.equal(result.source, "deterministic");
    assert.ok(result.warning);
    assert.equal(result.looks.length, 3);
  }
});

test("5. Suggested preferredSwapRole not present in that candidate is rejected", async () => {
  const wardrobe = await buildSampleWardrobe();
  const candidates = buildFiveCandidates(wardrobe);
  const simpleIdx = candidates.findIndex((c) => c.formula === "Simple");
  assert.ok(simpleIdx >= 0, "Expected at least one Simple candidate without outer role");
  const simpleLookId = `candidate_${simpleIdx + 1}`;
  assert.equal(candidates[simpleIdx]!.roles.includes("outer"), false);

  const result = await critiqueAndRerankCandidates(
    { candidates, anchors: ["tee_white"] },
    {
      isGeminiConfigured: () => true,
      askCritic: async () =>
        makeJudgmentForOrder(["candidate_1", "candidate_2", "candidate_3", "candidate_4", "candidate_5"], {
          [simpleLookId]: { preferredSwapRole: "outer" },
        }),
    },
  );

  assert.equal(result.source, "deterministic");
  assert.ok(result.warning);
});

test("6. Rejected candidates are removed without pulling deterministic replacements into Gemini output", async () => {
  const wardrobe = await buildSampleWardrobe();
  const candidates = buildFiveCandidates(wardrobe);

  const result = await critiqueAndRerankCandidates(
    { candidates, anchors: ["tee_white"] },
    {
      isGeminiConfigured: () => true,
      askCritic: async () =>
        makeJudgmentForOrder(["candidate_5", "candidate_2", "candidate_1", "candidate_3", "candidate_4"], {
          candidate_1: { verdict: "reject", issues: ["Color balance feels flat."] },
          candidate_3: { verdict: "reject", issues: ["Proportions feel slightly top-heavy."] },
          candidate_4: { verdict: "reject", issues: ["Layering contrast is weak."] },
        }),
    },
  );

  assert.equal(result.source, "gemini");
  assert.equal(result.looks.length, 2, "Only the 2 accepted candidates should be returned");
  assert.equal(result.rejected.length, 3);
  assert.deepEqual(
    result.looks.map((look) => look.items.map((item) => item.id)),
    [
      candidates[4]!.items.map((item) => item.id),
      candidates[1]!.items.map((item) => item.id),
    ],
  );
});

test("7. All-rejected output triggers deterministic top-3 fallback with warning", async () => {
  const wardrobe = await buildSampleWardrobe();
  const candidates = buildFiveCandidates(wardrobe);

  const result = await critiqueAndRerankCandidates(
    { candidates, anchors: ["tee_white"] },
    {
      isGeminiConfigured: () => true,
      askCritic: async () =>
        makeJudgmentForOrder(["candidate_1", "candidate_2", "candidate_3", "candidate_4", "candidate_5"], {
          candidate_1: { verdict: "reject", issues: ["Needs sharper silhouette."] },
          candidate_2: { verdict: "reject", issues: ["Needs sharper silhouette."] },
          candidate_3: { verdict: "reject", issues: ["Needs sharper silhouette."] },
          candidate_4: { verdict: "reject", issues: ["Needs sharper silhouette."] },
          candidate_5: { verdict: "reject", issues: ["Needs sharper silhouette."] },
        }),
    },
  );

  assert.equal(result.source, "deterministic");
  assert.ok(result.warning);
  assert.equal(result.rejected.length, 5);
  assert.equal(result.looks.length, 3);
  assert.deepEqual(
    result.looks.map((look) => look.items.map((item) => item.id)),
    candidates.slice(0, 3).map((look) => look.items.map((item) => item.id)),
  );
});

test("8. Gemini unconfigured, network failures, malformed JSON, and item mutations trigger deterministic fallback", async () => {
  const wardrobe = await buildSampleWardrobe();
  const candidates = buildFiveCandidates(wardrobe);
  const expectedTop3Ids = candidates.slice(0, 3).map((look) => look.items.map((item) => item.id));

  const unconfigured = await critiqueAndRerankCandidates(
    { candidates, anchors: ["tee_white"] },
    { isGeminiConfigured: () => false },
  );
  assert.equal(unconfigured.source, "deterministic");
  assert.ok(unconfigured.warning);
  assert.deepEqual(
    unconfigured.looks.map((look) => look.items.map((item) => item.id)),
    expectedTop3Ids,
  );

  const apiError = await critiqueAndRerankCandidates(
    { candidates, anchors: ["tee_white"] },
    {
      isGeminiConfigured: () => true,
      askCritic: async () => {
        throw new Error("Gemini 503 overloaded");
      },
    },
  );
  assert.equal(apiError.source, "deterministic");
  assert.ok(apiError.warning);
  assert.deepEqual(
    apiError.looks.map((look) => look.items.map((item) => item.id)),
    expectedTop3Ids,
  );

  const malformed = await critiqueAndRerankCandidates(
    { candidates, anchors: ["tee_white"] },
    {
      isGeminiConfigured: () => true,
      askCritic: async () => ({ unexpected: true }),
    },
  );
  assert.equal(malformed.source, "deterministic");
  assert.ok(malformed.warning);

  // Verify assertCandidatesUnmutated catches item/role/formula mutations explicitly
  const tagged = assignCandidateIds(candidates.slice(0, 2));
  const mutatedItem = assignCandidateIds(candidates.slice(0, 2));
  mutatedItem[0]!.items[0] = { ...mutatedItem[0]!.items[0]!, id: "tampered_item" };
  assert.throws(() => assertCandidatesUnmutated(tagged, mutatedItem), /mutated garment item IDs/);

  const mutatedRole = assignCandidateIds(candidates.slice(0, 2));
  mutatedRole[0]!.roles[0] = "outer";
  assert.throws(() => assertCandidatesUnmutated(tagged, mutatedRole), /mutated roles/);

  const mutatedFormula = assignCandidateIds(candidates.slice(0, 2));
  mutatedFormula[0]!.formula = "Dress";
  assert.throws(() => assertCandidatesUnmutated(tagged, mutatedFormula), /mutated formula/);
});

test("9. Missing, nonexistent, and corrupt garment images do not break contact-sheet generation", async () => {
  const wardrobe = await buildSampleWardrobe();
  const candidates = buildFiveCandidates(wardrobe).slice(0, 2);
  candidates[0]!.items[0] = { ...candidates[0]!.items[0]!, image: "" };
  candidates[0]!.items[1] = { ...candidates[0]!.items[1]!, image: "/cutouts/does-not-exist.png" };
  candidates[1]!.items[0] = { ...candidates[1]!.items[0]!, image: "data:image/png;base64,corrupt-image-bytes" };

  const tagged = assignCandidateIds(candidates);
  const sheet = await buildCandidateContactSheet(tagged);
  const buffer = Buffer.from(sheet.image.data, "base64");
  const meta = await sharp(buffer).metadata();

  assert.equal(sheet.image.mimeType, "image/jpeg");
  assert.equal(sheet.panels.length, 2);
  assert.equal(meta.format, "jpeg");
  assert.ok((meta.width ?? 0) > 400 && (meta.height ?? 0) > 400);
});

test("11. classifyCriticFailureWarning maps failures to safe user-facing messages", () => {
  const keyWarning = classifyCriticFailureWarning(
    new Error('Gemini (gemini-2.5-flash) 400: {"error":{"message":"API key not valid. Please pass a valid API key. sk-secret"}}'),
  );
  assert.equal(keyWarning, "Visual critic API key was rejected; using deterministic outfit ranking.");
  assert.ok(!keyWarning.includes("sk-secret"));

  const rateWarning = classifyCriticFailureWarning(new Error("Gemini (gemini-2.5-flash) 503: model overloaded"));
  assert.equal(rateWarning, "Visual critic is temporarily rate-limited or busy; using deterministic outfit ranking.");
  assert.ok(!rateWarning.includes("503"));

  const netWarning = classifyCriticFailureWarning(new Error("TypeError: fetch failed connecting to generativelanguage.googleapis.com"));
  assert.equal(netWarning, "Visual critic could not reach Gemini; using deterministic outfit ranking.");
  assert.ok(!netWarning.includes("googleapis.com"));

  const genericWarning = classifyCriticFailureWarning(new Error("Duplicate lookId: candidate_1"));
  assert.equal(genericWarning, "Visual critic unavailable; using deterministic outfit ranking.");
  assert.ok(!genericWarning.includes("candidate_1"));
});
