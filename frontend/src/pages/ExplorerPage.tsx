import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, Download, FlaskConical } from "lucide-react";

import ExplorerFilters from "@/components/explorer/ExplorerFilters";
import RiskBadge from "@/components/RiskBadge";
import { TableSkeleton } from "@/components/ui/PageSkeleton";
import {
  fetchAllCohortData,
  fetchCohortData,
  fetchPersonas,
  type CohortFilters,
  type CohortRow,
  type CohortSortField,
  type PersonaSummary,
} from "@/lib/api";
import { downloadCohortCsv } from "@/lib/exportCsv";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";

const PAGE_SIZE = 50;

function parseFilters(searchParams: URLSearchParams): CohortFilters {
  const clusterRaw = searchParams.get("cluster");
  const minChurnRaw = searchParams.get("min_churn");
  const maxChurnRaw = searchParams.get("max_churn");
  const sortBy = searchParams.get("sort_by") as CohortSortField | null;

  return {
    high_risk: searchParams.get("high_risk") === "1" ? true : undefined,
    contract: searchParams.get("contract") || undefined,
    cluster: clusterRaw !== null && clusterRaw !== "" ? Number(clusterRaw) : undefined,
    campaign: searchParams.get("campaign") || undefined,
    tenure_bin: searchParams.get("tenure_bin") || undefined,
    min_churn: minChurnRaw ? Number(minChurnRaw) : undefined,
    max_churn: maxChurnRaw ? Number(maxChurnRaw) : undefined,
    sort_by: sortBy ?? "churn_probability",
    sort_dir: searchParams.get("sort_dir") === "asc" ? "asc" : "desc",
  };
}

function filtersToSearchParams(
  page: number,
  filters: CohortFilters,
): URLSearchParams {
  const params = new URLSearchParams();
  if (page > 1) params.set("page", String(page));
  if (filters.high_risk) params.set("high_risk", "1");
  if (filters.contract) params.set("contract", filters.contract);
  if (filters.cluster !== undefined) params.set("cluster", String(filters.cluster));
  if (filters.campaign) params.set("campaign", filters.campaign);
  if (filters.tenure_bin) params.set("tenure_bin", filters.tenure_bin);
  if (filters.min_churn !== undefined) params.set("min_churn", String(filters.min_churn));
  if (filters.max_churn !== undefined) params.set("max_churn", String(filters.max_churn));
  if (filters.sort_by && filters.sort_by !== "churn_probability") {
    params.set("sort_by", filters.sort_by);
  }
  if (filters.sort_dir === "asc") params.set("sort_dir", "asc");
  return params;
}

function personaShortLabel(persona: string | null): string {
  if (!persona) return "—";
  const colon = persona.indexOf(":");
  return colon >= 0 ? persona.slice(colon + 1).trim() : persona;
}

