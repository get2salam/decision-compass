// Regression tests for store selectors and threshold boundary conditions.
//
// Coverage gaps addressed here:
//   - selectStats, selectOptionTotals, selectRankedOptions, selectConfidence edge cases
//   - exact boundary values for every THRESHOLDS constant so off-by-one changes
//     in thresholds.js are caught immediately
//   - assessCoverage with missing criteria/options arrays (defensive-default fix)

import { test } from "node:test";
import assert from "node:assert/strict";

import { assessCoverage } from "../js/agent.js";
import {
  selectStats,
  selectOptionTotals,
  selectRankedOptions,
  selectConfidence,
} from "../js/store.js";
import {
  getThresholds,
  requiresAudit,
  requiresEscalation,
} from "../js/thresholds.js";

// ── helpers ──────────────────────────────────────────────────────────────────

function state({ options = [], criteria = [], scores = {} } = {}) {
  return { options, criteria, scores };
}

const C1 = { id: "c1", label: "Salary", weight: 9 };
const C2 = { id: "c2", label: "Culture", weight: 5 };
const O1 = { id: "o1", name: "Startup", note: "" };
const O2 = { id: "o2", name: "BigCo", note: "" };
const FULL = state({
  criteria: [C1, C2],
  options: [O1, O2],
  scores: { o1: { c1: 7, c2: 9 }, o2: { c1: 8, c2: 5 } },
});

// ── assessCoverage – defensive default fix ───────────────────────────────────

test("assessCoverage returns 0 gracefully when criteria or options arrays are absent", () => {
  // coverageBreakdown and planNextSteps already use default destructuring;
  // assessCoverage now matches so callers do not get a TypeError on partial objects.
  assert.equal(assessCoverage({}), 0);
  assert.equal(assessCoverage({ scores: {} }), 0);
  assert.equal(assessCoverage({ criteria: [], scores: {} }), 0);
});

test("assessCoverage treats an explicit score of 0 as a filled cell", () => {
  const zeroed = state({
    criteria: [C1, C2],
    options: [O1, O2],
    scores: { o1: { c1: 0, c2: 0 }, o2: { c1: 0, c2: 0 } },
  });
  assert.equal(assessCoverage(zeroed), 1);
});

// ── selectStats ───────────────────────────────────────────────────────────────

test("selectStats returns zeros for an empty state", () => {
  assert.deepEqual(selectStats(state()), { options: 0, criteria: 0 });
});

// ── selectOptionTotals ────────────────────────────────────────────────────────

test("selectOptionTotals returns empty array when there are no options", () => {
  assert.deepEqual(selectOptionTotals(state({ criteria: [C1] })), []);
});

test("selectOptionTotals treats unscored cells as 0 in the weighted sum", () => {
  const partial = state({
    criteria: [C1, C2],
    options: [O1, O2],
    scores: { o1: { c1: 5 } },   // c2 missing for o1, all missing for o2
  });
  const [t1, t2] = selectOptionTotals(partial);
  // o1: 5*9 + 0*5 = 45; o2: 0
  assert.equal(t1.weightedScore, 45);
  assert.equal(t2.weightedScore, 0);
  assert.equal(t2.normalized, 0);
});

test("selectOptionTotals normalized score reaches 100 when an option scores maximally", () => {
  const perfect = state({
    criteria: [C1, C2],
    options: [O1],
    scores: { o1: { c1: 10, c2: 10 } },
  });
  assert.equal(selectOptionTotals(perfect)[0].normalized, 100);
});

test("selectOptionTotals normalized scores are all 0 when every cell is 0", () => {
  const zeroed = state({
    criteria: [C1, C2],
    options: [O1, O2],
    scores: { o1: { c1: 0, c2: 0 }, o2: { c1: 0, c2: 0 } },
  });
  assert.ok(selectOptionTotals(zeroed).every((t) => t.normalized === 0));
});

// ── selectRankedOptions ───────────────────────────────────────────────────────

test("selectRankedOptions returns empty array for a state with no options", () => {
  assert.deepEqual(selectRankedOptions(state()), []);
});

test("selectRankedOptions result includes weightedScore and normalized fields", () => {
  const [top] = selectRankedOptions(FULL);
  assert.ok("weightedScore" in top, "missing weightedScore");
  assert.ok("normalized" in top, "missing normalized");
  assert.ok("optionId" in top, "missing optionId");
});

test("selectRankedOptions places highest weighted score first", () => {
  // o1: 7*9 + 9*5 = 108; o2: 8*9 + 5*5 = 97
  const [first, second] = selectRankedOptions(FULL);
  assert.equal(first.id, "o1");
  assert.equal(second.id, "o2");
  assert.ok(first.weightedScore > second.weightedScore);
});

