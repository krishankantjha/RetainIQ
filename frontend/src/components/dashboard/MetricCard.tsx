import type { LucideIcon } from "lucide-react";

type MetricCardProps = {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  accent?: "primary" | "danger" | "warning" | "success";
  emptyState?: boolean;
};

const accentClasses = {
  primary: "text-primary-soft bg-primary/10 ring-primary/25",
  danger: "text-risk-high bg-risk-high/10 ring-risk-high/25",
  warning: "text-risk-medium bg-risk-medium/10 ring-risk-medium/25",
  success: "text-risk-low bg-risk-low/10 ring-risk-low/25",
};

export default function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
  accent = "primary",
  emptyState = false,
}: MetricCardProps) {
  return (
    <article className="dash-card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p
            className={[
              "mt-1.5 text-2xl font-semibold tracking-tight",
              emptyState ? "text-muted-foreground/70" : "text-foreground",
            ].join(" ")}
          >
            {value}
          </p>
          {emptyState && (
            <p className="mt-1 text-xs text-risk-low">Healthy — no subscribers in this band</p>
          )}
          {hint && !emptyState && (
            <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
          )}
        </div>
        <span
          className={[
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1",
            accentClasses[accent],
            emptyState ? "opacity-60" : "",
          ].join(" ")}
        >
          <Icon className="h-4 w-4" />
        </span>
      </div>
    </article>
  );
}
