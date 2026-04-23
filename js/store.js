import { defaultState, normalizeCriterion, normalizeOption, STORAGE_KEY, touch } from "./model.js";

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

export function initStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) state = { ...defaultState(), ...JSON.parse(raw) };
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
  setDecisionMeta(patch) {
    commit({ ...state, ...patch });
  },
  addCriterion(input = {}) {
    commit({
      ...state,
      criteria: [...state.criteria, normalizeCriterion(input)],
    });
  },
  addOption(input = {}) {
    commit({
      ...state,
      options: [...state.options, normalizeOption(input)],
    });
  },
};

export function selectStats(input = state) {
  return {
    options: input.options.length,
    criteria: input.criteria.length,
  };
}
