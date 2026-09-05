import Plot from "react-plotly.js";

import type { RiskTrendPoint } from "@/lib/api";
import { getPlotlyLayout, PLOTLY_CONFIG } from "@/lib/plotlyTheme";
import { getChartColors } from "@/lib/chartTheme";

type RiskTrendPlotProps = {
  points: RiskTrendPoint[];
};

export default function RiskTrendPlot({ points }: RiskTrendPlotProps) {
  const colors = getChartColors();
  const dates = points.map((p) => p.date);
  const highRiskRate = points.map((p) =>
    p.subscriber_count > 0 ? p.high_risk_count / p.subscriber_count : 0,
  );

  return (
    <Plot
      data={[
        {
          type: "scatter",
          mode: "lines+markers",
          name: "Avg predicted churn",
          x: dates,
          y: points.map((p) => p.avg_churn_probability),
          line: { color: colors.primary, width: 2 },
          marker: { size: 7 },
          hovertemplate:
            "%{x}<br>Avg predicted: %{y:.1%}<br>Subscribers: %{customdata[0]}<br>Above threshold: %{customdata[1]}<extra></extra>",
          customdata: points.map((p) => [p.subscriber_count, p.high_risk_count]),
        },
        {
          type: "scatter",
          mode: "lines+markers",
          name: "Above-threshold rate",
          x: dates,
          y: highRiskRate,
          line: { color: colors.high, width: 2, dash: "dot" },
          marker: { size: 6 },
          hovertemplate: "%{x}<br>Above-threshold rate: %{y:.1%}<extra></extra>",
        },
      ]}
      layout={getPlotlyLayout({
        height: 280,
        legend: { orientation: "h", y: 1.12, x: 0 },
        yaxis: {
          title: { text: "Rate" },
          tickformat: ".0%",
          range: [0, 1],
        },
        xaxis: { title: { text: "Scoring batch date" } },
      })}
      config={PLOTLY_CONFIG}
      style={{ width: "100%", height: "100%" }}
      useResizeHandler
    />
  );
}
