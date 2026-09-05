import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  DollarSign,
  FlaskConical,
  ShieldAlert,
  Users,
  TrendingDown,
} from "lucide-react";

import ChurnHistogramChart from "@/components/charts/ChurnHistogramChart";
import ContractRiskChart from "@/components/charts/ContractRiskChart";
import TenureRiskChart from "@/components/charts/TenureRiskChart";
import EmptyCohortBanner from "@/components/dashboard/EmptyCohortBanner";
import MetricCard from "@/components/dashboard/MetricCard";
import ModelStatusCard from "@/components/dashboard/ModelStatusCard";
import Tooltip from "@/components/ui/Tooltip";
import { ChartGridSkeleton, MetricCardsSkeleton } from "@/components/ui/PageSkeleton";
import {
  buildChurnHistogram,
  buildContractRiskStacked,
  buildTenureRiskBins,
} from "@/lib/aggregates";
import { actionableHighCount, buildRiskDistribution } from "@/lib/riskBands";
import {
  fetchAllCohortData,
  fetchDiagnostics,
  fetchModelHealth,
  fetchOverview,
  type CohortRow,
  type DiagnosticsMetadata,
  type ModelHealth,
  type Overview,
} from "@/lib/api";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import { PRODUCT_TOOLTIPS } from "@/lib/productTooltips";

export default function DashboardPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [overview, setOverview] = useState<Overview | null>(null);
  const [cohortRows, setCohortRows] = useState<CohortRow[]>([]);
  const [diagnostics, setDiagnostics] = useState<DiagnosticsMetadata | null>(null);
  const [modelHealth, setModelHealth] = useState<ModelHealth | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setHealthError(null);

      try {
        const overviewData = await fetchOverview();
        if (cancelled) return;
        setOverview(overviewData);

        const cohortData =
          overviewData.total_customers > 0 ? await fetchAllCohortData() : [];
        const diagnosticsData = await fetchDiagnostics();

        if (cancelled) return;
        setCohortRows(cohortData);
        setDiagnostics(diagnosticsData);

        if (overviewData.total_customers > 0) {
          try {
            const healthData = await fetchModelHealth();
            if (!cancelled) setModelHealth(healthData);
          } catch (err) {
            if (!cancelled) {
              setHealthError(err instanceof Error ? err.message : "Model health unavailable");
            }
          }
        } else {
          setModelHealth(null);
        }
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Failed to load dashboard";
        if (message === "Session expired") {
          navigate("/", { replace: true });
          return;
        }
        setError(message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const histogram = useMemo(() => buildChurnHistogram(cohortRows), [cohortRows]);
  const contractRisk = useMemo(() => buildContractRiskStacked(cohortRows), [cohortRows]);
  const tenureRisk = useMemo(() => buildTenureRiskBins(cohortRows), [cohortRows]);

  const total = overview?.total_customers ?? 0;
  const risk = overview?.risk_distribution ?? { high: 0, medium: 0, low: 0 };
  const chartRisk = useMemo(() => buildRiskDistribution(cohortRows), [cohortRows]);
  const actionableHigh = overview?.risk_bands?.actionable_high ?? actionableHighCount(risk);
  const lowRiskShare = total > 0 ? risk.low / total : 0;
  const tiersAligned =
    cohortRows.length === 0 ||
    (chartRisk.low === risk.low &&
      chartRisk.medium === risk.medium &&
      chartRisk.high === risk.high);

  return (
    <>
      {loading && (
        <div className="space-y-6">
          <MetricCardsSkeleton />
          <ChartGridSkeleton />
        </div>
      )}

      {error && (
        <p className="mb-6 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {!loading && !error && overview && (
        <div className="space-y-6">
          {total === 0 && <EmptyCohortBanner />}

          <Tooltip content={PRODUCT_TOOLTIPS.dashboard} placement="top" className="block w-full">
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
                hint="Predicted churn ≥15% (decision threshold)"
                icon={ShieldAlert}
                accent="danger"
              />
              <MetricCard
                label="Medium band"
                value={formatNumber(risk.medium)}
                hint="15–25% predicted probability"
                icon={AlertTriangle}
                accent="warning"
                emptyState={risk.medium === 0}
              />
              <MetricCard
                label="Avg predicted churn"
                value={formatPercent(overview.average_churn_probability, 1)}
                icon={TrendingDown}
                accent="warning"
              />
              <MetricCard
                label="Flagged MRR"
                value={formatCurrency(overview.total_value_at_risk)}
                hint="Monthly charges for flagged, non-churned accounts"
                icon={DollarSign}
                accent="danger"
              />
            </section>
          </Tooltip>

          {total > 0 && (
            <p className="text-sm text-muted-foreground">
              Low-risk share: {formatPercent(lowRiskShare, 1)} ({formatNumber(risk.low)} subscribers)
              · Elevated (≥25%): {formatNumber(risk.high)}
              · Charts use all {formatNumber(cohortRows.length)} loaded records
              {!tiersAligned && (
                <span className="text-warning"> · Refresh if counts look stale</span>
              )}
            </p>
          )}

          <section className="grid gap-6 xl:grid-cols-2">
            <ChurnHistogramChart data={histogram} />
            <ContractRiskChart data={contractRisk} />
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <TenureRiskChart data={tenureRisk} />
            <ModelStatusCard
              diagnostics={diagnostics}
              health={modelHealth}
              healthError={healthError}
            />
          </section>

          {total > 0 && (
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {[
                { to: "/analytics", label: "Trends", desc: "Subscriber trends, SHAP drivers, segment heatmap" },
                { to: "/at-risk", label: "At-risk subscribers", desc: `${formatNumber(actionableHigh)} at or above 15% threshold` },
                { to: "/what-if", label: "What-if lab", desc: "Counterfactual churn simulations", icon: FlaskConical },
                { to: "/save-plays", label: "Suggested save plays", desc: "SHAP-based retention ideas" },
                { to: "/explorer", label: "Data explorer", desc: "Browse all scored subscribers" },
              ].map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="dash-card dash-card-interactive flex items-center justify-between gap-3 p-4"
                >
                  <div>
                    <p className="text-sm font-semibold">{item.label}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                  {"icon" in item && item.icon ? (
                    <item.icon className="h-4 w-4 shrink-0 text-primary-soft" />
                  ) : (
                    <ArrowRight className="h-4 w-4 shrink-0 text-primary-soft" />
                  )}
                </Link>
              ))}
            </section>
          )}
        </div>
      )}
    </>
  );
}
