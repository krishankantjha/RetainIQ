import Plot from "react-plotly.js";

import type { GlobalDriver } from "@/lib/api";
import { formatFeatureName } from "@/lib/format";
import { getPlotlyLayout, PLOTLY_CONFIG } from "@/lib/plotlyTheme";
import { getChartColors } from "@/lib/chartTheme";

type GlobalDriversPlotProps = {
  drivers: GlobalDriver[];
};

export default function GlobalDriversPlot({ drivers }: GlobalDriversPlotProps) {
  const colors = getChartColors();
  const ordered = [...drivers].reverse();
  const labels = ordered.map((d) => formatFeatureName(d.feature));
  const values = ordered.map((d) => d.mean_abs_shap);
  const barColors = ordered.map((d) => (d.mean_shap >= 0 ? colors.high : colors.low));

  return (
    <Plot
      data={[
        {
          type: "bar",
          orientation: "h",
          y: labels,
          x: values,
          marker: { color: barColors },
          hovertemplate:
            "%{y}<br>Mean |SHAP|: %{x:.4f}<br>Mean SHAP: %{customdata:.4f}<extra></extra>",
          customdata: ordered.map((d) => d.mean_shap),
        },
      ]}
      layout={getPlotlyLayout({
        height: Math.max(280, drivers.length * 22 + 80),
        margin: { l: 160, r: 24, t: 16, b: 40 },
        xaxis: { title: { text: "Mean |SHAP| across subscribers" } },
        yaxis: { automargin: true },
      })}
      config={PLOTLY_CONFIG}
      style={{ width: "100%", height: "100%" }}
      useResizeHandler
    />
  );
}
