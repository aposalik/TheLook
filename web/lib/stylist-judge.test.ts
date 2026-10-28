import assert from "node:assert/strict";
import test from "node:test";

import { assertAvailableSwapRoles, parseStylistJudgment, rankJudgedCandidates } from "./stylist-judge";

const rawJudgment = {
  judgments: [
    {
      lookId: "look_2",
      rank: 1,
      verdict: "strong",
      visualScores: { palette: 0.92, silhouette: 0.88, layering: 0.9, occasion: 0.86 },
      issues: [],
      preferredSwapRole: "none",
      title: "Relaxed Utility",
      reason: "The visible layers and proportions are coherent.",
    },
    {
      lookId: "look_1",
      rank: 2,
      verdict: "acceptable",
      visualScores: { palette: 0.78, silhouette: 0.74, layering: 0.8, occasion: 0.82 },
      issues: ["The shoe has slightly more visual weight than the trouser."],
      preferredSwapRole: "shoes",
      title: "Clean Casual",
      reason: "The palette works, but a lighter shoe would improve balance.",
    },
    {
      lookId: "look_3",
      rank: 3,
      verdict: "reject",
      visualScores: { palette: 0.45, silhouette: 0.3, layering: 0.6, occasion: 0.5 },
      issues: ["The top and bottom volumes compete."],
      preferredSwapRole: "bottom",
      title: "Competing Volume",
      reason: "The silhouette is not resolved enough to recommend.",
    }
  ]
};

test("validates a complete structured judgment", () => {
  const judgment = parseStylistJudgment(rawJudgment, ["look_1", "look_2", "look_3"]);

  assert.equal(judgment.judgments.length, 3);
  assert.deepEqual(judgment.judgments.map((entry) => entry.rank), [1, 2, 3]);
});

test("rejects unknown, duplicate, incomplete, or out-of-range judgments", () => {
  const invalidCases = [
    { ...rawJudgment, judgments: rawJudgment.judgments.map((entry, index) => index === 0 ? { ...entry, lookId: "invented" } : entry) },
    { ...rawJudgment, judgments: rawJudgment.judgments.map((entry, index) => index === 1 ? { ...entry, lookId: "look_2" } : entry) },
    { ...rawJudgment, judgments: rawJudgment.judgments.slice(0, 2) },
    { ...rawJudgment, judgments: rawJudgment.judgments.map((entry, index) => index === 0 ? { ...entry, visualScores: { ...entry.visualScores, palette: 1.4 } } : entry) },
    { ...rawJudgment, judgments: rawJudgment.judgments.map((entry, index) => index === 0 ? { ...entry, preferredSwapRole: "invent-a-hat" } : entry) },
  ];

  for (const invalid of invalidCases) {
    assert.throws(() => parseStylistJudgment(invalid, ["look_1", "look_2", "look_3"]));
  }
});

test("rejects a swap role that is not present in its candidate", () => {
  const judgment = parseStylistJudgment(rawJudgment, ["look_1", "look_2", "look_3"]);
  const candidates = [
    { lookId: "look_1", roles: ["top", "bottom"] },
    { lookId: "look_2", roles: ["base", "overshirt", "bottom"] },
    { lookId: "look_3", roles: ["top", "shoes"] },
  ];

  assert.throws(() => assertAvailableSwapRoles(candidates, judgment), /unavailable role shoes for look_1/);
});

test("ranks accepted candidates without changing their item sets", () => {
  const candidates = [
    { lookId: "look_1", items: [{ id: "tee" }, { id: "jean" }] },
    { lookId: "look_2", items: [{ id: "shirt" }, { id: "trouser" }] },
    { lookId: "look_3", items: [{ id: "knit" }, { id: "cargo" }] },
  ];
  const judgment = parseStylistJudgment(rawJudgment, candidates.map((candidate) => candidate.lookId));
  const ranked = rankJudgedCandidates(candidates, judgment);

  assert.deepEqual(ranked.map((candidate) => candidate.lookId), ["look_2", "look_1"]);
  assert.deepEqual(ranked[0]!.items, candidates[1]!.items);
  assert.equal(ranked[1]!.preferredSwapRole, "shoes");
  assert.equal(ranked.some((candidate) => candidate.lookId === "look_3"), false);
});
