import assert from "node:assert/strict";
import test from "node:test";

import { feedbackAdjustment, normalizeOutfitFeedback } from "./outfit-feedback";

const raw = [
  { id: "like-1", itemIds: ["shirt", "trouser", "shirt"], signal: "like", createdAt: 10 },
  { id: "dislike-1", itemIds: ["hoodie", "jogger"], signal: "dislike", createdAt: 20 },
  { id: "bad", itemIds: [], signal: "love", createdAt: "today" },
];

test("normalizes persisted outfit feedback", () => {
  assert.deepEqual(normalizeOutfitFeedback(raw), [
    { id: "like-1", itemIds: ["shirt", "trouser"], signal: "like", createdAt: 10 },
    { id: "dislike-1", itemIds: ["hoodie", "jogger"], signal: "dislike", createdAt: 20 },
  ]);
});

test("similar liked outfits raise personalization and disliked outfits lower it", () => {
  const feedback = normalizeOutfitFeedback(raw);
  assert.ok(feedbackAdjustment(["shirt", "trouser", "loafer"], feedback) > 0);
  assert.ok(feedbackAdjustment(["hoodie", "jogger", "sneaker"], feedback) < 0);
  assert.equal(feedbackAdjustment(["dress", "heel"], feedback), 0);
});

test("feedback adjustment is bounded", () => {
  const manyLikes = Array.from({ length: 100 }, (_, index) => ({
    id: `like-${index}`,
    itemIds: ["shirt", "trouser"],
    signal: "like" as const,
    createdAt: index,
  }));
  assert.ok(feedbackAdjustment(["shirt", "trouser"], manyLikes) <= 0.12);
});
