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

// Returns an ordered list of empty score cells to fill, ranked by criterion
// weight so an orchestration loop can direct the user toward the highest-impact
// gaps first.
export function planNextSteps(state) {
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
  return steps.sort((a, b) => b.weight - a.weight);
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
