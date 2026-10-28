import assert from "node:assert/strict";
import test from "node:test";

import {
  inferLegacyGarmentSemantics,
  normalizeGarmentSemantics,
  scoreOutfit,
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

test("semantic loungewear and isolated accent footwear affect validity and ranking", () => {
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
  const redShoe = item({
    id: "red-shoe",
    slot: "shoe",
    title: "Item D",
    category: "shoe",
    color: "#d12626",
    palette: "warm",
    color_role: "accent",
    formality: 2,
  });
  const neutralShoe = item({
    id: "neutral-shoe",
    slot: "shoe",
    title: "Item E",
    category: "shoe",
    color: "#f3f1ec",
    formality: 2,
  });

  const invalid = validateOutfitCandidate("Simple", [shirt, loungeBottom], ["top", "bottom"]);
  assert.equal(invalid.valid, false);
  assert.ok(invalid.violations.includes("polished-shirt-with-lounge-bottom"));

  const preferences = { occasion: "casual" as const, gender: "men" as const, goal: "balanced" as const };
  assert.ok(scoreOutfit([shirt, trouser, neutralShoe], preferences).total > scoreOutfit([shirt, trouser, redShoe], preferences).total);
});
