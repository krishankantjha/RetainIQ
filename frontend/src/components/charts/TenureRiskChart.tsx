import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import ChartCard from "@/components/charts/ChartCard";
import type { TenureRiskRow } from "@/lib/aggregates";
import { getChartColors } from "@/lib/chartTheme";

type TenureRiskChartProps = {
  data: TenureRiskRow[];
};

export default function TenureRiskChart({ data }: TenureRiskChartProps) {
  const colors = getChartColors();

  const chartData = data.map((row) => ({
    ...row,
    highRatePct: row.highRate * 100,
  }));

  return (
    <ChartCard
      title="High-risk rate by tenure"
      description="Share of high-risk subscribers within each tenure band"
      empty={data.length === 0}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={colors.border} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: colors.muted, fontSize: 11 }} />
          <YAxis
            tick={{ fill: colors.muted, fontSize: 11 }}
            unit="%"
            domain={[0, 100]}
          />
          <Tooltip
            contentStyle={{
              background: "var(--surface-low)",
              border: `1px solid ${colors.border}`,
              borderRadius: 8,
              color: colors.foreground,
            }}
            formatter={(value, _name, item) => {
              const row = item.payload as TenureRiskRow & { highRatePct: number };
              return [
                `${Number(value).toFixed(1)}% (${row.high} of ${row.total})`,
                "High-risk rate",
              ];
            }}
            labelFormatter={(label) => `Tenure: ${label}`}
          />
          <Bar dataKey="highRatePct" fill={colors.high} radius={[4, 4, 0, 0]} name="High-risk %" />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
