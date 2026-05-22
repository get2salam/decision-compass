import { test } from "node:test";
import assert from "node:assert/strict";

import {
  assessCoverage,
  buildRecommendation,
  scoreDecisionQuality,
} from "../js/agent.js";
import { requiresEscalation, requiresAudit, getThresholds } from "../js/thresholds.js";

const CRITERIA = [
  { id: "c1", label: "Salary", weight: 9 },
  { id: "c2", label: "Culture", weight: 5 },
];
const OPTIONS = [
  { id: "o1", name: "Startup", note: "" },
  { id: "o2", name: "BigCo", note: "" },
];
const FULL_STATE = {
  criteria: CRITERIA,
  options: OPTIONS,
  scores: { o1: { c1: 7, c2: 9 }, o2: { c1: 8, c2: 5 } },
};

test("assessCoverage returns 1 when all score cells are filled", () => {
  assert.equal(assessCoverage(FULL_STATE), 1);
});

test("assessCoverage returns 0 for an empty state", () => {
  assert.equal(assessCoverage({ criteria: [], options: [], scores: {} }), 0);
});

test("assessCoverage returns a fractional value for a partially-scored matrix", () => {
  const partial = { ...FULL_STATE, scores: { o1: { c1: 7 }, o2: {} } };
  assert.equal(assessCoverage(partial), 0.25);
});

test("scoreDecisionQuality returns a value in the 0-100 range", () => {
  const q = scoreDecisionQuality(FULL_STATE);
  assert.ok(q >= 0 && q <= 100, `quality ${q} out of range`);
});

test("scoreDecisionQuality returns 0 for an empty state", () => {
  assert.equal(scoreDecisionQuality({ criteria: [], options: [], scores: {} }), 0);
});

test("scoreDecisionQuality scores higher when criterion weights are diverse", () => {
  const uniform = {
    ...FULL_STATE,
    criteria: [
      { id: "c1", label: "A", weight: 5 },
      { id: "c2", label: "B", weight: 5 },
    ],
  };
  assert.ok(scoreDecisionQuality(FULL_STATE) >= scoreDecisionQuality(uniform));
});

test("buildRecommendation returns a ready recommendation for a well-formed state", () => {
  const r = buildRecommendation(FULL_STATE);
  assert.equal(r.recommendation, "Startup");
  assert.equal(r.ready, true);
  assert.ok(r.reasoning.length >= 4);
  assert.ok(typeof r.confidence === "number");
  assert.ok(typeof r.quality === "number");
});

test("buildRecommendation sets ready=false and recommendation=null when no criteria exist", () => {
  const r = buildRecommendation({ ...FULL_STATE, criteria: [] });
  assert.equal(r.ready, false);
  assert.equal(r.recommendation, null);
});

test("buildRecommendation sets ready=false when matrix coverage is below 80%", () => {
  const sparse = { ...FULL_STATE, scores: { o1: { c1: 7 }, o2: {} } };
  assert.equal(buildRecommendation(sparse).ready, false);
});

test("buildRecommendation reasoning steps mention the highest-weight criterion label", () => {
  assert.ok(buildRecommendation(FULL_STATE).reasoning.some((s) => s.includes("Salary")));
});

test("requiresEscalation returns true when coverage is critically low", () => {
  const rec = { confidence: 60, quality: 50, coverage: 0.4 };
  assert.equal(requiresEscalation(rec), true);
});

test("requiresEscalation returns true when confidence is critically low", () => {
  const rec = { confidence: 20, quality: 50, coverage: 0.8 };
  assert.equal(requiresEscalation(rec), true);
});

test("requiresEscalation returns false for a high-quality recommendation", () => {
  const rec = { confidence: 75, quality: 80, coverage: 0.9 };
  assert.equal(requiresEscalation(rec), false);
});

test("requiresAudit returns true for borderline confidence", () => {
  const rec = { confidence: 55, quality: 60, coverage: 0.85 };
  assert.equal(requiresAudit(rec), true);
});

test("requiresAudit returns true when coverage is low but not critical", () => {
  const rec = { confidence: 60, quality: 70, coverage: 0.7 };
  assert.equal(requiresAudit(rec), true);
});

test("requiresAudit returns false for high-confidence recommendations", () => {
  const rec = { confidence: 80, quality: 85, coverage: 0.95 };
  assert.equal(requiresAudit(rec), false);
});

test("getThresholds returns configuration object with all threshold values", () => {
  const thresholds = getThresholds();
  assert.ok(thresholds.COVERAGE_CRITICAL);
  assert.ok(thresholds.CONFIDENCE_CRITICAL);
  assert.equal(typeof thresholds.COVERAGE_LOW, "number");
});

