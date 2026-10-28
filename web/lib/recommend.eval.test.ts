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

test("evaluation report is deterministic apart from its timestamp", () => {
  const first = evaluateRecommendationFixtures(fixturesData);
  const second = evaluateRecommendationFixtures(fixturesData);

  assert.deepEqual(
    { ...first, generatedAt: "ignored" },
    { ...second, generatedAt: "ignored" },
  );
});
