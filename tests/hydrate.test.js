import { test } from "node:test";
import assert from "node:assert/strict";

import { hydrate } from "../js/store.js";

test("hydrate returns a default-shaped state for empty input", () => {
  const state = hydrate();
  assert.deepEqual(state.criteria, []);
  assert.deepEqual(state.options, []);
  assert.deepEqual(state.scores, {});
  assert.equal(state.ui.activeOptionId, null);
  assert.equal(state.ui.activeCriteriaId, null);
});

test("hydrate coerces non-array criteria and options to empty arrays", () => {
  const state = hydrate({ criteria: "nope", options: 42 });
  assert.deepEqual(state.criteria, []);
  assert.deepEqual(state.options, []);
});

test("hydrate normalizes criteria weights and option names", () => {
  const state = hydrate({
    criteria: [{ id: "crit_a", label: "  Cost  ", weight: 999 }],
    options: [{ id: "opt_a", name: "  Path A  " }],
  });
  assert.equal(state.criteria[0].label, "Cost");
  assert.equal(state.criteria[0].weight, 10);
  assert.equal(state.options[0].name, "Path A");
});

test("hydrate drops scores referencing unknown options or criteria", () => {
  const state = hydrate({
    criteria: [{ id: "crit_a", label: "Cost", weight: 5 }],
    options: [{ id: "opt_a", name: "A" }],
    scores: {
      opt_a: { crit_a: 7, crit_ghost: 9 },
      opt_missing: { crit_a: 3 },
    },
  });
  assert.deepEqual(state.scores, { opt_a: { crit_a: 7 } });
});

test("hydrate merges provided ui fields over defaults", () => {
  const state = hydrate({ ui: { activeOptionId: "opt_a" } });
  assert.equal(state.ui.activeOptionId, "opt_a");
  assert.equal(state.ui.activeCriteriaId, null);
});
