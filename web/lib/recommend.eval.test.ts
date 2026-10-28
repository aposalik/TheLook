import assert from "node:assert/strict";
import test from "node:test";

import fixturesData from "../data/recommendation-fixtures.json";
import { evaluateRecommendationFixtures } from "./recommend.eval";

test("evaluation fixtures produce a complete, passing report", () => {
  const report = evaluateRecommendationFixtures(fixturesData);

  assert.equal(report.schemaVersion, 1);
  assert.equal(report.summary.fixtureCount, fixturesData.fixtures.length);
  assert.equal(report.summary.failedFixtures, 0);
  assert.equal(report.summary.passedFixtures, fixturesData.fixtures.length);
  assert.equal(report.summary.passRate, 1);
  assert.ok(report.fixtures.every((fixture) => fixture.assertions.length > 0));
});

test("every generated look exposes a bounded named score breakdown", () => {
  const report = evaluateRecommendationFixtures(fixturesData);
  const looks = report.fixtures.flatMap((fixture) => fixture.looks);
  const expectedComponents = ["compatibility", "palette", "silhouette", "formality", "style", "footwear", "preference", "total"];

  assert.ok(looks.length > 0);
  for (const look of looks) {
    assert.deepEqual(Object.keys(look.scoreBreakdown), expectedComponents);
    for (const [name, value] of Object.entries(look.scoreBreakdown)) {
      assert.ok(value >= 0 && value <= 1, `${name} must be between 0 and 1, received ${value}`);
    }
    assert.equal(look.score, look.scoreBreakdown.total);
  }
});

test("diverse capsule returns safe, balanced, and expressive archetypes", () => {
  const report = evaluateRecommendationFixtures(fixturesData);
  const fixture = report.fixtures.find((entry) => entry.id === "casual-diverse-capsule");

  assert.ok(fixture);
  assert.deepEqual(new Set(fixture.looks.map((look) => look.selectionMode)), new Set(["safe", "balanced", "expressive"]));
  assert.ok(new Set(fixture.looks.map((look) => look.archetype)).size >= 3);
});

test("evaluation report is deterministic apart from its timestamp", () => {
  const first = evaluateRecommendationFixtures(fixturesData);
  const second = evaluateRecommendationFixtures(fixturesData);

  assert.deepEqual(
    { ...first, generatedAt: "ignored" },
    { ...second, generatedAt: "ignored" },
  );
});
