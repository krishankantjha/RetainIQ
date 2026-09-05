import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import ChartCard from "@/components/charts/ChartCard";
import type { ContractRiskRow } from "@/lib/aggregates";
import { getChartColors } from "@/lib/chartTheme";

type ContractRiskChartProps = {
  data: ContractRiskRow[];
};

function ContractTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  const total = payload.reduce((sum, entry) => sum + (entry.value ?? 0), 0);

  return (
    <div className="rounded-lg border border-border bg-surface-low px-3 py-2 text-sm shadow-card">
      <p className="font-medium text-foreground">{label}</p>
      <p className="mt-1 text-xs text-muted-foreground">{total.toLocaleString()} subscribers total</p>
      <ul className="mt-2 space-y-1">
        {payload.map((entry) => (
          <li key={entry.name} className="flex items-center justify-between gap-4 text-xs">
            <span style={{ color: entry.color }}>{entry.name}</span>
            <span className="font-medium text-foreground">
              {(entry.value ?? 0).toLocaleString()}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function ContractRiskChart({ data }: ContractRiskChartProps) {
  const colors = getChartColors();

  return (
    <ChartCard
      title="Risk by contract type"
      description="Stacked low / medium / high tiers per contract (bars sum to segment total)"
      empty={data.length === 0}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={colors.border} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="contract" tick={{ fill: colors.muted, fontSize: 11 }} />
          <YAxis tick={{ fill: colors.muted, fontSize: 11 }} allowDecimals={false} />
          <Tooltip content={<ContractTooltip />} />
          <Legend wrapperStyle={{ fontSize: 12, color: colors.muted }} />
          <Bar dataKey="low" stackId="risk" fill={colors.low} name="Low" radius={[0, 0, 0, 0]} />
          <Bar dataKey="medium" stackId="risk" fill={colors.medium} name="Medium" />
          <Bar dataKey="high" stackId="risk" fill={colors.high} name="High" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
