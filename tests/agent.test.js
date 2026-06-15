import { test } from "node:test";
import assert from "node:assert/strict";

import {
  assessCoverage,
  buildRecommendation,
  coverageBreakdown,
  findCloseContenders,
  findCriterionLeader,
  findWeakestCoverage,
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

test("buildRecommendation refuses to recommend when there is only one option", () => {
  const solo = {
    ...FULL_STATE,
    options: [{ id: "o1", name: "Startup", note: "" }],
    scores: { o1: { c1: 10, c2: 10 } },
  };
  const r = buildRecommendation(solo);
  assert.equal(r.ready, false);
  assert.equal(r.recommendation, null);
  assert.equal(r.confidence, 0);
  assert.equal(r.coverage, 1);
  assert.ok(
    r.reasoning.some((step) => step.includes("at least two options")),
    "reasoning should explain that comparison requires another option",
  );
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

test("buildRecommendation refuses to recommend a winner when leader and runner-up are tied on weighted score", () => {
  // Regression: selectRankedOptions breaks weighted-score ties alphabetically by
  // option name, so previously the agent would confidently surface the first
  // option as a "recommendation" even though the ranking was arbitrary.
  const tied = {
    ...FULL_STATE,
    options: [
      { id: "o1", name: "Alpha", note: "" },
      { id: "o2", name: "Bravo", note: "" },
    ],
    scores: { o1: { c1: 7, c2: 7 }, o2: { c1: 7, c2: 7 } },
  };
  const r = buildRecommendation(tied);
  assert.equal(r.ready, false);
  assert.equal(r.recommendation, null);
  assert.ok(
    r.reasoning.some((s) => s.includes("tied")),
    "reasoning should mention the tie so the UI can explain it",
  );
});

test("buildRecommendation still recommends when the leader is ahead by even a sliver", () => {
  // Pair to the tied-leader regression: a non-zero gap should still flow
  // through to a ready recommendation so we don't over-correct.
  const slim = {
    ...FULL_STATE,
    options: [
      { id: "o1", name: "Alpha", note: "" },
      { id: "o2", name: "Bravo", note: "" },
    ],
    scores: { o1: { c1: 7, c2: 8 }, o2: { c1: 7, c2: 7 } },
  };
  const r = buildRecommendation(slim);
  assert.equal(r.ready, true);
  assert.equal(r.recommendation, "Alpha");
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

test("planNextSteps respects limit and keeps the highest-weight gaps", () => {
  const empty = { ...FULL_STATE, scores: {} };
  const top = planNextSteps(empty, { limit: 2 });
  assert.equal(top.length, 2);
  assert.ok(top.every((step) => step.criterionId === "c1"));
});

test("planNextSteps with limit=0 returns an empty list", () => {
  assert.deepEqual(planNextSteps({ ...FULL_STATE, scores: {} }, { limit: 0 }), []);
});

test("planNextSteps with a limit larger than the backlog returns every gap", () => {
  const partial = { ...FULL_STATE, scores: { o1: { c1: 7 }, o2: {} } };
  assert.equal(planNextSteps(partial, { limit: 99 }).length, 3);
});

test("planNextSteps scoped to optionId returns only that option's gaps", () => {
  const empty = { ...FULL_STATE, scores: {} };
  const steps = planNextSteps(empty, { optionId: "o2" });
  assert.equal(steps.length, 2);
  assert.ok(steps.every((step) => step.optionId === "o2"));
});

test("planNextSteps scoped to criterionId returns only that criterion's gaps", () => {
  const empty = { ...FULL_STATE, scores: {} };
  const steps = planNextSteps(empty, { criterionId: "c2" });
  assert.equal(steps.length, 2);
  assert.ok(steps.every((step) => step.criterionId === "c2"));
});

test("planNextSteps combines optionId, criterionId, and limit filters", () => {
  const empty = { ...FULL_STATE, scores: {} };
  const steps = planNextSteps(empty, { optionId: "o1", criterionId: "c1", limit: 5 });
  assert.equal(steps.length, 1);
  assert.equal(steps[0].optionId, "o1");
  assert.equal(steps[0].criterionId, "c1");
});

test("planNextSteps with an unknown optionId returns an empty list", () => {
  assert.deepEqual(planNextSteps({ ...FULL_STATE, scores: {} }, { optionId: "missing" }), []);
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

test("summarizeRecommendation audit reason names the tripped threshold", () => {
  const summary = summarizeRecommendation({ confidence: 55, quality: 60, coverage: 0.85 });
  assert.match(summary.reason, /confidence 55/);
});

test("summarizeRecommendation audit reason lists every tripped threshold", () => {
  const summary = summarizeRecommendation({ confidence: 55, quality: 50, coverage: 0.7 });
  assert.match(summary.reason, /coverage/);
  assert.match(summary.reason, /confidence/);
  assert.match(summary.reason, /quality/);
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

test("coverageBreakdown reports full ratios when every cell is scored", () => {
  const { byOption, byCriterion } = coverageBreakdown(FULL_STATE);
  assert.ok(byOption.every((row) => row.ratio === 1 && row.filled === row.total));
  assert.ok(byCriterion.every((row) => row.ratio === 1));
});

test("coverageBreakdown returns empty rows/columns for a fresh empty state", () => {
  const empty = coverageBreakdown({ criteria: [], options: [], scores: {} });
  assert.deepEqual(empty.byOption, []);
  assert.deepEqual(empty.byCriterion, []);
});

test("coverageBreakdown counts only filled cells per option and per criterion", () => {
  const partial = { ...FULL_STATE, scores: { o1: { c1: 7 }, o2: {} } };
  const { byOption, byCriterion } = coverageBreakdown(partial);
  assert.equal(byOption.find((r) => r.optionId === "o1").filled, 1);
  assert.equal(byOption.find((r) => r.optionId === "o2").filled, 0);
  assert.equal(byCriterion.find((r) => r.criterionId === "c1").filled, 1);
  assert.equal(byCriterion.find((r) => r.criterionId === "c2").filled, 0);
});

test("coverageBreakdown sorts byCriterion by descending weight", () => {
  const { byCriterion } = coverageBreakdown(FULL_STATE);
  for (let i = 1; i < byCriterion.length; i++) {
    assert.ok(byCriterion[i - 1].weight >= byCriterion[i].weight);
  }
});

test("findWeakestCoverage returns null fields for an empty state", () => {
  const w = findWeakestCoverage({ criteria: [], options: [], scores: {} });
  assert.equal(w.weakestOption, null);
  assert.equal(w.weakestCriterion, null);
});

test("findWeakestCoverage points to the option with the lowest coverage ratio", () => {
  const partial = { ...FULL_STATE, scores: { o1: { c1: 7, c2: 9 } } };
  const w = findWeakestCoverage(partial);
  assert.equal(w.weakestOption.optionId, "o2");
  assert.equal(w.weakestOption.ratio, 0);
});

test("findWeakestCoverage points to the criterion with the most empty cells", () => {
  const partial = { ...FULL_STATE, scores: { o1: { c1: 7 }, o2: { c1: 8 } } };
  assert.equal(findWeakestCoverage(partial).weakestCriterion.criterionId, "c2");
});

test("findWeakestCoverage breaks criterion ties by descending weight", () => {
  const empty = { ...FULL_STATE, scores: {} };
  assert.equal(findWeakestCoverage(empty).weakestCriterion.criterionId, "c1");
});

test("findCloseContenders returns empty array for a state with fewer than two options", () => {
  assert.deepEqual(findCloseContenders({ criteria: [], options: [], scores: {} }), []);
  const single = { ...FULL_STATE, options: [OPTIONS[0]], scores: { o1: { c1: 7, c2: 9 } } };
  assert.deepEqual(findCloseContenders(single), []);
});

test("findCloseContenders skips pairs whose gap exceeds the threshold", () => {
  // Startup totals 108, BigCo totals 97 → normalized gap ~7.9 points, above default 5.
  assert.deepEqual(findCloseContenders(FULL_STATE), []);
});

test("findCloseContenders flags adjacent pairs within the threshold", () => {
  const tight = { ...FULL_STATE, scores: { o1: { c1: 8, c2: 8 }, o2: { c1: 8, c2: 7 } } };
  const pairs = findCloseContenders(tight);
  assert.equal(pairs.length, 1);
  assert.equal(pairs[0].leaderName, "Startup");
  assert.equal(pairs[0].challengerName, "BigCo");
  assert.ok(pairs[0].gap <= 5);
});

test("findCloseContenders respects a custom threshold and returns rank metadata", () => {
  const pairs = findCloseContenders(FULL_STATE, { threshold: 10 });
  assert.equal(pairs.length, 1);
  assert.equal(pairs[0].rank, 1);
  for (const field of ["leaderId", "leaderName", "challengerId", "challengerName", "gap", "rank"]) {
    assert.ok(field in pairs[0], `missing field: ${field}`);
  }
});

test("findCloseContenders respects limit and keeps the highest-ranked pairs", () => {
  const threeWay = {
    criteria: CRITERIA,
    options: [
      { id: "o1", name: "Startup", note: "" },
      { id: "o2", name: "BigCo", note: "" },
      { id: "o3", name: "Agency", note: "" },
    ],
    scores: {
      o1: { c1: 9, c2: 9 },
      o2: { c1: 9, c2: 8 },
      o3: { c1: 8, c2: 9 },
    },
  };
  const all = findCloseContenders(threeWay);
  assert.equal(all.length, 2);
  const top = findCloseContenders(threeWay, { limit: 1 });
  assert.equal(top.length, 1);
  assert.equal(top[0].rank, 1);
});

test("findCloseContenders with limit=0 returns an empty list", () => {
  const tight = { ...FULL_STATE, scores: { o1: { c1: 8, c2: 8 }, o2: { c1: 8, c2: 7 } } };
  assert.deepEqual(findCloseContenders(tight, { limit: 0 }), []);
});

test("findCriterionLeader returns null when no option has scored the criterion", () => {
  const empty = { ...FULL_STATE, scores: {} };
  assert.equal(findCriterionLeader(empty, "c1"), null);
});

test("findCriterionLeader returns the top-scoring option with gap to runner-up", () => {
  const result = findCriterionLeader(FULL_STATE, "c1");
  assert.equal(result.leaderId, "o2");
  assert.equal(result.leaderScore, 8);
  assert.equal(result.gap, 1);
});

test("findCriterionLeader sets gap=null when only one option has been scored", () => {
  const partial = { ...FULL_STATE, scores: { o1: { c1: 7 } } };
  const result = findCriterionLeader(partial, "c1");
  assert.equal(result.leaderId, "o1");
  assert.equal(result.gap, null);
});

test("findCriterionLeader ignores unscored cells when ranking the column", () => {
  const partial = { ...FULL_STATE, scores: { o1: { c1: 3 }, o2: {} } };
  assert.equal(findCriterionLeader(partial, "c1").leaderId, "o1");
});

test("findCriterionLeader treats a score of 0 as a valid scored cell", () => {
  const zeroed = { ...FULL_STATE, scores: { o1: { c1: 0 }, o2: {} } };
  const result = findCriterionLeader(zeroed, "c1");
  assert.equal(result.leaderId, "o1");
  assert.equal(result.leaderScore, 0);
});

test("getThresholds returns configuration object with all threshold values", () => {
  const thresholds = getThresholds();
  assert.ok(thresholds.COVERAGE_CRITICAL);
  assert.ok(thresholds.CONFIDENCE_CRITICAL);
  assert.equal(typeof thresholds.COVERAGE_LOW, "number");
  assert.equal(thresholds.QUALITY_CRITICAL, 40);
  assert.equal(thresholds.QUALITY_LOW, 60);
});

