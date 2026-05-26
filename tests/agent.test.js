import { test } from "node:test";
import assert from "node:assert/strict";

import {
  assessCoverage,
  buildRecommendation,
  planNextSteps,
  scoreDecisionQuality,
} from "../js/agent.js";
import {
  requiresEscalation,
  requiresAudit,
  getThresholds,
  summarizeRecommendation,
} from "../js/thresholds.js";

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

test("buildRecommendation exposes coverage so it can be piped into threshold checks", () => {
  const r = buildRecommendation(FULL_STATE);
  assert.equal(r.coverage, 1);
  const empty = buildRecommendation({ criteria: [], options: [], scores: {} });
  assert.equal(empty.coverage, 0);
});

test("buildRecommendation output flows cleanly into requiresEscalation/requiresAudit", () => {
  // Regression: previously buildRecommendation omitted `coverage`, so threshold
  // checks defaulted it to 0 and always escalated even for ready recommendations.
  const ready = buildRecommendation(FULL_STATE);
  assert.equal(requiresEscalation(ready), false);
  const sparse = buildRecommendation({ ...FULL_STATE, scores: { o1: { c1: 7 }, o2: {} } });
  assert.equal(requiresEscalation(sparse), true);
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

test("planNextSteps returns empty array when all cells are filled", () => {
  assert.deepEqual(planNextSteps(FULL_STATE), []);
});

test("planNextSteps returns empty array for a state with no criteria or options", () => {
  assert.deepEqual(planNextSteps({ criteria: [], options: [], scores: {} }), []);
});

test("planNextSteps returns one step per missing cell", () => {
  const partial = { ...FULL_STATE, scores: { o1: { c1: 7 }, o2: {} } };
  assert.equal(planNextSteps(partial).length, 3);
});

test("planNextSteps orders steps by descending criterion weight", () => {
  const steps = planNextSteps({ ...FULL_STATE, scores: {} });
  for (let i = 1; i < steps.length; i++) {
    assert.ok(steps[i - 1].weight >= steps[i].weight, "steps not sorted by weight");
  }
});

test("planNextSteps step objects include all required orchestration fields", () => {
  const [step] = planNextSteps({ ...FULL_STATE, scores: { o1: {}, o2: {} } });
  for (const field of ["optionId", "optionName", "criterionId", "criterionLabel", "weight", "rationale"]) {
    assert.ok(field in step, `missing field: ${field}`);
  }
});

test("planNextSteps treats a score of 0 as filled, not empty", () => {
  const withZero = { ...FULL_STATE, scores: { o1: { c1: 0, c2: 0 }, o2: { c1: 0, c2: 0 } } };
  assert.deepEqual(planNextSteps(withZero), []);
});

test("summarizeRecommendation returns status=escalate when coverage is critically low", () => {
  const summary = summarizeRecommendation({ confidence: 60, quality: 60, coverage: 0.3 });
  assert.equal(summary.status, "escalate");
  assert.match(summary.reason, /coverage/);
});

test("summarizeRecommendation returns status=audit for borderline confidence", () => {
  const summary = summarizeRecommendation({ confidence: 55, quality: 60, coverage: 0.85 });
  assert.equal(summary.status, "audit");
});

test("summarizeRecommendation returns status=ready for a high-quality recommendation", () => {
  const summary = summarizeRecommendation({ confidence: 80, quality: 85, coverage: 0.95 });
  assert.equal(summary.status, "ready");
  assert.equal(summary.label, "Ready to act");
});

test("summarizeRecommendation flows cleanly from buildRecommendation output", () => {
  const summary = summarizeRecommendation(buildRecommendation(FULL_STATE));
  assert.ok(["ready", "audit", "escalate"].includes(summary.status));
  assert.equal(typeof summary.reason, "string");
});

test("getThresholds returns configuration object with all threshold values", () => {
  const thresholds = getThresholds();
  assert.ok(thresholds.COVERAGE_CRITICAL);
  assert.ok(thresholds.CONFIDENCE_CRITICAL);
  assert.equal(typeof thresholds.COVERAGE_LOW, "number");
});

