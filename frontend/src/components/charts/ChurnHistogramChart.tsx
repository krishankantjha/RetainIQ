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
import type { HistogramBin } from "@/lib/aggregates";
import { getChartColors } from "@/lib/chartTheme";

type ChurnHistogramChartProps = {
  data: HistogramBin[];
};

export default function ChurnHistogramChart({ data }: ChurnHistogramChartProps) {
  const colors = getChartColors();

  return (
    <ChartCard
      title="Churn probability distribution"
      description="10% probability bins across all scored subscribers"
      empty={data.length === 0}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
          <CartesianGrid stroke={colors.border} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: colors.muted, fontSize: 11 }}
            interval={0}
            height={36}
          />
          <YAxis tick={{ fill: colors.muted, fontSize: 11 }} allowDecimals={false} />
          <Tooltip
            contentStyle={{
              background: "var(--surface-low)",
              border: `1px solid ${colors.border}`,
              borderRadius: 8,
              color: colors.foreground,
            }}
            formatter={(value) => [value, "Subscribers"]}
          />
          <Bar dataKey="count" fill={colors.primary} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
