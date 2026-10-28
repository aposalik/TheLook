import assert from "node:assert/strict";
import test from "node:test";

import { partitionTryOnItems } from "./tryon-plan";
import type { Item } from "./recommend";

const base: Item = { id: "striped", slot: "innerwear", title: "Striped shirt", color: "#9ab7d1", palette: "cool", image: "", category: "upper", layer: "base" };
const outer: Item = { id: "bomber", slot: "outerwear", title: "Bomber", color: "#5d1f2d", palette: "warm", image: "", category: "upper", layer: "outer" };
const bottom: Item = { id: "trouser", slot: "bottom", title: "Trouser", color: "#888888", palette: "neutral", image: "", category: "bottom" };
const shoe: Item = { id: "shoe", slot: "shoe", title: "Shoe", color: "#ffffff", palette: "neutral", image: "", category: "shoe" };

test("try-on plan includes every selected clothing item and preserves upper layer order", () => {
  const plan = partitionTryOnItems([outer, shoe, bottom, base]);
  assert.deepEqual(plan.renderable.map((item) => item.id), ["bomber", "trouser", "striped"]);
  assert.deepEqual(plan.uppers.map((item) => item.id), ["striped", "bomber"]);
  assert.deepEqual(plan.styleOnly.map((item) => item.id), ["shoe"]);
  assert.equal(plan.bottom?.id, "trouser");
});
