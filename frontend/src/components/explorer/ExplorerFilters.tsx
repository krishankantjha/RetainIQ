import { X } from "lucide-react";

import type { CohortFilters, PersonaSummary } from "@/lib/api";

const CONTRACT_OPTIONS = ["", "Month-to-month", "One year", "Two year"];
const TENURE_BINS = ["", "0-12", "13-24", "25-36", "37-48", "49-60", "61+"];

type ExplorerFiltersProps = {
  filters: CohortFilters;
  personas: PersonaSummary[];
  onChange: (next: CohortFilters) => void;
  onClear: () => void;
};

function hasActiveFilters(filters: CohortFilters): boolean {
  return Boolean(
    filters.high_risk ||
      filters.contract ||
      filters.cluster !== undefined ||
      filters.campaign ||
      filters.tenure_bin ||
      filters.min_churn !== undefined ||
      filters.max_churn !== undefined,
  );
}

export default function ExplorerFilters({
  filters,
  personas,
  onChange,
  onClear,
}: ExplorerFiltersProps) {
  const active = hasActiveFilters(filters);

  return (
    <div className="dash-card space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">Filters</p>
        {active && (
          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
            Clear all
          </button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <label className="block text-xs">
          <span className="text-muted-foreground">Contract</span>
          <select
            value={filters.contract ?? ""}
            onChange={(e) =>
              onChange({ ...filters, contract: e.target.value || undefined })
            }
            className="mt-1 w-full rounded-lg border border-border bg-surface-low px-3 py-2 text-sm"
          >
            <option value="">All contracts</option>
            {CONTRACT_OPTIONS.filter(Boolean).map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-xs">
          <span className="text-muted-foreground">Persona cluster</span>
          <select
            value={filters.cluster ?? ""}
            onChange={(e) =>
              onChange({
                ...filters,
                cluster: e.target.value === "" ? undefined : Number(e.target.value),
              })
            }
            className="mt-1 w-full rounded-lg border border-border bg-surface-low px-3 py-2 text-sm"
          >
            <option value="">All personas</option>
            {personas
              .filter((p) => p.cluster_id !== null)
              .map((persona) => (
                <option key={persona.cluster_id} value={persona.cluster_id ?? ""}>
                  Cluster {persona.cluster_id}
                </option>
              ))}
          </select>
        </label>

        <label className="block text-xs">
          <span className="text-muted-foreground">Tenure bin</span>
          <select
            value={filters.tenure_bin ?? ""}
            onChange={(e) =>
              onChange({ ...filters, tenure_bin: e.target.value || undefined })
            }
            className="mt-1 w-full rounded-lg border border-border bg-surface-low px-3 py-2 text-sm"
          >
            <option value="">All tenure</option>
            {TENURE_BINS.filter(Boolean).map((bin) => (
              <option key={bin} value={bin}>
                {bin} months
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-end gap-2 text-sm">
          <input
            type="checkbox"
            checked={Boolean(filters.high_risk)}
            onChange={(e) =>
              onChange({ ...filters, high_risk: e.target.checked || undefined })
            }
            className="h-4 w-4 rounded border-border accent-primary"
          />
          <span>Above threshold only</span>
        </label>

        <label className="block text-xs">
          <span className="text-muted-foreground">Min churn %</span>
          <input
            type="number"
            min={0}
            max={100}
            step={1}
            value={filters.min_churn !== undefined ? Math.round(filters.min_churn * 100) : ""}
            onChange={(e) => {
              const raw = e.target.value;
              onChange({
                ...filters,
                min_churn: raw === "" ? undefined : Number(raw) / 100,
              });
            }}
            placeholder="0"
            className="mt-1 w-full rounded-lg border border-border bg-surface-low px-3 py-2 text-sm"
          />
        </label>

        <label className="block text-xs">
          <span className="text-muted-foreground">Max churn %</span>
          <input
            type="number"
            min={0}
            max={100}
            step={1}
            value={filters.max_churn !== undefined ? Math.round(filters.max_churn * 100) : ""}
            onChange={(e) => {
              const raw = e.target.value;
              onChange({
                ...filters,
                max_churn: raw === "" ? undefined : Number(raw) / 100,
              });
            }}
            placeholder="100"
            className="mt-1 w-full rounded-lg border border-border bg-surface-low px-3 py-2 text-sm"
          />
        </label>

        {filters.campaign && (
          <div className="flex items-end sm:col-span-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs">
              Save play: <strong>{filters.campaign}</strong>
              <button
                type="button"
                onClick={() => onChange({ ...filters, campaign: undefined })}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Remove save play filter"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
