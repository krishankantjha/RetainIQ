import type { DriftFeatureDetail } from "@/lib/api";
import { formatFeatureName } from "@/lib/format";

type DriftFeatureTableProps = {
  driftDetails: Record<string, DriftFeatureDetail> | undefined;
};

export default function DriftFeatureTable({ driftDetails }: DriftFeatureTableProps) {
  const rows = Object.entries(driftDetails ?? {});

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No per-feature drift statistics available. Upload and score subscribers to compare against the training baseline.
      </p>
    );
  }

  const driftedCount = rows.filter(([, detail]) => detail.drifted).length;

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {driftedCount} of {rows.length} monitored features flagged as drifted
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="px-3 py-2 font-medium">Feature</th>
              <th className="px-3 py-2 font-medium">Method</th>
              <th className="px-3 py-2 font-medium">p-value</th>
              <th className="px-3 py-2 font-medium">PSI</th>
              <th className="px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([feature, detail]) => (
              <tr key={feature} className="border-b border-border/60 last:border-0">
                <td className="px-3 py-2 font-medium">{formatFeatureName(feature)}</td>
                <td className="px-3 py-2 text-muted-foreground">{detail.method ?? "—"}</td>
                <td className="px-3 py-2 tabular-nums text-muted-foreground">
                  {detail.p_value !== undefined ? detail.p_value.toFixed(4) : "—"}
                </td>
                <td className="px-3 py-2 tabular-nums text-muted-foreground">
                  {detail.psi !== undefined ? detail.psi.toFixed(3) : "—"}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={
                      detail.drifted
                        ? "font-medium text-risk-high"
                        : "text-risk-low"
                    }
                  >
                    {detail.drifted ? "Drifted" : "Stable"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
