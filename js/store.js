import {
  defaultState,
  normalizeCriterion,
  normalizeOption,
  STORAGE_KEY,
  touch,
} from "./model.js";

let state = defaultState();
const listeners = new Set();

function emit() {
  for (const listener of listeners) listener(state);
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function commit(next) {
  state = touch(next);
  persist();
  emit();
}

export function hydrate(input = {}) {
  return {
    ...defaultState(),
    ...input,
    criteria: Array.isArray(input.criteria) ? input.criteria.map(normalizeCriterion) : [],
    options: Array.isArray(input.options) ? input.options.map(normalizeOption) : [],
    scores: input.scores && typeof input.scores === "object" ? input.scores : {},
    ui: {
      ...defaultState().ui,
      ...(input.ui || {}),
    },
    meta: {
      ...defaultState().meta,
      ...(input.meta || {}),
    },
  };
}

export function initStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    state = raw ? hydrate(JSON.parse(raw)) : defaultState();
  } catch {
    state = defaultState();
  }
  emit();
}

export function subscribe(listener) {
  listeners.add(listener);
  listener(state);
  return () => listeners.delete(listener);
}

export function getState() {
  return state;
}

export const actions = {
  reset() {
    commit(defaultState());
  },
  replaceAll(nextState) {
    commit(hydrate(nextState));
  },
  setDecisionMeta(patch) {
    commit({ ...state, ...patch });
  },
  addCriterion(input = {}) {
    commit({
      ...state,
      criteria: [...state.criteria, normalizeCriterion(input)],
    });
  },
  updateCriterion(id, patch = {}) {
    commit({
      ...state,
      criteria: state.criteria.map((criterion) =>
        criterion.id === id ? normalizeCriterion({ ...criterion, ...patch, id }) : criterion
      ),
    });
  },
  removeCriterion(id) {
    const scores = { ...state.scores };
    for (const optionId of Object.keys(scores)) {
      if (scores[optionId]) delete scores[optionId][id];
    }
    commit({
      ...state,
      criteria: state.criteria.filter((criterion) => criterion.id !== id),
      scores,
    });
  },
  addOption(input = {}) {
    commit({
      ...state,
      options: [...state.options, normalizeOption(input)],
    });
  },
  updateOption(id, patch = {}) {
    commit({
      ...state,
      options: state.options.map((option) =>
        option.id === id ? normalizeOption({ ...option, ...patch, id }) : option
      ),
    });
  },
};

export function selectStats(input = state) {
  return {
    options: input.options.length,
    criteria: input.criteria.length,
  };
}
