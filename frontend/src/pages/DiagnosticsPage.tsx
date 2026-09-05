import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Activity, AlertTriangle, CheckCircle2 } from "lucide-react";

import DriftFeatureTable from "@/components/diagnostics/DriftFeatureTable";
import DiagnosticsPlotGallery from "@/components/diagnostics/DiagnosticsPlotGallery";
import ModelStatusCard from "@/components/dashboard/ModelStatusCard";
import { AnalyticsPageSkeleton } from "@/components/ui/PageSkeleton";
import {
  fetchDiagnostics,
  fetchModelHealth,
  type DiagnosticsMetadata,
  type ModelHealth,
} from "@/lib/api";
import { formatPercent } from "@/lib/format";

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/70 bg-surface-high/20 px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function diagnosticsBannerCopy(
  artifactMismatch: boolean,
  cohortDrift: boolean,
  healthMessage?: string | null,
  metadataMessage?: string | null,
) {
  if (artifactMismatch && cohortDrift) {
    return {
      title: "Review recommended",
      body:
        "Model artifact checksum mismatch and uploaded cohort differs from the training baseline. See details below.",
    };
  }
  if (artifactMismatch) {
    return {
      title: "Artifact checksum mismatch",
      body: metadataMessage ?? "Loaded model file does not match diagnostics metadata.",
    };
  }
  if (cohortDrift) {
    return {
      title: "Cohort differs from training baseline",
      body:
        healthMessage ??
        "Statistical tests compare your scored upload to the model training split. Differences are common when using the full IBM Telco CSV.",
    };
  }
  return {
    title: "Artifacts verified",
    body: "Model files match diagnostics metadata. No cohort-vs-training distribution flags on the latest check.",
  };
}

export default function DiagnosticsPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [diagnostics, setDiagnostics] = useState<DiagnosticsMetadata | null>(null);
  const [health, setHealth] = useState<ModelHealth | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setHealthError(null);

      try {
        const diagnosticsData = await fetchDiagnostics();
        if (cancelled) return;
        setDiagnostics(diagnosticsData);

        try {
          const healthData = await fetchModelHealth();
          if (!cancelled) setHealth(healthData);
        } catch (err) {
          if (!cancelled) {
            setHealthError(err instanceof Error ? err.message : "Model health unavailable");
          }
        }
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Failed to load diagnostics";
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

  if (loading) {
    return <AnalyticsPageSkeleton />;
  }

  const holdout = diagnostics?.holdout_metrics ?? health?.metrics;
  const artifactMismatch = diagnostics?.drift_detected === true;
  const cohortDrift = health?.drift_detected === true;
  const needsAttention = artifactMismatch || cohortDrift;
  const banner = diagnosticsBannerCopy(
    artifactMismatch,
    cohortDrift,
    health?.message,
    diagnostics?.message,
  );

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Model artifact verification, frozen holdout metrics, and cohort-vs-training distribution
        checks on your last scored upload.
      </p>

      {error && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {!error && (
        <>
          <div
            className={`dash-card flex items-start gap-3 p-5 ${
              needsAttention ? "border-risk-high/40 bg-risk-high/5" : "border-risk-low/30 bg-risk-low/5"
            }`}
          >
            {needsAttention ? (
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-risk-high" />
            ) : (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-risk-low" />
            )}
            <div>
              <p className="font-semibold">{banner.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{banner.body}</p>
            </div>
          </div>

          <section className="grid gap-6 xl:grid-cols-2">
            <ModelStatusCard
              diagnostics={diagnostics}
              health={health}
              healthError={healthError}
            />

            <div className="dash-card p-5">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary-soft" />
                <h2 className="text-base font-semibold">Holdout performance</h2>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Evaluation metrics from the frozen training holdout set (not your upload)
              </p>
              {holdout ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <MetricTile
                    label="ROC AUC"
                    value={formatPercent(holdout.roc_auc ?? holdout.roc_auc_score ?? 0, 1)}
                  />
                  <MetricTile
                    label="F1 score"
                    value={formatPercent(holdout.f1 ?? holdout.f1_score ?? 0, 1)}
                  />
                  <MetricTile
                    label="Accuracy"
                    value={formatPercent(holdout.accuracy ?? 0, 1)}
                  />
                </div>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">Holdout metrics unavailable.</p>
              )}

              <dl className="mt-5 space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Artifact evaluated</dt>
                  <dd>{diagnostics?.evaluation_timestamp ?? "—"}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Decision threshold</dt>
                  <dd>
                    {diagnostics?.decision_threshold !== undefined
                      ? formatPercent(diagnostics.decision_threshold, 0)
                      : "—"}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Model SHA-256</dt>
                  <dd className="max-w-[14rem] truncate font-mono text-xs">
                    {diagnostics?.actual_model_sha256 ?? diagnostics?.model_sha256 ?? "—"}
                  </dd>
                </div>
              </dl>
            </div>
          </section>

          <div className="dash-card p-5">
            <h2 className="text-base font-semibold">Cohort vs training baseline</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              KS and PSI tests comparing your scored upload to the model training reference — not
              ongoing production monitoring. Full demo CSV uploads often differ from the training
              split by design.
            </p>
            <div className="mt-4">
              <DriftFeatureTable driftDetails={health?.drift_details} />
            </div>
          </div>

          <div className="dash-card p-5">
            <h2 className="text-base font-semibold">Evaluation plots</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              ROC, calibration, SHAP, and threshold analysis from the training pipeline
            </p>
            <div className="mt-4">
              <DiagnosticsPlotGallery />
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            For subscriber trends and segmentation, see{" "}
            <Link to="/analytics" className="font-medium text-primary-soft hover:underline">
              Trends
            </Link>
            .
          </p>
        </>
      )}
    </div>
  );
}
