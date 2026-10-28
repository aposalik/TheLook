import fs from "node:fs";
import path from "node:path";

import fixturesData from "../data/recommendation-fixtures.json";
import { recommend, type Item, type Look, type StylePreferences } from "./recommend";

export type RecommendationFixtureExpectation = {
  minLooks: number;
  maxLooks: number;
  allLooksContain: string[];
  allowedFormulas: string[];
  requireUniqueItems: boolean;
};

export type RecommendationFixture = {
  id: string;
  description: string;
  anchors: string[];
  limit: number;
  preferences: StylePreferences;
  wardrobe: Item[];
  expect: RecommendationFixtureExpectation;
};

export type RecommendationFixtureSet = {
  schemaVersion: number;
  fixtures: RecommendationFixture[];
};

type EvaluationAssertion = {
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
};

type EvaluatedLook = {
  formula: string;
  itemIds: string[];
  score: number;
  cohesion: number;
};

export type FixtureEvaluation = {
  id: string;
  description: string;
  passed: boolean;
  lookCount: number;
  assertions: EvaluationAssertion[];
  looks: EvaluatedLook[];
};

export type RecommendationEvaluationReport = {
  schemaVersion: 1;
  generatedAt: string;
  summary: {
    fixtureCount: number;
    passedFixtures: number;
    failedFixtures: number;
    passRate: number;
  };
  fixtures: FixtureEvaluation[];
};

function assertion(name: string, passed: boolean, expected: string, actual: string): EvaluationAssertion {
  return { name, passed, expected, actual };
}

function summarizeLook(look: Look): EvaluatedLook {
  return {
    formula: look.formula,
    itemIds: look.items.map((item) => item.id),
    score: Number(look.score.toFixed(4)),
    cohesion: Number(look.cohesion.toFixed(4)),
  };
}

function evaluateFixture(fixture: RecommendationFixture): FixtureEvaluation {
  const looks = recommend(fixture.anchors, fixture.limit, {
    catalogItems: [],
    extraItems: fixture.wardrobe,
    preferences: fixture.preferences,
    candidateLimit: fixture.limit,
  });
  const wardrobeIds = new Set(fixture.wardrobe.map((item) => item.id));
  const assertions: EvaluationAssertion[] = [];

  assertions.push(assertion(
    "look-count",
    looks.length >= fixture.expect.minLooks && looks.length <= fixture.expect.maxLooks,
    `${fixture.expect.minLooks}..${fixture.expect.maxLooks}`,
    String(looks.length),
  ));

  const missingAnchors = looks.flatMap((look, index) =>
    fixture.expect.allLooksContain
      .filter((id) => !look.items.some((item) => item.id === id))
      .map((id) => `look ${index + 1}: ${id}`),
  );
  assertions.push(assertion(
    "required-items",
    missingAnchors.length === 0,
    fixture.expect.allLooksContain.length ? `every look contains ${fixture.expect.allLooksContain.join(", ")}` : "no required items",
    missingAnchors.length ? missingAnchors.join("; ") : "all required items present",
  ));

  const unexpectedFormulas = looks.map((look) => look.formula).filter((formula) => !fixture.expect.allowedFormulas.includes(formula));
  assertions.push(assertion(
    "allowed-formulas",
    unexpectedFormulas.length === 0,
    fixture.expect.allowedFormulas.length ? fixture.expect.allowedFormulas.join(", ") : "no looks",
    unexpectedFormulas.length ? unexpectedFormulas.join(", ") : looks.map((look) => look.formula).join(", ") || "no looks",
  ));

  const duplicateLooks = looks
    .map((look, index) => ({ index, ids: look.items.map((item) => item.id) }))
    .filter(({ ids }) => new Set(ids).size !== ids.length)
    .map(({ index }) => String(index + 1));
  assertions.push(assertion(
    "unique-items-per-look",
    !fixture.expect.requireUniqueItems || duplicateLooks.length === 0,
    "no duplicate garment IDs within a look",
    duplicateLooks.length ? `duplicates in looks ${duplicateLooks.join(", ")}` : "all item IDs unique",
  ));

  const foreignItems = looks.flatMap((look, index) =>
    look.items.filter((item) => !wardrobeIds.has(item.id)).map((item) => `look ${index + 1}: ${item.id}`),
  );
  assertions.push(assertion(
    "wardrobe-ownership",
    foreignItems.length === 0,
    "all recommended items belong to the fixture wardrobe",
    foreignItems.length ? foreignItems.join("; ") : "all items owned",
  ));

  const malformedLooks = looks
    .map((look, index) => ({ look, index }))
    .filter(({ look }) => look.items.length !== look.roles.length || !Number.isFinite(look.score) || !Number.isFinite(look.cohesion))
    .map(({ index }) => String(index + 1));
  assertions.push(assertion(
    "result-shape",
    malformedLooks.length === 0,
    "aligned roles/items and finite scores",
    malformedLooks.length ? `malformed looks ${malformedLooks.join(", ")}` : "all result shapes valid",
  ));

  return {
    id: fixture.id,
    description: fixture.description,
    passed: assertions.every((entry) => entry.passed),
    lookCount: looks.length,
    assertions,
    looks: looks.map(summarizeLook),
  };
}

export function evaluateRecommendationFixtures(input: unknown): RecommendationEvaluationReport {
  const fixtureSet = input as RecommendationFixtureSet;
  if (fixtureSet?.schemaVersion !== 1 || !Array.isArray(fixtureSet.fixtures)) {
    throw new Error("Unsupported recommendation fixture schema");
  }

  const fixtures = fixtureSet.fixtures.map(evaluateFixture);
  const passedFixtures = fixtures.filter((fixture) => fixture.passed).length;
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    summary: {
      fixtureCount: fixtures.length,
      passedFixtures,
      failedFixtures: fixtures.length - passedFixtures,
      passRate: fixtures.length ? Number((passedFixtures / fixtures.length).toFixed(4)) : 0,
    },
    fixtures,
  };
}

function formatConsoleSummary(report: RecommendationEvaluationReport): string {
  const lines = report.fixtures.map((fixture) => {
    const failed = fixture.assertions.filter((entry) => !entry.passed);
    const suffix = failed.length ? ` — ${failed.map((entry) => entry.name).join(", ")}` : "";
    return `${fixture.passed ? "PASS" : "FAIL"} ${fixture.id} (${fixture.lookCount} looks)${suffix}`;
  });
  lines.push(`\n${report.summary.passedFixtures}/${report.summary.fixtureCount} fixtures passed (${Math.round(report.summary.passRate * 100)}%)`);
  return lines.join("\n");
}

if (require.main === module) {
  const report = evaluateRecommendationFixtures(fixturesData);
  const webRoot = path.resolve(__dirname, "../..");
  const outputPath = path.join(webRoot, "reports", "recommendation-eval-report.json");
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(formatConsoleSummary(report));
  console.log(`Report: ${path.relative(webRoot, outputPath)}`);
  process.exitCode = report.summary.failedFixtures ? 1 : 0;
}
