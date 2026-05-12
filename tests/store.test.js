import { test } from "node:test";
import assert from "node:assert/strict";

import {
  selectConfidence,
  selectOptionTotals,
  selectRankedOptions,
  selectStats,
} from "../js/store.js";

function makeState({ options = [], criteria = [], scores = {} } = {}) {
  return { options, criteria, scores };
}

test("selectStats counts options and criteria", () => {
  const state = makeState({
    options: [{ id: "opt_a" }, { id: "opt_b" }],
    criteria: [{ id: "crit_x" }],
  });
  assert.deepEqual(selectStats(state), { options: 2, criteria: 1 });
});

test("selectOptionTotals returns zeroed totals when there are no criteria", () => {
  const state = makeState({ options: [{ id: "opt_a", name: "A" }] });
  const totals = selectOptionTotals(state);
  assert.equal(totals.length, 1);
  assert.equal(totals[0].weightedScore, 0);
  assert.equal(totals[0].normalized, 0);
});

test("selectOptionTotals weights raw scores by criterion weight", () => {
  const state = makeState({
    options: [{ id: "opt_a", name: "A" }],
    criteria: [
      { id: "crit_x", label: "X", weight: 2 },
      { id: "crit_y", label: "Y", weight: 3 },
    ],
    scores: { opt_a: { crit_x: 10, crit_y: 0 } },
  });
  const [total] = selectOptionTotals(state);
  assert.equal(total.weightedScore, 20);
  assert.equal(total.normalized, 40);
});

test("selectRankedOptions sorts by weighted score then name", () => {
  const state = makeState({
    options: [
      { id: "opt_a", name: "Alpha" },
      { id: "opt_b", name: "Bravo" },
      { id: "opt_c", name: "Charlie" },
    ],
    criteria: [{ id: "crit_x", label: "X", weight: 5 }],
    scores: {
      opt_a: { crit_x: 4 },
      opt_b: { crit_x: 9 },
      opt_c: { crit_x: 9 },
    },
  });
  const ranked = selectRankedOptions(state);
  assert.deepEqual(
    ranked.map((option) => option.id),
    ["opt_b", "opt_c", "opt_a"],
  );
});

test("selectConfidence reflects the gap between top two options", () => {
  assert.equal(selectConfidence(makeState()), 0);

  const decisive = makeState({
    options: [
      { id: "opt_a", name: "A" },
      { id: "opt_b", name: "B" },
    ],
    criteria: [{ id: "crit_x", label: "X", weight: 5 }],
    scores: { opt_a: { crit_x: 10 }, opt_b: { crit_x: 0 } },
  });
  assert.equal(selectConfidence(decisive), 100);

  const tied = makeState({
    options: [
      { id: "opt_a", name: "A" },
      { id: "opt_b", name: "B" },
    ],
    criteria: [{ id: "crit_x", label: "X", weight: 5 }],
    scores: { opt_a: { crit_x: 6 }, opt_b: { crit_x: 6 } },
  });
  assert.equal(selectConfidence(tied), 50);
});
