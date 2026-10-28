import assert from "node:assert/strict";
import test from "node:test";

import { upperCollageLayout } from "./collage";

test("single upper layer is centered", () => {
  const [layer] = upperCollageLayout(1, 768, 1024);
  assert.ok(layer);
  assert.equal(layer.widthRatio, 0.88);
  assert.ok(Math.abs(layer.leftRatio - (1 - 0.88) / 2) < 1e-9);
});

test("layered layout keeps the base visible around a smaller offset outer", () => {
  const [base, outer] = upperCollageLayout(2, 768, 1024);
  assert.ok(base && outer);
  assert.ok(base.widthRatio > outer.widthRatio);
  assert.ok(outer.leftRatio > base.leftRatio);
  assert.ok(outer.topRatio > base.topRatio);
});

test("additional upper layers become progressively smaller and lower", () => {
  const [, mid, outer] = upperCollageLayout(3, 768, 1024);
  assert.ok(mid && outer);
  assert.ok(outer.widthRatio < mid.widthRatio);
  assert.ok(outer.leftRatio > mid.leftRatio);
  assert.ok(outer.topRatio > mid.topRatio);
});
