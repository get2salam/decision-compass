// Escalation and audit thresholds for decision-agent recommendations.
// Defines when a decision requires human review or must be logged for compliance.

const THRESHOLDS = {
  COVERAGE_CRITICAL: 0.5,    // Below this: high risk, always escalate
  COVERAGE_LOW: 0.8,         // Below this: borderline, audit required
  CONFIDENCE_CRITICAL: 30,   // Below this: high uncertainty, always escalate
  CONFIDENCE_LOW: 50,        // Below this: borderline, audit required
  CONFIDENCE_HIGH: 70,       // At or above: high confidence, no escalation
  QUALITY_CRITICAL: 40,      // Below this: poor decision quality, always escalate
  QUALITY_LOW: 60,           // Below this (and above critical): audit required
};

export function requiresEscalation(recommendation) {
  const { confidence, quality } = recommendation;
  const coverage = recommendation.coverage ?? 0;

  return (
    coverage < THRESHOLDS.COVERAGE_CRITICAL ||
    confidence < THRESHOLDS.CONFIDENCE_CRITICAL ||
    quality < THRESHOLDS.QUALITY_CRITICAL
  );
}

export function requiresAudit(recommendation) {
  const { confidence, quality } = recommendation;
  const coverage = recommendation.coverage ?? 0;

  return (
    coverage < THRESHOLDS.COVERAGE_LOW ||
    (confidence >= THRESHOLDS.CONFIDENCE_LOW && confidence < THRESHOLDS.CONFIDENCE_HIGH) ||
    (quality >= THRESHOLDS.QUALITY_CRITICAL && quality < THRESHOLDS.QUALITY_LOW)
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
    if (quality < THRESHOLDS.QUALITY_CRITICAL)
      reasons.push(`quality ${quality} below ${THRESHOLDS.QUALITY_CRITICAL}`);
    return { status: "escalate", label: "Escalate for human review", reason: reasons.join("; ") };
  }

  if (requiresAudit(recommendation)) {
    const reasons = [];
    if (coverage < THRESHOLDS.COVERAGE_LOW)
      reasons.push(`coverage ${Math.round(coverage * 100)}% below ${THRESHOLDS.COVERAGE_LOW * 100}%`);
    if (confidence >= THRESHOLDS.CONFIDENCE_LOW && confidence < THRESHOLDS.CONFIDENCE_HIGH)
      reasons.push(`confidence ${confidence} in borderline band ${THRESHOLDS.CONFIDENCE_LOW}–${THRESHOLDS.CONFIDENCE_HIGH}`);
    if (quality >= THRESHOLDS.QUALITY_CRITICAL && quality < THRESHOLDS.QUALITY_LOW)
      reasons.push(`quality ${quality} in borderline band ${THRESHOLDS.QUALITY_CRITICAL}–${THRESHOLDS.QUALITY_LOW}`);
    return { status: "audit", label: "Log for audit", reason: reasons.join("; ") };
  }

  return {
    status: "ready",
    label: "Ready to act",
    reason: "Coverage, confidence, and quality are within healthy thresholds.",
  };
}
