import assert from "node:assert/strict";
import test from "node:test";

import {
  buildReason,
  buildRollingRack,
  inferLegacyGarmentSemantics,
  normalizeGarmentSemantics,
  recommend,
  repairOutfitFromRack,
  validateOutfitCandidate,
  type Item,
} from "./recommend";

function item(overrides: Partial<Item> & Pick<Item, "id" | "slot" | "title" | "category">): Item {
  return {
    color: "#777777",
    palette: "neutral",
    image: "/fixture.png",
    formality: 2,
    fit: "regular",
    color_role: "neutral",
    gender: "men",
    ...overrides,
  };
}

test("normalizes rich garment semantics and discards unsupported values", () => {
  assert.deepEqual(normalizeGarmentSemantics({
    garmentType: "button-up-shirt",
    pattern: "stripe",
    patternScale: "fine",
    fabric: "cotton",
    fabricWeight: "light",
    collarType: "point",
    closure: "buttons",
    canWearOpen: true,
    layerRole: "base",
    silhouetteVolume: "medium",
    length: "regular",
    isLoungewear: false,
    isSubstantialLayer: false,
    inferenceConfidence: "high",
    unexpected: "ignored",
  }), {
    garmentType: "button-up-shirt",
    pattern: "stripe",
    patternScale: "fine",
    fabric: "cotton",
    fabricWeight: "light",
    collarType: "point",
    closure: "buttons",
    canWearOpen: true,
    layerRole: "base",
    silhouetteVolume: "medium",
    length: "regular",
    isLoungewear: false,
    isSubstantialLayer: false,
    inferenceConfidence: "high",
  });

  assert.deepEqual(normalizeGarmentSemantics({
    garmentType: "spacesuit",
    pattern: "laser",
    canWearOpen: "yes",
  }), {});
});

test("infers conservative semantics for legacy wardrobe records", () => {
  const inferred = inferLegacyGarmentSemantics(item({
    id: "legacy",
    slot: "top",
    title: "Blue striped cotton button-up shirt",
    category: "upper",
    layer: "base",
    material: "cotton",
    fit: "regular",
    formality: 3,
  }));

  assert.equal(inferred.garmentType, "button-up-shirt");
  assert.equal(inferred.pattern, "stripe");
  assert.equal(inferred.fabric, "cotton");
  assert.equal(inferred.collarType, "point");
  assert.equal(inferred.layerRole, "base");
  assert.equal(inferred.isSubstantialLayer, false);

  const knit = inferLegacyGarmentSemantics(item({
    id: "legacy-knit",
    slot: "top",
    title: "Medium-weight cable knit V-neck sweater",
    category: "upper",
    layer: "mid",
  }));
  assert.equal(knit.garmentType, "sweater");
  assert.equal(knit.collarType, "v-neck");
  assert.equal(knit.closure, "pullover");
  assert.equal(knit.fabric, "knit");
});

test("rejects two lightweight collared shirts using semantics rather than title keywords", () => {
  const base = item({
    id: "base",
    slot: "top",
    slots: ["top"],
    title: "Item A",
    category: "upper",
    layer: "base",
    semantics: {
      garmentType: "button-up-shirt",
      collarType: "point",
      fabricWeight: "light",
      layerRole: "base",
      isSubstantialLayer: false,
    },
  });
  const layer = item({
    id: "layer",
    slot: "top",
    slots: ["top", "outerwear"],
    title: "Item B",
    category: "upper",
    layer: "mid",
    semantics: {
      garmentType: "button-up-shirt",
      collarType: "camp",
      fabricWeight: "light",
      layerRole: "mid",
      canWearOpen: true,
      isSubstantialLayer: false,
    },
  });
  const bottom = item({ id: "bottom", slot: "bottom", title: "Item C", category: "bottom" });

  const result = validateOutfitCandidate("Layered", [base, layer, bottom], ["base", "overshirt", "bottom"]);
  assert.equal(result.valid, false);
  assert.ok(result.violations.includes("competing-collared-shirts"));
});

