import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Download, FlaskConical } from "lucide-react";

import RiskBadge from "@/components/RiskBadge";
import { TableSkeleton } from "@/components/ui/PageSkeleton";
import { fetchAllCohortData, fetchCohortData, type CohortRow } from "@/lib/api";
import { downloadCohortCsv } from "@/lib/exportCsv";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";

const PAGE_SIZE = 100;
const AT_RISK_FILTERS = {
  high_risk: true,
  sort_by: "churn_probability" as const,
  sort_dir: "desc" as const,
};

export default function AtRiskPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<CohortRow[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError(null);

    fetchCohortData(page, PAGE_SIZE, AT_RISK_FILTERS)
      .then((data) => {
        if (cancelled) return;
        setRows(data.items);
        setTotal(data.total);
        setTotalPages(data.total_pages);
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
  }, [navigate, page]);

  const exportCsv = async () => {
    setExporting(true);
    try {
      const allRows = await fetchAllCohortData(1000, AT_RISK_FILTERS);
      downloadCohortCsv(allRows, "retainiq-at-risk.csv");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {formatNumber(total)} subscribers at or above the decision threshold (≥15%)
        </p>
        <button
          type="button"
          onClick={exportCsv}
          disabled={total === 0 || exporting}
          className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-surface-low disabled:opacity-40"
        >
          <Download className="h-4 w-4" />
          {exporting ? "Exporting…" : "Export CSV"}
        </button>
      </div>

      {loading && <TableSkeleton />}

      {error && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {!loading && !error && total === 0 && (
        <div className="dash-card p-8 text-center">
          <p className="text-muted-foreground">No subscribers above the decision threshold.</p>
          <Link to="/upload" className="mt-3 inline-block text-sm font-medium text-primary-soft hover:underline">
            Upload subscribers →
          </Link>
        </div>
      )}

      {!loading && !error && total > 0 && (
        <>
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
                {rows.map((row) => (
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
                      <RiskBadge churnProbability={row.churn_probability} />
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

          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-3 text-sm">
              <p className="text-muted-foreground">
                Page {page} of {totalPages} · showing {formatNumber(rows.length)} of {formatNumber(total)}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 hover:bg-surface-low disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 hover:bg-surface-low disabled:opacity-40"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
