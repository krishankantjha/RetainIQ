/** Mirrors configs/model_config.yaml — keep in sync with backend analytics overview. */
export const DECISION_THRESHOLD = 0.15;
export const ELEVATED_RISK_MIN = 0.25;

export type RiskTier = "low" | "medium" | "high";

export function riskTierFromProbability(churnProbability: number): RiskTier {
  if (churnProbability >= ELEVATED_RISK_MIN) return "high";
  if (churnProbability >= DECISION_THRESHOLD) return "medium";
  return "low";
}

export function riskTierFromRow(row: {
  churn_probability: number;
  is_high_risk?: boolean;
}): RiskTier {
  return riskTierFromProbability(row.churn_probability);
}

export type RiskDistribution = {
  low: number;
  medium: number;
  high: number;
};

export function buildRiskDistribution(
  rows: { churn_probability: number }[],
): RiskDistribution {
  const dist: RiskDistribution = { low: 0, medium: 0, high: 0 };
  for (const row of rows) {
    dist[riskTierFromProbability(row.churn_probability)] += 1;
  }
  return dist;
}

/** Subscribers at or above the cost-optimal decision threshold (≥15%). */
export function actionableHighCount(dist: RiskDistribution): number {
  return dist.medium + dist.high;
}