export default function ExplorerPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const filters = useMemo(() => parseFilters(searchParams), [searchParams]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<CohortRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [personas, setPersonas] = useState<PersonaSummary[]>([]);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchPersonas()
      .then((data) => setPersonas(data.personas))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchCohortData(page, PAGE_SIZE, filters)
      .then((data) => {
        if (cancelled) return;
        setRows(data.items);
        setTotal(data.total);
        setTotalPages(data.total_pages);
      })
      .catch((err) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Failed to load subscribers";
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
  }, [page, filters, navigate]);

  const updateFilters = (next: CohortFilters) => {
    setSearchParams(filtersToSearchParams(1, next));
  };

  const clearFilters = () => {
    setSearchParams(new URLSearchParams());
  };

  const setPage = (next: number) => {
    setSearchParams(filtersToSearchParams(next, filters));
  };

  const toggleSort = (key: CohortSortField) => {
    const currentSort = filters.sort_by ?? "churn_probability";
    const currentDir = filters.sort_dir ?? "desc";
    const next: CohortFilters = { ...filters, sort_by: key };
    if (currentSort === key) {
      next.sort_dir = currentDir === "asc" ? "desc" : "asc";
    } else {
      next.sort_dir = key === "customer_id" ? "asc" : "desc";
    }
    setSearchParams(filtersToSearchParams(1, next));
  };

  const sortIndicator = (key: CohortSortField) => {
    if (filters.sort_by !== key) return "";
    return filters.sort_dir === "asc" ? " ↑" : " ↓";
  };

  const exportAllCsv = async () => {
    setExporting(true);
    try {
      const allRows = await fetchAllCohortData(1000, filters);
      const suffix = filters.campaign ? `-${filters.campaign.replace(/\s+/g, "-").toLowerCase()}` : "";
      downloadCohortCsv(allRows, `retainiq-cohort${suffix}.csv`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Export failed";
      if (message === "Session expired") {
        navigate("/", { replace: true });
        return;
      }
      setError(message);
    } finally {
      setExporting(false);
    }
  };

  const exportPageCsv = () => {
    downloadCohortCsv(rows, `retainiq-cohort-page-${page}.csv`);
  };

  const filterSummary = [
    filters.high_risk ? "high risk" : null,
    filters.contract,
    filters.cluster !== undefined ? `cluster ${filters.cluster}` : null,
    filters.campaign ? `campaign: ${filters.campaign}` : null,
    filters.tenure_bin ? `tenure ${filters.tenure_bin}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="space-y-4">
      <ExplorerFilters
        filters={filters}
        personas={personas}
        onChange={updateFilters}
        onClear={clearFilters}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {formatNumber(total)} subscribers match
          {filterSummary ? ` (${filterSummary})` : ""}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={exportPageCsv}
            disabled={total === 0 || rows.length === 0}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-surface-low disabled:opacity-40"
          >
            <Download className="h-4 w-4" />
            Export page
          </button>
          <button
            type="button"
            onClick={exportAllCsv}
            disabled={total === 0 || exporting}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-surface-low disabled:opacity-40"
          >
            {exporting ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Export all
          </button>
        </div>
      </div>

      {loading && <TableSkeleton />}

      {error && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {!loading && !error && total === 0 && (
        <div className="dash-card p-8 text-center">
          <p className="text-muted-foreground">No subscribers match these filters.</p>
          <button
            type="button"
            onClick={clearFilters}
            className="mt-3 text-sm font-medium text-primary-soft hover:underline"
          >
            Clear filters
          </button>
          <span className="mx-2 text-muted-foreground">or</span>
          <Link to="/upload" className="text-sm font-medium text-primary-soft hover:underline">
            Upload subscribers →
          </Link>
        </div>
      )}

      {!loading && !error && total > 0 && (
        <>
          <div className="dash-card overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th
                    className="cursor-pointer px-4 py-3 font-medium"
                    onClick={() => toggleSort("customer_id")}
                  >
                    Customer ID{sortIndicator("customer_id")}
                  </th>
                  <th className="px-4 py-3 font-medium">Cluster</th>
                  <th className="px-4 py-3 font-medium">Contract</th>
                  <th
                    className="cursor-pointer px-4 py-3 font-medium"
                    onClick={() => toggleSort("tenure")}
                  >
                    Tenure{sortIndicator("tenure")}
                  </th>
                  <th
                    className="cursor-pointer px-4 py-3 font-medium"
                    onClick={() => toggleSort("monthly_charges")}
                  >
                    Monthly{sortIndicator("monthly_charges")}
                  </th>
                  <th
                    className="cursor-pointer px-4 py-3 font-medium"
                    onClick={() => toggleSort("churn_probability")}
                  >
                    Churn prob.{sortIndicator("churn_probability")}
                  </th>
                  <th className="px-4 py-3 font-medium">Band</th>
                  <th className="px-4 py-3 font-medium">What-if</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.customer_id}
                    className="border-b border-border/60 last:border-0 hover:bg-surface-high/40"
                  >
                    <td className="px-4 py-3">
                      <Link
                        to={`/subscribers/${encodeURIComponent(row.customer_id)}`}
                        className="font-medium text-primary-soft hover:underline"
                      >
                        {row.customer_id}
                      </Link>
                    </td>
                    <td className="max-w-[10rem] truncate px-4 py-3 text-xs text-muted-foreground" title={row.cohort_persona ?? undefined}>
                      {personaShortLabel(row.cohort_persona)}
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

          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-4">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" /> Previous
              </button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-40"
              >
                Next <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