test("allows a collared base beneath a substantial open overshirt", () => {
  const base = item({
    id: "base",
    slot: "top",
    slots: ["top"],
    title: "Item A",
    category: "upper",
    layer: "base",
    semantics: { garmentType: "button-up-shirt", collarType: "point", fabricWeight: "light", layerRole: "base" },
  });
  const layer = item({
    id: "layer",
    slot: "top",
    slots: ["top", "outerwear"],
    title: "Item B",
    category: "upper",
    layer: "mid",
    semantics: {
      garmentType: "overshirt",
      collarType: "point",
      fabricWeight: "heavy",
      layerRole: "mid",
      canWearOpen: true,
      isSubstantialLayer: true,
    },
  });
  const bottom = item({ id: "bottom", slot: "bottom", title: "Item C", category: "bottom" });

  assert.equal(
    validateOutfitCandidate("Layered", [base, layer, bottom], ["base", "overshirt", "bottom"]).valid,
    true,
  );
});

test("semantic loungewear blocks invalid pairings and repairOutfitFromRack swaps offending slots", () => {
  const shirt = item({
    id: "shirt",
    slot: "top",
    title: "Item A",
    category: "upper",
    layer: "base",
    formality: 3,
    semantics: { garmentType: "button-up-shirt", collarType: "point", layerRole: "base" },
  });
  const loungeBottom = item({
    id: "lounge",
    slot: "bottom",
    title: "Item B",
    category: "bottom",
    formality: 1,
    semantics: { garmentType: "sweatpants", isLoungewear: true, silhouetteVolume: "high" },
  });
  const trouser = item({ id: "trouser", slot: "bottom", title: "Item C", category: "bottom", formality: 2 });

  const invalid = validateOutfitCandidate("Simple", [shirt, loungeBottom], ["top", "bottom"]);
  assert.equal(invalid.valid, false);
  assert.ok(invalid.violations.includes("polished-shirt-with-lounge-bottom"));

  const rack = buildRollingRack({
    catalogItems: [shirt, loungeBottom, trouser],
    anchorIds: ["shirt"],
    preferences: { occasion: "casual", gender: "men", goal: "balanced" },
  });
  const repaired = repairOutfitFromRack("Simple", [shirt, loungeBottom], ["top", "bottom"], rack, ["shirt"]);
  assert.ok(repaired, "repairOutfitFromRack should swap loungeBottom for trouser");
  assert.equal(repaired?.items[1]?.id, "trouser");
});

test("allows a collared shirt beneath a medium-weight v-neck knit", () => {
  const shirt = item({
    id: "striped-shirt",
    slot: "top",
    title: "Striped button-up",
    category: "upper",
    layer: "base",
    formality: 3,
    semantics: {
      garmentType: "button-up-shirt",
      pattern: "stripe",
      collarType: "point",
      fabricWeight: "light",
      layerRole: "base",
      silhouetteVolume: "medium",
    },
  });
  const sweater = item({
    id: "v-neck-knit",
    slot: "top",
    slots: ["top", "outerwear"],
    title: "Cable-knit V-neck sweater",
    category: "upper",
    layer: "mid",
    formality: 3,
    semantics: {
      garmentType: "sweater",
      fabric: "knit",
      fabricWeight: "medium",
      collarType: "v-neck",
      closure: "pullover",
      layerRole: "mid",
      silhouetteVolume: "medium",
      isSubstantialLayer: true,
    },
  });
  const trousers = item({ id: "trousers", slot: "bottom", title: "Pleated trousers", category: "bottom", formality: 3 });

  const result = validateOutfitCandidate("Layered", [shirt, sweater, trousers], ["base", "overshirt", "bottom"]);
  assert.equal(result.valid, true, result.violations.join(", "));

  const preferences = { occasion: "work" as const, gender: "men" as const, goal: "balanced" as const };
  assert.match(
    buildReason("Layered", [shirt, sweater, trousers], ["base", "overshirt", "bottom"], preferences),
    /V-neck frames the shirt collar/i,
  );
});

