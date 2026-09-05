import { Link } from "react-router-dom";
import { Users } from "lucide-react";

import type { PersonaSummary } from "@/lib/api";
import { formatNumber, formatPercent } from "@/lib/format";

type PersonaSummaryProps = {
  personas: PersonaSummary[];
};

function personaShortLabel(persona: string): string {
  const colon = persona.indexOf(":");
  return colon >= 0 ? persona.slice(colon + 1).trim() : persona;
}

export default function PersonaSummaryCards({ personas }: PersonaSummaryProps) {
  if (personas.length === 0) {
    return (
      <div className="dash-card p-6 text-center text-sm text-muted-foreground">
        Persona clusters appear after subscribers are scored.
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {personas.map((persona) => {
        const clusterParam =
          persona.cluster_id === null ? "" : `cluster=${persona.cluster_id}`;
        const to = clusterParam ? `/explorer?${clusterParam}` : "/explorer";

        return (
          <Link
            key={persona.cluster_id ?? "unassigned"}
            to={to}
            className="dash-card dash-card-interactive block p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {persona.cluster_id === null
                    ? "Unassigned"
                    : `Cluster ${persona.cluster_id}`}
                </p>
                <p className="mt-1 text-sm font-semibold leading-snug">
                  {personaShortLabel(persona.persona)}
                </p>
              </div>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary-soft">
                <Users className="h-4 w-4" />
              </span>
            </div>

            <dl className="mt-4 grid grid-cols-3 gap-2 text-xs">
              <div>
                <dt className="text-muted-foreground">Subscribers</dt>
                <dd className="mt-0.5 font-semibold">
                  {formatNumber(persona.subscriber_count)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Avg churn</dt>
                <dd className="mt-0.5 font-semibold">
                  {formatPercent(persona.average_churn_probability, 1)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Above threshold</dt>
                <dd className="mt-0.5 font-semibold">
                  {formatNumber(persona.high_risk_count)}
                </dd>
              </div>
            </dl>
          </Link>
        );
      })}
    </div>
  );
}
