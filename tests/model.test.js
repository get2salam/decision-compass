import { test } from "node:test";
import assert from "node:assert/strict";

import {
  clampScore,
  normalizeCriterion,
  normalizeOption,
  normalizeScores,
} from "../js/model.js";

test("clampScore coerces non-numeric input to 0", () => {
  assert.equal(clampScore("not a number"), 0);
  assert.equal(clampScore(undefined), 0);
});

test("clampScore clamps to the 0..10 range", () => {
  assert.equal(clampScore(-3), 0);
  assert.equal(clampScore(42), 10);
  assert.equal(clampScore("7"), 7);
});

test("normalizeCriterion fills defaults and clamps weight", () => {
  const c = normalizeCriterion({ label: "  Speed  ", weight: 99 });
  assert.equal(c.label, "Speed");
  assert.equal(c.weight, 10);
  assert.match(c.id, /^crit_/);

  const fallback = normalizeCriterion({});
  assert.equal(fallback.label, "New criterion");
  assert.equal(fallback.weight, 5);
});

test("normalizeOption preserves provided id and trims name", () => {
  const o = normalizeOption({ id: "opt_keep", name: "  Path A  " });
  assert.equal(o.id, "opt_keep");
  assert.equal(o.name, "Path A");
  assert.equal(o.note, "");
});

test("normalizeScores drops unknown options and criteria", () => {
  const options = [{ id: "opt_a", name: "A", note: "" }];
  const criteria = [{ id: "crit_x", label: "X", weight: 5 }];
  const cleaned = normalizeScores(
    {
      opt_a: { crit_x: 8, crit_ghost: 5 },
      opt_missing: { crit_x: 3 },
    },
    options,
    criteria,
  );
  assert.deepEqual(cleaned, { opt_a: { crit_x: 8 } });
});