test("rejects a hoodie beneath a pullover knit", () => {
  const hoodie = item({
    id: "hoodie",
    slot: "top",
    title: "Embroidered bear hoodie",
    category: "upper",
    layer: "base",
    semantics: {
      garmentType: "hoodie",
      collarType: "hood",
      fabric: "fleece",
      fabricWeight: "heavy",
      layerRole: "base",
      silhouetteVolume: "high",
      isLoungewear: true,
    },
  });
  const sweater = item({
    id: "sweater",
    slot: "top",
    slots: ["top", "outerwear"],
    title: "Cable-knit V-neck sweater",
    category: "upper",
    layer: "mid",
    semantics: {
      garmentType: "sweater",
      collarType: "v-neck",
      closure: "pullover",
      fabric: "knit",
      fabricWeight: "medium",
      layerRole: "mid",
      silhouetteVolume: "medium",
    },
  });
  const trousers = item({ id: "trousers", slot: "bottom", title: "Pleated trousers", category: "bottom" });

  const result = validateOutfitCandidate("Layered", [hoodie, sweater, trousers], ["base", "overshirt", "bottom"]);
  assert.equal(result.valid, false);
  assert.ok(result.violations.includes("hood-under-pullover-layer"));
  assert.ok(result.violations.includes("bulky-base-under-lighter-layer"));
});

test("keeps a normal mid-tagged button-up available as a standalone top", () => {
  const shirt = item({
    id: "catalog-shirt",
    slot: "top",
    title: "Shirt Blue",
    category: "upper",
    layer: "mid",
    formality: 3,
  });
  const trousers = item({ id: "catalog-trousers", slot: "bottom", title: "Trousers", category: "bottom" });
  const looks = recommend("catalog-shirt", 3, {
    catalogItems: [shirt, trousers],
    preferences: { gender: "all" },
  });
  assert.ok(looks.length > 0, "a normal button-up should not produce an empty recommendation set");
  assert.ok(looks.some((look) => look.formula === "Simple"));
});

test("uses the anchored garment gender when the unfiltered catalog mixes demo genders", () => {
  const shirt = item({ id: "mens-shirt", slot: "top", title: "Shirt Blue", category: "upper", layer: "base", gender: "men" });
  const trousers = item({ id: "mens-trousers", slot: "bottom", title: "Trousers", category: "bottom", gender: "men" });
  const womensShoe = item({ id: "womens-shoe", slot: "shoe", title: "Red Sneaker", category: "shoe", gender: "women" });
  const looks = recommend("mens-shirt", 3, { catalogItems: [shirt, trousers, womensShoe], preferences: { gender: "all" } });
  assert.ok(looks.length > 0);
  assert.ok(looks.every((look) => look.items.every((garment) => !garment.gender || garment.gender === "men")));
});

test("validates three-layer outfits (base + overshirt + outer + bottom) and blocks invalid middle layers", () => {
  const tee = item({
    id: "base-tee",
    slot: "top",
    slots: ["innerwear", "top"],
    title: "White Tee",
    category: "upper",
    layer: "base",
    semantics: { garmentType: "t-shirt", collarType: "crew", fabricWeight: "light", layerRole: "base" },
  });
  const cardigan = item({
    id: "mid-cardigan",
    slot: "top",
    slots: ["top", "outerwear"],
    title: "Merino Cardigan",
    category: "upper",
    layer: "mid",
    semantics: { garmentType: "cardigan", fabricWeight: "medium", layerRole: "mid", canWearOpen: true, isSubstantialLayer: true },
  });
  const coat = item({
    id: "outer-coat",
    slot: "outerwear",
    slots: ["outerwear"],
    title: "Wool Overcoat",
    category: "upper",
    layer: "outer",
    semantics: { garmentType: "coat", fabricWeight: "heavy", layerRole: "outer", canWearOpen: true, isSubstantialLayer: true },
  });
  const trouser = item({ id: "trouser", slot: "bottom", title: "Tailored Trouser", category: "bottom" });

  const validThreeLayer = validateOutfitCandidate(
    "Three layer",
    [tee, cardigan, coat, trouser],
    ["base", "overshirt", "outer", "bottom"],
  );
  assert.equal(validThreeLayer.valid, true, validThreeLayer.violations.join(", "));
});

