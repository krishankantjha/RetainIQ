import { FlaskConical, Loader2, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import RiskBadge from "@/components/RiskBadge";
import CounterfactualEditor from "@/components/subscriber/CounterfactualEditor";
import SimulationList from "@/components/subscriber/SimulationList";
import { fetchCustomerExplain, searchCustomers, type CustomerExplain } from "@/lib/api";
import { formatPercent } from "@/lib/format";

export default function WhatIfPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<CustomerExplain | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      return;
    }

    const timer = window.setTimeout(() => {
      setLoading(true);
      searchCustomers(trimmed)
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 250);

    return () => window.clearTimeout(timer);
  }, [query]);

  const loadSubscriber = (customerId: string) => {
    setSelectedId(customerId);
    setDetail(null);
    setDetailError(null);
    setDetailLoading(true);

    fetchCustomerExplain(customerId)
      .then(setDetail)
      .catch((err) => {
        const message = err instanceof Error ? err.message : "Failed to load subscriber";
        if (message === "Session expired") {
          navigate("/", { replace: true });
          return;
        }
        setDetailError(message);
      })
      .finally(() => setDetailLoading(false));
  };

  return (
    <div className="space-y-6">
      <div className="dash-card p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary-soft">
            <FlaskConical className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">What-if lab</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Search a scored subscriber and run counterfactual simulations inline — adjust contract,
              support, and payment attributes without leaving this page.
            </p>
          </div>
        </div>
      </div>

      <div className="dash-card p-5">
        <label className="block text-sm font-medium" htmlFor="what-if-search">
          Find a subscriber
        </label>
        <div className="relative mt-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            id="what-if-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by customer ID (min. 2 characters)…"
            className="h-10 w-full rounded-xl border border-border bg-surface-low pl-10 pr-4 text-sm focus:border-primary/45 focus:outline-none focus:ring-2 focus:ring-primary/20"
            autoComplete="off"
          />
        </div>

        {query.trim().length >= 2 && (
          <ul className="mt-3 divide-y divide-border/60 rounded-lg border border-border/60">
            {loading && (
              <li className="px-4 py-3 text-sm text-muted-foreground">Searching…</li>
            )}
            {!loading && results.length === 0 && (
              <li className="px-4 py-3 text-sm text-muted-foreground">No subscriber matches</li>
            )}
            {!loading &&
              results.map((id) => (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => loadSubscriber(id)}
                    className={`flex w-full items-center justify-between px-4 py-3 text-left text-sm hover:bg-surface-high/40 ${
                      selectedId === id ? "bg-primary/10" : ""
                    }`}
                  >
                    <span className="font-medium">{id}</span>
                    <span className="text-xs text-primary-soft">Load editor</span>
                  </button>
                </li>
              ))}
          </ul>
        )}
      </div>

      {detailLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading subscriber…
        </div>
      )}

      {detailError && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {detailError}
        </p>
      )}

      {detail && (
        <div className="space-y-6">
          <div className="dash-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold">{detail.customer_id}</h3>
                {detail.cohort_persona && (
                  <p className="mt-1 text-sm text-muted-foreground">{detail.cohort_persona}</p>
                )}
              </div>
              <RiskBadge
                churnProbability={detail.churn_probability}
              />
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              Baseline churn probability:{" "}
              <strong>{formatPercent(detail.churn_probability, 1)}</strong>
            </p>
            <Link
              to={`/subscribers/${encodeURIComponent(detail.customer_id)}`}
              className="mt-3 inline-flex text-sm font-medium text-primary-soft hover:underline"
            >
              Open full subscriber detail (SHAP + save plays) →
            </Link>
          </div>

          {detail.simulations && detail.simulations.length > 0 && (
            <div className="dash-card p-5">
              <h3 className="text-base font-semibold">Preset counterfactual scenarios</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Model-suggested contract and payment interventions
              </p>
              <div className="mt-4">
                <SimulationList simulations={detail.simulations} />
              </div>
            </div>
          )}

          {detail.customer_features && (
            <div id="counterfactual" className="dash-card scroll-mt-24 p-5">
              <h3 className="text-base font-semibold">Counterfactual editor</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Adjust attributes and re-score to see modeled probability change
              </p>
              <div className="mt-5">
                <CounterfactualEditor
                  customerId={detail.customer_id}
                  customerFeatures={detail.customer_features}
                  originalRisk={detail.churn_probability}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {!detail && !detailLoading && (
        <p className="text-center text-sm text-muted-foreground">
          No subscriber scored yet?{" "}
          <Link to="/score" className="font-medium text-primary-soft hover:underline">
            Score a single account
          </Link>{" "}
          or{" "}
          <Link to="/upload" className="font-medium text-primary-soft hover:underline">
            upload a cohort
          </Link>
          .
        </p>
      )}
    </div>
  );
}
