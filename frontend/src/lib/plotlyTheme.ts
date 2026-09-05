import type { Layout } from "plotly.js";

import { getChartColors } from "@/lib/chartTheme";

export function getPlotlyLayout(overrides?: Partial<Layout>): Partial<Layout> {
  const colors = getChartColors();

  return {
    autosize: true,
    margin: { l: 52, r: 24, t: 16, b: 52 },
    paper_bgcolor: "transparent",
    plot_bgcolor: "transparent",
    font: {
      family: "inherit",
      color: colors.foreground,
      size: 12,
    },
    xaxis: {
      gridcolor: colors.border,
      zerolinecolor: colors.border,
      tickcolor: colors.muted,
    },
    yaxis: {
      gridcolor: colors.border,
      zerolinecolor: colors.border,
      tickcolor: colors.muted,
    },
    colorway: [colors.primary, colors.high, colors.medium, colors.low],
    ...overrides,
  };
}

export const PLOTLY_CONFIG = {
  displayModeBar: false,
  responsive: true,
} as const;
