import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Download, FlaskConical } from "lucide-react";

import RiskBadge from "@/components/RiskBadge";
import { TableSkeleton } from "@/components/ui/PageSkeleton";
import { fetchAllCohortData, type CohortRow } from "@/lib/api";
import { downloadCohortCsv } from "@/lib/exportCsv";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";

export default function AtRiskPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<CohortRow[]>([]);

  useEffect(() => {
    let cancelled = false;

    fetchAllCohortData()
      .then((data) => {
        if (!cancelled) setRows(data.filter((r) => r.is_high_risk));
      })
      .catch((err) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Failed to load at-risk subscribers";
        if (message === "Session expired") {
          navigate("/", { replace: true });
          return;
        }
        setError(message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const sorted = useMemo(
    () => [...rows].sort((a, b) => b.churn_probability - a.churn_probability),
    [rows],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {formatNumber(sorted.length)} subscribers at or above the decision threshold (≥15%)
        </p>
        <button
          type="button"
          onClick={() => downloadCohortCsv(sorted, "retainiq-at-risk.csv")}
          disabled={sorted.length === 0}
          className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-surface-low disabled:opacity-40"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </button>
      </div>

      {loading && <TableSkeleton />}

      {error && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {!loading && !error && sorted.length === 0 && (
        <div className="dash-card p-8 text-center">
          <p className="text-muted-foreground">No subscribers above the decision threshold.</p>
          <Link to="/upload" className="mt-3 inline-block text-sm font-medium text-primary-soft hover:underline">
            Upload subscribers →
          </Link>
        </div>
      )}

      {!loading && !error && sorted.length > 0 && (
        <div className="dash-card overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="px-4 py-3 font-medium">Customer ID</th>
                <th className="px-4 py-3 font-medium">Contract</th>
                <th className="px-4 py-3 font-medium">Tenure</th>
                <th className="px-4 py-3 font-medium">Monthly</th>
                <th className="px-4 py-3 font-medium">Churn prob.</th>
                <th className="px-4 py-3 font-medium">Band</th>
                <th className="px-4 py-3 font-medium">What-if</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => (
                <tr key={row.customer_id} className="border-b border-border/60 last:border-0 hover:bg-surface-high/40">
                  <td className="px-4 py-3">
                    <Link
                      to={`/subscribers/${encodeURIComponent(row.customer_id)}`}
                      className="font-medium text-primary-soft hover:underline"
                    >
                      {row.customer_id}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{row.contract}</td>
                  <td className="px-4 py-3 text-muted-foreground">{row.tenure} mo</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatCurrency(row.monthly_charges)}
                  </td>
                  <td className="px-4 py-3">{formatPercent(row.churn_probability, 1)}</td>
                  <td className="px-4 py-3">
                    <RiskBadge
                        churnProbability={row.churn_probability}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      to={`/subscribers/${encodeURIComponent(row.customer_id)}#counterfactual`}
                      className="inline-flex items-center gap-1 text-xs font-medium text-primary-soft hover:underline"
                      title="Open what-if editor"
                    >
                      <FlaskConical className="h-3.5 w-3.5" />
                      Simulate
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
