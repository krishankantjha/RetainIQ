import type { DiagnosticsMetadata, ModelHealth } from "@/lib/api";

type ModelStatusCardProps = {
  diagnostics: DiagnosticsMetadata | null;
  health: ModelHealth | null;
  healthError?: string | null;
};

export default function ModelStatusCard({
  diagnostics,
  health,
  healthError,
}: ModelStatusCardProps) {
  const artifactMismatch = diagnostics?.drift_detected === true;
  const cohortDrift = health?.drift_detected === true;

  return (
    <div className="dash-card p-4 sm:p-5">
      <h2 className="text-sm font-semibold tracking-tight">Model status</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Artifact integrity and cohort distribution vs training baseline
      </p>

      <dl className="mt-5 space-y-3 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Model version</dt>
          <dd className="font-medium">
            {health?.model_version ?? diagnostics?.model_version ?? "—"}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Diagnostics version</dt>
          <dd className="font-medium">{diagnostics?.diagnostics_version ?? "—"}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">System health</dt>
          <dd className="font-medium">{health?.status ?? "—"}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Artifact checksum</dt>
          <dd className="font-medium">
            {diagnostics?.drift_detected === undefined
              ? "—"
              : artifactMismatch
                ? "Mismatch"
                : "Match"}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Cohort vs training</dt>
          <dd className="font-medium">
            {health?.drift_detected === undefined
              ? "—"
              : cohortDrift
                ? "Differs"
                : "Aligned"}
          </dd>
        </div>
        {health?.drift_ratio !== undefined && (
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Feature diff ratio</dt>
            <dd className="font-medium">{health.drift_ratio.toFixed(3)}</dd>
          </div>
        )}
      </dl>

      {(health?.message || diagnostics?.message || healthError) && (
        <p className="mt-4 rounded-lg border border-border bg-surface-high/50 px-3 py-2 text-xs text-muted-foreground">
          {healthError ?? health?.message ?? diagnostics?.message}
        </p>
      )}
    </div>
  );
}
