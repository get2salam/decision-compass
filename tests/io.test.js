import { test } from "node:test";
import assert from "node:assert/strict";

import { parseBackup, SCHEMA } from "../js/io.js";

test("parseBackup throws a friendly error for invalid JSON", () => {
  assert.throws(() => parseBackup("{not json"), /isn't valid JSON/);
});

test("parseBackup rejects non-object payloads", () => {
  assert.throws(() => parseBackup("null"), /not a Decision Compass backup/);
  assert.throws(() => parseBackup("[]"), /not a Decision Compass backup/);
  assert.throws(() => parseBackup("42"), /not a Decision Compass backup/);
});

test("parseBackup rejects payloads with a missing or mismatched schema", () => {
  assert.throws(() => parseBackup("{}"), /not a Decision Compass backup/);
  assert.throws(
    () => parseBackup(JSON.stringify({ schema: "other/v1" })),
    /not a Decision Compass backup/,
  );
});

test("parseBackup returns the parsed payload when the schema matches", () => {
  const payload = { schema: SCHEMA, decisionTitle: "Demo", criteria: [], options: [] };
  assert.deepEqual(parseBackup(JSON.stringify(payload)), payload);
});
