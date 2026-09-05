import type { SimulationDetail } from "@/lib/api";
import { formatPercent } from "@/lib/format";

type SimulationListProps = {
  simulations: SimulationDetail[];
};

export default function SimulationList({ simulations }: SimulationListProps) {
  if (simulations.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No counterfactual scenarios were generated for this account.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {simulations.map((sim) => (
        <li
          key={sim.intervention}
          className="rounded-lg border border-border px-4 py-3 text-sm"
        >
          <p className="font-medium">{sim.intervention}</p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
            <span>Current: {formatPercent(sim.original_risk, 1)}</span>
            <span>After: {formatPercent(sim.simulated_risk, 1)}</span>
            <span className="text-risk-low">
              Score change: {formatPercent(sim.risk_reduction, 1)}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
