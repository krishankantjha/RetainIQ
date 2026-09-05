import type { ShapDriver } from "@/lib/api";
import { formatFeatureName } from "@/lib/format";

type ShapDriversChartProps = {
  drivers: ShapDriver[];
};

export default function ShapDriversChart({ drivers }: ShapDriversChartProps) {
  const sorted = [...drivers].sort(
    (a, b) => Math.abs(b.shap_value) - Math.abs(a.shap_value),
  );
  const top = sorted.slice(0, 10);
  const maxAbs = top.length > 0 ? Math.max(...top.map((d) => Math.abs(d.shap_value))) : 1;

  if (top.length === 0) {
    return <p className="text-sm text-muted-foreground">No SHAP drivers available.</p>;
  }

  return (
    <ul className="space-y-3">
      {top.map((driver) => {
        const positive = driver.shap_value >= 0;
        const width = (Math.abs(driver.shap_value) / maxAbs) * 100;
        return (
          <li key={driver.feature}>
            <div className="mb-1 flex justify-between gap-2 text-sm">
              <span className="truncate font-medium" title={driver.feature}>
                {formatFeatureName(driver.feature)}
              </span>
              <span className={positive ? "text-risk-high" : "text-risk-low"}>
                {driver.shap_value >= 0 ? "+" : ""}
                {driver.shap_value.toFixed(3)}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface-high">
              <div
                className={`h-full rounded-full ${positive ? "bg-risk-high" : "bg-risk-low"}`}
                style={{ width: `${width}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
