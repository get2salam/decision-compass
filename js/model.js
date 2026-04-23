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
  return {
    id: input.id || uid("crit"),
    label: (input.label || "New criterion").trim(),
    weight: Number.isFinite(input.weight) ? Math.max(1, Math.min(10, input.weight)) : 5,
  };
}

export function normalizeOption(input = {}) {
  return {
    id: input.id || uid("opt"),
    name: (input.name || "New option").trim(),
    note: input.note || "",
  };
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