test("buildRollingRack pins anchors and penalizes recentlyUsedItemIds for rotation", () => {
  const tops = Array.from({ length: 8 }, (_, idx) =>
    item({
      id: `top-${idx + 1}`,
      slot: "top",
      title: `Tee ${idx + 1}`,
      category: "upper",
      layer: "base",
      palette: idx % 2 === 0 ? "neutral" : "cool",
    }),
  );
  const bottom = item({ id: "bottom-1", slot: "bottom", title: "Jeans", category: "bottom" });
  const rack1 = buildRollingRack({
    catalogItems: [...tops, bottom],
    anchorIds: ["top-1"],
    seed: 1,
  });
  assert.ok(rack1.items.some((i) => i.id === "top-1"), "anchored top must always be on the rack");

  const firstRackNonAnchorTops = rack1.byRole.solo.filter((i) => i.id !== "top-1").map((i) => i.id);
  const rack2 = buildRollingRack({
    catalogItems: [...tops, bottom],
    anchorIds: ["top-1"],
    recentlyUsedItemIds: firstRackNonAnchorTops,
    seed: 2,
  });
  assert.ok(rack2.items.some((i) => i.id === "top-1"), "anchored top remains pinned on rotated rack");
  const secondRackTops = rack2.byRole.solo.map((i) => i.id);
  assert.notDeepEqual(secondRackTops, rack1.byRole.solo.map((i) => i.id), "rack should rotate non-anchor tops when recentlyUsedItemIds are supplied");
});

test("rejects Navy Blue Embroidered Bear Hoodie underneath a Pink Cotton Overshirt", () => {
  const bearHoodie = item({
    id: "bear-hoodie",
    slot: "top",
    title: "Navy Blue Embroidered Bear Hoodie",
    category: "upper",
    layer: "base",
    fit: "relaxed",
  });
  bearHoodie.semantics = inferLegacyGarmentSemantics(bearHoodie);
  assert.equal(bearHoodie.semantics.garmentType, "hoodie");
  assert.equal(bearHoodie.semantics.fabricWeight, "heavy");
  assert.equal(bearHoodie.semantics.pattern, "graphic");

  const pinkOvershirt = item({
    id: "pink-overshirt",
    slot: "top",
    slots: ["top", "outerwear"],
    title: "Men's Pink Long Sleeve Cotton Overshirt",
    category: "upper",
    layer: "mid",
    fit: "relaxed",
  });
  pinkOvershirt.semantics = inferLegacyGarmentSemantics(pinkOvershirt);

  const baggyJeans = item({
    id: "baggy-jeans",
    slot: "bottom",
    title: "Baggy Jeans",
    category: "bottom",
    fit: "baggy",
  });

  const check = validateOutfitCandidate(
    "Layered",
    [bearHoodie, pinkOvershirt, baggyJeans],
    ["base", "overshirt", "bottom"],
  );
  assert.equal(check.valid, false);
  assert.ok(check.violations.includes("hoodie-under-shirt-or-overshirt"));
  assert.ok(check.violations.includes("bulky-base-under-lighter-layer"));

  const looks = recommend("bear-hoodie", 3, {
    catalogItems: [bearHoodie, pinkOvershirt, baggyJeans],
  });
  assert.ok(looks.length > 0);
  assert.ok(
    looks.every((look) => !look.items.some((it) => it.id === "pink-overshirt")),
    "recommend() must never layer a cotton overshirt over an anchored hoodie",
  );
});
