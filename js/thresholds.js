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

// Collapses requiresEscalation/requiresAudit into a single dispatch value so
// callers (UI banners, orchestration loops) can switch on `status` rather than
// re-running both checks. The `reason` string explains which threshold tripped.
export function summarizeRecommendation(recommendation) {
  const coverage = recommendation.coverage ?? 0;
  const { confidence, quality } = recommendation;

  if (requiresEscalation(recommendation)) {
    const reasons = [];
    if (coverage < THRESHOLDS.COVERAGE_CRITICAL)
      reasons.push(`coverage ${Math.round(coverage * 100)}% below ${THRESHOLDS.COVERAGE_CRITICAL * 100}%`);
    if (confidence < THRESHOLDS.CONFIDENCE_CRITICAL)
      reasons.push(`confidence ${confidence} below ${THRESHOLDS.CONFIDENCE_CRITICAL}`);
    if (quality < 40) reasons.push(`quality ${quality} below 40`);
    return { status: "escalate", label: "Escalate for human review", reason: reasons.join("; ") };
  }

  if (requiresAudit(recommendation)) {
    return {
      status: "audit",
      label: "Log for audit",
      reason: "Borderline coverage, confidence, or quality — record for later review.",
    };
  }

  return {
    status: "ready",
    label: "Ready to act",
    reason: "Coverage, confidence, and quality are within healthy thresholds.",
  };
}
