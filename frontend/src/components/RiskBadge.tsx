import { riskTierFromRow } from "@/lib/riskBands";

export default function RiskBadge({ churnProbability }: { churnProbability: number }) {
  const band = riskTierFromRow({ churn_probability: churnProbability });

  if (band === "high") {
    return (
      <span className="rounded-full bg-risk-high/15 px-2 py-0.5 text-xs font-medium text-risk-high">
        High
      </span>
    );
  }
  if (band === "medium") {
    return (
      <span className="rounded-full bg-risk-medium/15 px-2 py-0.5 text-xs font-medium text-risk-medium">
        Medium
      </span>
    );
  }
  return (
    <span className="rounded-full bg-risk-low/15 px-2 py-0.5 text-xs font-medium text-risk-low">
      Low
    </span>
  );
}