// ── selectConfidence ──────────────────────────────────────────────────────────

test("selectConfidence returns the normalized score for a single option", () => {
  // This branch is reached when UI calls selectConfidence directly with 1-option state.
  // buildRecommendation short-circuits to confidence:0 before this path, but the
  // selector itself returns the option's actual normalized score so standalone
  // callers get a meaningful value.
  const single = state({
    criteria: [C1, C2],
    options: [O1],
    scores: { o1: { c1: 7, c2: 7 } },
  });
  // weightedScore = 7*9 + 7*5 = 98; maxScore = 14*10 = 140; normalized = 70
  assert.equal(selectConfidence(single), 70);
});

test("selectConfidence returns a value in the 0..100 range for ordinary decisions", () => {
  const c = selectConfidence(FULL);
  assert.ok(c >= 0 && c <= 100, `confidence ${c} out of range`);
});

// ── threshold exact boundary values ──────────────────────────────────────────

const T = getThresholds();

// COVERAGE_CRITICAL = 0.5
test("requiresEscalation is false at the exact COVERAGE_CRITICAL boundary (0.5)", () => {
  // Strictly less-than — coverage equal to the threshold does not escalate.
  assert.equal(requiresEscalation({ confidence: 80, quality: 80, coverage: T.COVERAGE_CRITICAL }), false);
});

test("requiresEscalation is true just below COVERAGE_CRITICAL", () => {
  const below = T.COVERAGE_CRITICAL - 0.01;
  assert.equal(requiresEscalation({ confidence: 80, quality: 80, coverage: below }), true);
});

// COVERAGE_LOW = 0.8
test("requiresAudit is false at the exact COVERAGE_LOW boundary (0.8)", () => {
  // Strictly less-than — equal to COVERAGE_LOW does not trigger audit on coverage.
  assert.equal(requiresAudit({ confidence: 80, quality: 80, coverage: T.COVERAGE_LOW }), false);
});

test("requiresAudit is true just below COVERAGE_LOW", () => {
  const below = T.COVERAGE_LOW - 0.01;
  assert.equal(requiresAudit({ confidence: 80, quality: 80, coverage: below }), true);
});

// CONFIDENCE_CRITICAL = 30
test("requiresEscalation is false at the exact CONFIDENCE_CRITICAL boundary (30)", () => {
  assert.equal(requiresEscalation({ confidence: T.CONFIDENCE_CRITICAL, quality: 80, coverage: 0.9 }), false);
});

test("requiresEscalation is true just below CONFIDENCE_CRITICAL", () => {
  assert.equal(requiresEscalation({ confidence: T.CONFIDENCE_CRITICAL - 1, quality: 80, coverage: 0.9 }), true);
});

// CONFIDENCE_HIGH = 70  (upper bound of audit band)
test("requiresAudit on confidence is false at exact CONFIDENCE_HIGH boundary (70)", () => {
  // confidence >= 70 clears the audit band; this is the cutoff for "strong confidence"
  assert.equal(requiresAudit({ confidence: T.CONFIDENCE_HIGH, quality: 80, coverage: 0.9 }), false);
});

test("requiresAudit on confidence is true just below CONFIDENCE_HIGH", () => {
  assert.equal(requiresAudit({ confidence: T.CONFIDENCE_HIGH - 1, quality: 80, coverage: 0.9 }), true);
});

// QUALITY_CRITICAL = 40
test("requiresEscalation is false at the exact QUALITY_CRITICAL boundary (40)", () => {
  assert.equal(requiresEscalation({ confidence: 80, quality: T.QUALITY_CRITICAL, coverage: 0.9 }), false);
});

test("requiresAudit is true at the exact QUALITY_CRITICAL boundary (40)", () => {
  // quality=40 does not escalate but does enter the audit band [40, 60)
  assert.equal(requiresAudit({ confidence: 80, quality: T.QUALITY_CRITICAL, coverage: 0.9 }), true);
});

// QUALITY_LOW = 60  (upper bound of quality audit band)
test("requiresAudit on quality is false at the exact QUALITY_LOW boundary (60)", () => {
  assert.equal(requiresAudit({ confidence: 80, quality: T.QUALITY_LOW, coverage: 0.9 }), false);
});

test("requiresAudit on quality is true just below QUALITY_LOW", () => {
  assert.equal(requiresAudit({ confidence: 80, quality: T.QUALITY_LOW - 1, coverage: 0.9 }), true);
});
