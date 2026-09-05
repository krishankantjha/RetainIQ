import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Download, DollarSign, FileText, ShieldAlert, TrendingUp, Users } from "lucide-react";

import ChurnHistogramChart from "@/components/charts/ChurnHistogramChart";
import ContractRiskChart from "@/components/charts/ContractRiskChart";
import TenureRiskChart from "@/components/charts/TenureRiskChart";
import MetricCard from "@/components/dashboard/MetricCard";
import SavePlaysTable from "@/components/save-plays/SavePlaysTable";
import EmptyCohortBanner from "@/components/dashboard/EmptyCohortBanner";
import { ChartGridSkeleton, MetricCardsSkeleton } from "@/components/ui/PageSkeleton";
import { buildChurnHistogram, buildContractRiskStacked, buildTenureRiskBins } from "@/lib/aggregates";
import { actionableHighCount } from "@/lib/riskBands";
import {
  fetchAllCohortData,
  fetchOverview,
  fetchSavePlays,
  type CohortRow,
  type Overview,
  type SavePlayStat,
} from "@/lib/api";
import { downloadCohortCsv } from "@/lib/exportCsv";
import { downloadExecutivePdf } from "@/lib/exportExecutivePdf";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";

export default function ExecutiveReportsPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [cohortRows, setCohortRows] = useState<CohortRow[]>([]);
  const [savePlays, setSavePlays] = useState<SavePlayStat[]>([]);
  const [exporting, setExporting] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const overviewData = await fetchOverview();
        if (cancelled) return;
        setOverview(overviewData);

        if (overviewData.total_customers > 0) {
          const [cohortData, playsData] = await Promise.all([
            fetchAllCohortData(),
            fetchSavePlays(),
          ]);
          if (cancelled) return;
          setCohortRows(cohortData);
          setSavePlays(playsData);
        } else {
          setCohortRows([]);
          setSavePlays([]);
        }
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Failed to load executive report";
        if (message === "Session expired") {
          navigate("/", { replace: true });
          return;
        }
        setError(message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const histogram = useMemo(() => buildChurnHistogram(cohortRows), [cohortRows]);
  const contractRisk = useMemo(() => buildContractRiskStacked(cohortRows), [cohortRows]);
  const tenureRisk = useMemo(() => buildTenureRiskBins(cohortRows), [cohortRows]);

  const totalMrr = useMemo(
    () => cohortRows.reduce((sum, row) => sum + row.monthly_charges, 0),
    [cohortRows],
  );

  const exportPdf = () => {
    if (!overview) return;
    setExportingPdf(true);
    try {
      downloadExecutivePdf({ overview, totalMrr, savePlays });
    } finally {
      setExportingPdf(false);
    }
  };

  const exportReport = async () => {
    setExporting(true);
    try {
      const stamp = new Date().toISOString().slice(0, 10);
      downloadCohortCsv(cohortRows, `retainiq-executive-report-${stamp}.csv`);
    } finally {
      setExporting(false);
    }
  };

  const total = overview?.total_customers ?? 0;
  const risk = overview?.risk_distribution ?? { high: 0, medium: 0, low: 0 };
  const actionableHigh = overview?.risk_bands?.actionable_high ?? actionableHighCount(risk);

  if (loading) {
    return (
      <div className="space-y-6">
        <MetricCardsSkeleton />
        <ChartGridSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Executive snapshot — portfolio KPIs, risk distribution, and intervention priorities.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={exportPdf}
            disabled={total === 0 || !overview || exportingPdf}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-surface-low disabled:opacity-60"
          >
            <FileText className="h-4 w-4" />
            {exportingPdf ? "Generating…" : "Download report (PDF)"}
          </button>
          <button
            type="button"
            onClick={exportReport}
            disabled={total === 0 || exporting}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            <Download className="h-4 w-4" />
            {exporting ? "Exporting…" : "Export CSV"}
          </button>
        </div>
      </div>

      {error && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {!error && total === 0 && <EmptyCohortBanner />}

      {!error && overview && total > 0 && (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <MetricCard
              label="Subscribers scored"
              value={formatNumber(total)}
              icon={Users}
              accent="primary"
            />
            <MetricCard
              label="Above threshold"
              value={formatNumber(actionableHigh)}
              hint="Predicted churn ≥15%"
              icon={ShieldAlert}
              accent="danger"
            />
            <MetricCard
              label="Avg predicted churn"
              value={formatPercent(overview.average_churn_probability, 1)}
              icon={TrendingUp}
              accent="warning"
            />
            <MetricCard
              label="Flagged MRR"
              value={formatCurrency(overview.total_value_at_risk)}
              hint="Monthly charges for flagged, non-churned accounts"
              icon={DollarSign}
              accent="danger"
            />
            <MetricCard
              label="Total MRR"
              value={formatCurrency(totalMrr)}
              hint="All scored subscribers"
              icon={DollarSign}
              accent="primary"
            />
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <ChurnHistogramChart data={histogram} />
            <ContractRiskChart data={contractRisk} />
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <TenureRiskChart data={tenureRisk} />
            <div className="dash-card p-5">
              <h2 className="text-base font-semibold">Risk band summary</h2>
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Low risk</dt>
                  <dd className="font-medium">{formatNumber(risk.low)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Medium risk (15–25%)</dt>
                  <dd className="font-medium">{formatNumber(risk.medium)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Elevated (≥25%)</dt>
                  <dd className="font-medium">{formatNumber(risk.high)}</dd>
                </div>
              </dl>
              <Link
                to="/at-risk"
                className="mt-4 inline-flex text-sm font-medium text-primary-soft hover:underline"
              >
                View at-risk subscribers →
              </Link>
            </div>
          </section>

          <div className="dash-card p-5">
            <h2 className="text-base font-semibold">Top suggested save plays</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Rule-based ideas from SHAP drivers — not executed campaigns
            </p>
            <div className="mt-4">
              <SavePlaysTable plays={savePlays} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
