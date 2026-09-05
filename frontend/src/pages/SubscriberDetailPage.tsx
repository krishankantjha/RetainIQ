import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, FlaskConical } from "lucide-react";

import RiskBadge from "@/components/RiskBadge";
import CounterfactualEditor from "@/components/subscriber/CounterfactualEditor";
import SavePlayList from "@/components/subscriber/SavePlayList";
import ShapDriversChart from "@/components/subscriber/ShapDriversChart";
import SimulationList from "@/components/subscriber/SimulationList";
import { TableSkeleton } from "@/components/ui/PageSkeleton";
import { fetchCustomerExplain, type CustomerExplain } from "@/lib/api";
import { formatCurrency, formatPercent } from "@/lib/format";

export default function SubscriberDetailPage() {
  const { customerId } = useParams<{ customerId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<CustomerExplain | null>(null);
  const counterfactualRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!customerId) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchCustomerExplain(customerId)
      .then((data) => {
        if (!cancelled) setDetail(data);
      })
      .catch((err) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Failed to load subscriber";
        if (message === "Session expired") {
          navigate("/", { replace: true });
          return;
        }
        setError(message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [customerId, navigate]);

  useEffect(() => {
    if (!detail || window.location.hash !== "#counterfactual") return;
    const timer = window.setTimeout(() => {
      counterfactualRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 150);
    return () => window.clearTimeout(timer);
  }, [detail]);

  if (!customerId) {
    return <p className="text-destructive">Missing customer ID.</p>;
  }

  return (
    <div className="space-y-6">
      <Link
        to="/explorer"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to explorer
      </Link>

      {loading && <TableSkeleton rows={4} />}

      {error && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {detail && (
        <>
          <div className="dash-card p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold">{detail.customer_id}</h2>
                {detail.cohort_persona && (
                  <p className="mt-1 text-sm text-muted-foreground">{detail.cohort_persona}</p>
                )}
              </div>
              <RiskBadge
                churnProbability={detail.churn_probability}
              />
            </div>

            <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <dt className="text-xs text-muted-foreground">Churn probability</dt>
                <dd className="mt-1 text-lg font-semibold">
                  {formatPercent(detail.churn_probability, 1)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Tenure</dt>
                <dd className="mt-1 text-lg font-semibold">{detail.tenure} months</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Monthly charges</dt>
                <dd className="mt-1 text-lg font-semibold">
                  {formatCurrency(detail.monthly_charges)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Total charges</dt>
                <dd className="mt-1 text-lg font-semibold">
                  {formatCurrency(detail.total_charges)}
                </dd>
              </div>
            </dl>

            {detail.customer_features && (
              <Link
                to={`/subscribers/${encodeURIComponent(customerId)}#counterfactual`}
                className="mt-4 inline-flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm font-medium text-primary-soft hover:bg-primary/15"
              >
                <FlaskConical className="h-4 w-4" />
                Open what-if editor
              </Link>
            )}
          </div>

          <section className="grid gap-6 xl:grid-cols-2">
            <div className="dash-card p-5">
              <h3 className="text-base font-semibold">SHAP drivers</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Features pushing churn risk up or down for this account
              </p>
              <div className="mt-5">
                <ShapDriversChart drivers={detail.top_drivers} />
              </div>
            </div>

            <div className="dash-card p-5">
              <h3 className="text-base font-semibold">Save plays</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Recommended retention actions for this subscriber
              </p>
              <div className="mt-5">
                <SavePlayList plays={detail.save_plays} />
              </div>
            </div>
          </section>

          {detail.simulations && detail.simulations.length > 0 && (
            <div id="counterfactual-scenarios" className="dash-card p-5">
              <h3 className="text-base font-semibold">Counterfactual scenarios</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Estimated churn risk if contract or service attributes change
              </p>
              <div className="mt-5">
                <SimulationList simulations={detail.simulations} />
              </div>
            </div>
          )}

          {detail.customer_features && (
            <div id="counterfactual" ref={counterfactualRef} className="dash-card scroll-mt-24 p-5">
              <h3 className="text-base font-semibold">Counterfactual editor</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Adjust contract and service attributes, then re-score to see modeled probability change
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
        </>
      )}
    </div>
  );
}
