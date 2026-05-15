export const STORAGE_KEY = "decision-compass:v1";

export const defaultState = () => ({
  decisionTitle: "Untitled decision",
  note: "",
  criteria: [],
  options: [],
  scores: {},
  ui: {
    activeOptionId: null,
    activeCriteriaId: null,
  },
  meta: {
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
});

export function uid(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
}

export function normalizeCriterion(input = {}) {
  const label = typeof input.label === "string" ? input.label.trim() : "";
  return {
    id: input.id || uid("crit"),
    label: label || "New criterion",
    weight: Number.isFinite(input.weight) ? Math.max(1, Math.min(10, input.weight)) : 5,
  };
}

export function normalizeOption(input = {}) {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  return {
    id: input.id || uid("opt"),
    name: name || "New option",
    note: typeof input.note === "string" ? input.note : "",
  };
}

export function clampScore(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(10, n));
}

export function normalizeScores(rawScores, options, criteria) {
  if (!rawScores || typeof rawScores !== "object") return {};
  const optionIds = new Set(options.map((option) => option.id));
  const criterionIds = new Set(criteria.map((criterion) => criterion.id));
  const result = {};
  for (const optionId of Object.keys(rawScores)) {
    if (!optionIds.has(optionId)) continue;
    const row = rawScores[optionId];
    if (!row || typeof row !== "object") continue;
    const cleaned = {};
    for (const criterionId of Object.keys(row)) {
      if (!criterionIds.has(criterionId)) continue;
      cleaned[criterionId] = clampScore(row[criterionId]);
    }
    result[optionId] = cleaned;
  }
  return result;
}

export function touch(state) {
  return {
    ...state,
    meta: {
      ...state.meta,
      updatedAt: new Date().toISOString(),
    },
  };
}
