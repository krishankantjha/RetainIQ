type SkeletonProps = {
  className?: string;
};

function Bone({ className = "" }: SkeletonProps) {
  return <div className={`animate-pulse rounded-md bg-surface-high/80 ${className}`} />;
}

export function MetricCardsSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="dash-card p-5">
          <Bone className="h-3 w-24" />
          <Bone className="mt-3 h-8 w-20" />
          <Bone className="mt-2 h-3 w-32" />
        </div>
      ))}
    </div>
  );
}

export function ChartGridSkeleton({ count = 2 }: { count?: number }) {
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="dash-card p-5">
          <Bone className="h-4 w-40" />
          <Bone className="mt-2 h-3 w-56" />
          <Bone className="mt-5 h-64 w-full" />
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="dash-card overflow-hidden p-4">
      <Bone className="mb-4 h-4 w-full max-w-md" />
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <Bone key={i} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}

export function AnalyticsPageSkeleton() {
  return (
    <div className="space-y-6">
      <Bone className="h-4 w-full max-w-2xl" />
      <ChartGridSkeleton />
      <div className="dash-card p-5">
        <Bone className="h-4 w-40" />
        <Bone className="mt-2 h-3 w-64" />
        <Bone className="mt-5 h-72 w-full" />
      </div>
    </div>
  );
}
