import assert from "node:assert/strict";
import test from "node:test";

import { normalizeWardrobeAnalysis } from "./wardrobe-analysis";

test("normalizes AI wardrobe analysis including rich semantics", () => {
  const analysis = normalizeWardrobeAnalysis({
    title: "  Blue striped shirt  ",
    category: "upper",
    subcategory: "button-up shirt",
    layer: "base",
    roles: ["top", "unknown", "top"],
    dominantColor: "#A8C3D8",
    palette: "cool",
    colorRole: "neutral",
    fit: "regular",
    formality: 3.2,
    gender: "men",
    seasons: ["spring", "autumn", "winter", "summer", "ignored"],
    styles: ["smart-casual", "minimal"],
    material: "cotton",
    description: "A lightweight striped cotton button-up.",
    semantics: {
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
    },
  }, "tops", "Upload");

  assert.equal(analysis.title, "Blue striped shirt");
  assert.deepEqual(analysis.roles, ["top"]);
  assert.equal(analysis.formality, 3);
  assert.deepEqual(analysis.seasons, ["spring", "autumn", "winter", "summer"]);
  assert.equal(analysis.semantics.garmentType, "button-up-shirt");
  assert.equal(analysis.semantics.canWearOpen, true);
});

test("falls back safely and aligns upper role semantics", () => {
  const analysis = normalizeWardrobeAnalysis({
    category: "spacesuit",
    roles: ["invented"],
    layer: "floating",
    dominantColor: "blue",
    fit: "giant",
    semantics: {
      garmentType: "invalid",
      layerRole: "outer",
      canWearOpen: "yes",
    },
  }, "tops", "Fallback shirt");

  assert.equal(analysis.category, "upper");
  assert.equal(analysis.layer, "outer");
  assert.deepEqual(analysis.roles, ["outerwear"]);
  assert.equal(analysis.dominantColor, "#8A8480");
  assert.deepEqual(analysis.semantics, { layerRole: "outer" });
});

test("non-upper garments cannot retain upper layer roles", () => {
  const analysis = normalizeWardrobeAnalysis({
    title: "Grey sweatpants",
    category: "bottom",
    layer: "outer",
    roles: ["outerwear", "bottom"],
    semantics: {
      garmentType: "sweatpants",
      layerRole: "outer",
      isLoungewear: true,
      silhouetteVolume: "high",
    },
  }, "bottoms", "Bottom");

  assert.equal(analysis.layer, null);
  assert.deepEqual(analysis.roles, ["bottom"]);
  assert.equal(analysis.semantics.layerRole, undefined);
  assert.equal(analysis.semantics.isLoungewear, true);
});
