import { lazy, Suspense, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import UploadHistoryTable from "@/components/analytics/UploadHistoryTable";
import PersonaSummaryCards from "@/components/analytics/PersonaSummary";
import EmptyCohortBanner from "@/components/dashboard/EmptyCohortBanner";
import { AnalyticsPageSkeleton } from "@/components/ui/PageSkeleton";
import {
  fetchGlobalDrivers,
  fetchOverview,
  fetchPersonas,
  fetchRiskTrend,
  fetchSegmentMatrix,
  fetchUploadHistory,
  type GlobalDriver,
  type PersonaSummary,
  type RiskTrendPoint,
  type SegmentMatrix,
  type UploadRecord,
} from "@/lib/api";
import { formatNumber } from "@/lib/format";

const AnalyticsCharts = lazy(() => import("@/components/analytics/AnalyticsCharts"));

export default function AnalyticsPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasCohort, setHasCohort] = useState(false);

  const [riskTrend, setRiskTrend] = useState<RiskTrendPoint[]>([]);
  const [drivers, setDrivers] = useState<GlobalDriver[]>([]);
  const [segmentMatrix, setSegmentMatrix] = useState<SegmentMatrix | null>(null);
  const [personas, setPersonas] = useState<PersonaSummary[]>([]);
  const [uploads, setUploads] = useState<UploadRecord[]>([]);
  const [subscriberCount, setSubscriberCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const overview = await fetchOverview();
        if (cancelled) return;

        const cohortLoaded = overview.total_customers > 0;
        setHasCohort(cohortLoaded);

        const [trendData, driversData, matrixData, personaData, uploadData] = await Promise.all([
          fetchRiskTrend(),
          cohortLoaded ? fetchGlobalDrivers() : Promise.resolve({ drivers: [], subscriber_count: 0 }),
          cohortLoaded ? fetchSegmentMatrix() : Promise.resolve(null),
          cohortLoaded ? fetchPersonas() : Promise.resolve({ personas: [], total_subscribers: 0 }),
          fetchUploadHistory(),
        ]);

        if (cancelled) return;

        setRiskTrend(trendData.points);
        setDrivers(driversData.drivers);
        setSubscriberCount(driversData.subscriber_count);
        setSegmentMatrix(matrixData);
        setPersonas(personaData.personas);
        setUploads(uploadData);
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Failed to load analytics";
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

  const matrixEmpty =
    !segmentMatrix ||
    segmentMatrix.contracts.length === 0 ||
    segmentMatrix.cells.length === 0;

  if (loading) {
    return <AnalyticsPageSkeleton />;
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Analyst workspace — subscriber trends by scoring batch, global SHAP drivers, and contract × tenure
        segmentation from your last upload.
      </p>

      {error && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {!error && !hasCohort && <EmptyCohortBanner />}

      {!error && hasCohort && (
        <p className="text-sm text-muted-foreground">
          Global drivers aggregated across {formatNumber(subscriberCount)} scored subscribers.
        </p>
      )}

      {!error && hasCohort && (
        <div className="dash-card p-5">
          <h2 className="text-base font-semibold">ML clusters</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            K-means groups from the autoencoder latent space — click a cluster to filter the explorer
          </p>
          <div className="mt-4">
            <PersonaSummaryCards personas={personas} />
          </div>
        </div>
      )}

      {!error && (
        <>
          <Suspense fallback={<AnalyticsPageSkeleton />}>
            <AnalyticsCharts
              riskTrend={riskTrend}
              drivers={drivers}
              segmentMatrix={segmentMatrix}
              matrixEmpty={matrixEmpty}
            />
          </Suspense>

          <div className="dash-card p-5">
            <h2 className="text-base font-semibold">Upload history</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Recent CSV ingestion jobs and processing status
            </p>
            <div className="mt-4">
              <UploadHistoryTable uploads={uploads} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
