// Decision-recommendation agent: analyses a state snapshot and emits a
// structured recommendation with chain-of-thought reasoning steps, ready
// for display in the UI or consumption by an outer AI orchestration loop.

import { selectConfidence, selectRankedOptions } from "./store.js";

export function assessCoverage(state) {
  const { criteria, options, scores } = state;
  if (!criteria.length || !options.length) return 0;
  let filled = 0;
  for (const opt of options) {
    const row = scores[opt.id] ?? {};
    for (const crit of criteria) if (row[crit.id] != null) filled++;
  }
  return filled / (options.length * criteria.length);
}

// Per-option and per-criterion coverage stats. Complements assessCoverage by
// surfacing *where* the gaps are, so a UI can show progress per row/column and
// an orchestration loop can target a specific option or criterion instead of
// walking the flat planNextSteps list. byCriterion is sorted by weight desc so
// the highest-impact gaps are easy to find first.
export function coverageBreakdown(state) {
  const { criteria = [], options = [], scores = {} } = state;
  const byOption = options.map((opt) => {
    const row = scores[opt.id] ?? {};
    const filled = criteria.filter((c) => row[c.id] != null).length;
    return {
      optionId: opt.id,
      optionName: opt.name,
      filled,
      total: criteria.length,
      ratio: criteria.length ? filled / criteria.length : 0,
    };
  });
  const byCriterion = criteria
    .map((c) => {
      const filled = options.filter((opt) => (scores[opt.id] ?? {})[c.id] != null).length;
      return {
        criterionId: c.id,
        criterionLabel: c.label,
        weight: c.weight,
        filled,
        total: options.length,
        ratio: options.length ? filled / options.length : 0,
      };
    })
    .sort((a, b) => b.weight - a.weight);
  return { byOption, byCriterion };
}

export function scoreDecisionQuality(state) {
  const { criteria } = state;
  if (!criteria.length || !state.options.length) return 0;
  const weights = criteria.map((c) => c.weight);
  const weightSpread =
    criteria.length > 1 ? (Math.max(...weights) - Math.min(...weights)) / 9 : 0;
  const ranked = selectRankedOptions(state);
  const scoreSpread =
    ranked.length > 1
      ? Math.min(
          (ranked[0].normalized - ranked[ranked.length - 1].normalized) / 50,
          1,
        )
      : 0;
  return Math.min(
    Math.round(
      (assessCoverage(state) * 0.5 + weightSpread * 0.25 + scoreSpread * 0.25) *
        100,
    ),
    100,
  );
}

// Returns adjacent option pairs whose normalized scores are within `threshold`
// percentage points — useful for an orchestration loop to flag "too close to
// call" matchups that would benefit from sharper differentiating criteria.
// Pairs are returned in rank order, so the most impactful tie-break (the one
// between the leader and runner-up) appears first.
export function findCloseContenders(state, { threshold = 5 } = {}) {
  const ranked = selectRankedOptions(state);
  const pairs = [];
  for (let i = 1; i < ranked.length; i++) {
    const gap = ranked[i - 1].normalized - ranked[i].normalized;
    if (gap <= threshold) {
      pairs.push({
        leaderId: ranked[i - 1].id,
        leaderName: ranked[i - 1].name,
        challengerId: ranked[i].id,
        challengerName: ranked[i].name,
        gap: Number(gap.toFixed(2)),
        rank: i,
      });
    }
  }
  return pairs;
}

// Returns an ordered list of empty score cells to fill, ranked by criterion
// weight so an orchestration loop can direct the user toward the highest-impact
// gaps first. Pass `limit` to cap the result — useful when a loop only wants
// the next N actions rather than the full backlog.
export function planNextSteps(state, { limit } = {}) {
  const { criteria = [], options = [], scores = {} } = state;
  const steps = [];
  for (const criterion of criteria) {
    for (const option of options) {
      const row = scores[option.id] ?? {};
      if (row[criterion.id] == null) {
        steps.push({
          optionId: option.id,
          optionName: option.name,
          criterionId: criterion.id,
          criterionLabel: criterion.label,
          weight: criterion.weight,
          rationale: `Score "${option.name}" on "${criterion.label}" (weight ${criterion.weight}/10) to improve coverage.`,
        });
      }
    }
  }
  steps.sort((a, b) => b.weight - a.weight);
  if (typeof limit === "number" && limit >= 0) return steps.slice(0, limit);
  return steps;
}

export function buildRecommendation(state) {
  const { criteria, options } = state;
  const reasoning = [];

  if (!criteria.length) {
    reasoning.push("No criteria defined — add at least one weighted criterion.");
    return { recommendation: null, confidence: 0, quality: 0, coverage: 0, reasoning, ready: false };
  }
  if (!options.length) {
    reasoning.push("No options defined — add at least two options to compare.");
    return { recommendation: null, confidence: 0, quality: 0, coverage: 0, reasoning, ready: false };
  }

  const coverage = assessCoverage(state);
  reasoning.push(`Score coverage: ${Math.round(coverage * 100)}% of cells filled.`);

  const weights = criteria.map((c) => c.weight);
  const topCrit = criteria[weights.indexOf(Math.max(...weights))];
  reasoning.push(`Highest-weight criterion: "${topCrit.label}" (${topCrit.weight}/10).`);

  const ranked = selectRankedOptions(state);
  const top = ranked[0];
  reasoning.push(`Leading option: "${top.name}" — ${top.normalized.toFixed(1)}% weighted score.`);

  const confidence = selectConfidence(state);
  if (confidence >= 70)
    reasoning.push(`Strong confidence gap (${confidence}/100) — decision is clear.`);
  else if (confidence >= 50)
    reasoning.push(`Moderate confidence (${confidence}/100) — consider refining weights.`);
  else
    reasoning.push(
      `Low confidence (${confidence}/100) — options are close; add differentiating criteria.`,
    );

  const ready = coverage >= 0.8 && confidence >= 50 && ranked.length >= 2;
  return {
    recommendation: ready ? top.name : null,
    confidence,
    quality: scoreDecisionQuality(state),
    coverage,
    reasoning,
    ready,
  };
}
