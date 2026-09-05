import Plot from "react-plotly.js";

import type { SegmentMatrix } from "@/lib/api";
import { getPlotlyLayout, PLOTLY_CONFIG } from "@/lib/plotlyTheme";
import { getChartColors } from "@/lib/chartTheme";

type SegmentHeatmapPlotProps = {
  data: SegmentMatrix;
  onCellClick?: (contract: string, tenureBin: string) => void;
};

export default function SegmentHeatmapPlot({ data, onCellClick }: SegmentHeatmapPlotProps) {
  const colors = getChartColors();
  const z = data.matrix.map((row) =>
    row.map((value) => (value === null ? null : value)),
  );

  const hoverText = data.matrix.map((row, rowIndex) =>
    row.map((value, colIndex) => {
      const count = data.counts[rowIndex]?.[colIndex] ?? 0;
      if (value === null || count === 0) return "No subscribers";
      return (
        `Contract: ${data.contracts[rowIndex]}<br>` +
        `Tenure: ${data.tenure_bins[colIndex]} mo<br>` +
        `Avg churn: ${(value * 100).toFixed(1)}%<br>` +
        `Count: ${count}`
      );
    }),
  );

  return (
    <Plot
      data={[
        {
          type: "heatmap",
          x: data.tenure_bins.map((b) => `${b} mo`),
          y: data.contracts,
          z,
          text: hoverText,
          hoverinfo: "text",
          colorscale: [
            [0, colors.low],
            [0.5, colors.medium],
            [1, colors.high],
          ],
          zmin: 0,
          zmax: 1,
          colorbar: {
            title: { text: "Churn prob" },
            tickformat: ".0%",
          },
        },
      ]}
      layout={getPlotlyLayout({
        height: 300,
        margin: { l: 120, r: 48, t: 16, b: 56 },
        xaxis: { title: { text: "Tenure bin" }, side: "bottom" },
        yaxis: { automargin: true, title: { text: "Contract type" } },
      })}
      config={PLOTLY_CONFIG}
      style={{ width: "100%", height: "100%" }}
      useResizeHandler
      onClick={(event) => {
        if (!onCellClick || !event.points?.length) return;
        const point = event.points[0];
        const rowIndex =
          typeof point.y === "number" ? point.y : data.contracts.indexOf(String(point.y));
        const colIndex =
          typeof point.x === "number"
            ? point.x
            : data.tenure_bins.findIndex((bin) => `${bin} mo` === String(point.x));
        if (rowIndex < 0 || colIndex < 0) return;
        const contract = data.contracts[rowIndex];
        const tenureBin = data.tenure_bins[colIndex];
        const count = data.counts[rowIndex]?.[colIndex] ?? 0;
        if (!contract || !tenureBin || count === 0) return;
        onCellClick(contract, tenureBin);
      }}
    />
  );
}
