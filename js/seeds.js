export function seedDecision() {
  return {
    decisionTitle: "Which next move should I take this quarter?",
    note: "A sample matrix comparing realistic paths with weighted tradeoffs.",
    criteria: [
      { id: "crit_upside", label: "Long-term upside", weight: 9 },
      { id: "crit_speed", label: "Speed to execution", weight: 7 },
      { id: "crit_focus", label: "Focus fit", weight: 8 },
      { id: "crit_risk", label: "Risk level", weight: 6 },
    ],
    options: [
      { id: "opt_product", name: "Double down on the product", note: "Higher upside, slower validation." },
      { id: "opt_consulting", name: "Take consulting work", note: "Faster cash, weaker strategic compounding." },
      { id: "opt_hybrid", name: "Hybrid split", note: "Balanced path with moderate risk." },
    ],
    scores: {
      opt_product: { crit_upside: 10, crit_speed: 6, crit_focus: 9, crit_risk: 5 },
      opt_consulting: { crit_upside: 6, crit_speed: 9, crit_focus: 6, crit_risk: 8 },
      opt_hybrid: { crit_upside: 8, crit_speed: 7, crit_focus: 8, crit_risk: 7 },
    },
  };
}
