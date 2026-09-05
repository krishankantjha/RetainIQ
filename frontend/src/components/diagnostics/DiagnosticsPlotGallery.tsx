import { useEffect, useState } from "react";

import { fetchDiagnosticPlotBlobUrl, fetchDiagnosticPlots, type DiagnosticPlot } from "@/lib/api";

type PlotImageProps = {
  plot: DiagnosticPlot;
};

function PlotImage({ plot }: PlotImageProps) {
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!plot.available) return;

    let cancelled = false;
    let objectUrl: string | null = null;

    fetchDiagnosticPlotBlobUrl(plot.id)
      .then((url) => {
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        objectUrl = url;
        setSrc(url);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [plot.id, plot.available]);

  if (!plot.available) {
    return (
      <div className="flex aspect-[4/3] items-center justify-center rounded-lg border border-dashed border-border bg-surface-high/20 text-xs text-muted-foreground">
        Plot not generated
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex aspect-[4/3] items-center justify-center rounded-lg border border-border bg-surface-high/20 text-xs text-destructive">
        Failed to load
      </div>
    );
  }

  if (!src) {
    return (
      <div className="aspect-[4/3] animate-pulse rounded-lg bg-surface-high/50" />
    );
  }

  return (
    <img
      src={src}
      alt={plot.title}
      className="w-full rounded-lg border border-border/70 bg-white object-contain"
      loading="lazy"
    />
  );
}

export default function DiagnosticsPlotGallery() {
  const [plots, setPlots] = useState<DiagnosticPlot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDiagnosticPlots()
      .then(setPlots)
      .catch(() => setPlots([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading evaluation plots…</p>;
  }

  if (plots.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No diagnostic plots found. Run model training to generate artifacts under ml/artifacts/plots/.
      </p>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {plots.map((plot) => (
        <figure key={plot.id} className="space-y-2">
          <figcaption className="text-sm font-medium">{plot.title}</figcaption>
          <PlotImage plot={plot} />
        </figure>
      ))}
    </div>
  );
}
