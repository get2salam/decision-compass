// Escalation and audit thresholds for decision-agent recommendations.
// Defines when a decision requires human review or must be logged for compliance.

const THRESHOLDS = {
  COVERAGE_CRITICAL: 0.5,    // Below this: high risk, always escalate
  COVERAGE_LOW: 0.8,         // Below this: borderline, audit required
  CONFIDENCE_CRITICAL: 30,   // Below this: high uncertainty, always escalate
  CONFIDENCE_LOW: 50,        // Below this: borderline, audit required
  CONFIDENCE_HIGH: 70,       // At or above: high confidence, no escalation
};

export function requiresEscalation(recommendation) {
  const { confidence, quality } = recommendation;
  const coverage = recommendation.coverage ?? 0;

  return (
    coverage < THRESHOLDS.COVERAGE_CRITICAL ||
    confidence < THRESHOLDS.CONFIDENCE_CRITICAL ||
    quality < 40
  );
}

export function requiresAudit(recommendation) {
  const { confidence, quality } = recommendation;
  const coverage = recommendation.coverage ?? 0;

  return (
    coverage < THRESHOLDS.COVERAGE_LOW ||
    (confidence >= THRESHOLDS.CONFIDENCE_LOW && confidence < THRESHOLDS.CONFIDENCE_HIGH) ||
    (quality >= 40 && quality < 60)
  );
}

export function getThresholds() {
  return { ...THRESHOLDS };
}
