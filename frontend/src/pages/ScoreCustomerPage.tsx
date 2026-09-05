import { Loader2 } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { scoreCustomer } from "@/lib/api";
import { formatPercent } from "@/lib/format";

const CONTRACT_OPTIONS = ["Month-to-month", "One year", "Two year"];
const YES_NO_OPTIONS = ["No", "Yes"];
const GENDER_OPTIONS = ["Male", "Female"];
const INTERNET_OPTIONS = ["DSL", "Fiber optic", "No"];
const PAYMENT_OPTIONS = [
  "Electronic check",
  "Mailed check",
  "Bank transfer (automatic)",
  "Credit card (automatic)",
];

type ScoreForm = {
  customerID: string;
  gender: string;
  SeniorCitizen: number;
  Partner: string;
  Dependents: string;
  tenure: number;
  PhoneService: string;
  MultipleLines: string;
  InternetService: string;
  OnlineSecurity: string;
  OnlineBackup: string;
  DeviceProtection: string;
  TechSupport: string;
  StreamingTV: string;
  StreamingMovies: string;
  Contract: string;
  PaperlessBilling: string;
  PaymentMethod: string;
  MonthlyCharges: number;
  TotalCharges: number;
};

const DEFAULT_FORM: ScoreForm = {
  customerID: "",
  gender: "Male",
  SeniorCitizen: 0,
  Partner: "No",
  Dependents: "No",
  tenure: 12,
  PhoneService: "Yes",
  MultipleLines: "No",
  InternetService: "Fiber optic",
  OnlineSecurity: "No",
  OnlineBackup: "No",
  DeviceProtection: "No",
  TechSupport: "No",
  StreamingTV: "No",
  StreamingMovies: "No",
  Contract: "Month-to-month",
  PaperlessBilling: "Yes",
  PaymentMethod: "Electronic check",
  MonthlyCharges: 75,
  TotalCharges: 900,
};

type ScoreCustomerPageProps = {
  defaultThreshold?: number;
};

export default function ScoreCustomerPage({ defaultThreshold = 0.15 }: ScoreCustomerPageProps) {
  const [form, setForm] = useState<ScoreForm>(DEFAULT_FORM);
  const [threshold, setThreshold] = useState(defaultThreshold);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ customerId: string; churnProbability: number } | null>(
    null,
  );

  const updateField = <K extends keyof ScoreForm>(key: K, value: ScoreForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customerID.trim()) {
      setError("Customer ID is required.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const scored = await scoreCustomer(
        { ...form, customerID: form.customerID.trim() },
        { threshold, replaceExisting: true },
      );
      setResult({
        customerId: scored.customer_id,
        churnProbability: scored.churn_probability,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scoring failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Score a single subscriber</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Run the full churn model on one IBM Telco record without uploading a CSV. Results are
          saved to the cohort and open in subscriber detail.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="dash-card space-y-5 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm sm:col-span-2">
            <span className="text-muted-foreground">Customer ID</span>
            <input
              required
              value={form.customerID}
              onChange={(e) => updateField("customerID", e.target.value)}
              placeholder="e.g. 1234-ABCD"
              className="mt-1 w-full rounded-lg border border-border bg-surface-low px-3 py-2"
            />
          </label>

          <label className="block text-sm">
            <span className="text-muted-foreground">Gender</span>
            <select
              value={form.gender}
              onChange={(e) => updateField("gender", e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-surface-low px-3 py-2"
            >
              {GENDER_OPTIONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            <span className="text-muted-foreground">Senior citizen</span>
            <select
              value={form.SeniorCitizen}
              onChange={(e) => updateField("SeniorCitizen", Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-border bg-surface-low px-3 py-2"
            >
              <option value={0}>No</option>
              <option value={1}>Yes</option>
            </select>
          </label>

          <label className="block text-sm">
            <span className="text-muted-foreground">Contract</span>
            <select
              value={form.Contract}
              onChange={(e) => updateField("Contract", e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-surface-low px-3 py-2"
            >
              {CONTRACT_OPTIONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            <span className="text-muted-foreground">Tenure (months)</span>
            <input
              type="number"
              min={0}
              max={120}
              value={form.tenure}
              onChange={(e) => updateField("tenure", Number(e.target.value) || 0)}
              className="mt-1 w-full rounded-lg border border-border bg-surface-low px-3 py-2"
            />
          </label>

          <label className="block text-sm">
            <span className="text-muted-foreground">Internet service</span>
            <select
              value={form.InternetService}
              onChange={(e) => updateField("InternetService", e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-surface-low px-3 py-2"
            >
              {INTERNET_OPTIONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            <span className="text-muted-foreground">Payment method</span>
            <select
              value={form.PaymentMethod}
              onChange={(e) => updateField("PaymentMethod", e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-surface-low px-3 py-2"
            >
              {PAYMENT_OPTIONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            <span className="text-muted-foreground">Monthly charges ($)</span>
            <input
              type="number"
              min={0}
              step={0.01}
              value={form.MonthlyCharges}
              onChange={(e) => updateField("MonthlyCharges", Number(e.target.value) || 0)}
              className="mt-1 w-full rounded-lg border border-border bg-surface-low px-3 py-2"
            />
          </label>

          <label className="block text-sm">
            <span className="text-muted-foreground">Total charges ($)</span>
            <input
              type="number"
              min={0}
              step={0.01}
              value={form.TotalCharges}
              onChange={(e) => updateField("TotalCharges", Number(e.target.value) || 0)}
              className="mt-1 w-full rounded-lg border border-border bg-surface-low px-3 py-2"
            />
          </label>

          {(
            [
              ["Partner", "Partner"],
              ["Dependents", "Dependents"],
              ["PhoneService", "Phone service"],
              ["TechSupport", "Tech support"],
              ["OnlineSecurity", "Online security"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="block text-sm">
              <span className="text-muted-foreground">{label}</span>
              <select
                value={form[key]}
                onChange={(e) => updateField(key, e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-surface-low px-3 py-2"
              >
                {YES_NO_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
          ))}
        </div>

        <div className="rounded-lg border border-border/70 bg-surface-high/20 p-4">
          <label className="block text-sm font-medium" htmlFor="score-threshold">
            High-risk threshold: {formatPercent(threshold, 0)}
          </label>
          <input
            id="score-threshold"
            type="range"
            min={5}
            max={50}
            step={1}
            value={Math.round(threshold * 100)}
            onChange={(e) => setThreshold(Number(e.target.value) / 100)}
            className="mt-2 w-full accent-primary"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Subscribers at or above this predicted churn probability are flagged for review.
          </p>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Score subscriber
        </button>
      </form>

      {error && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {result && (
        <div className="dash-card p-5">
          <p className="font-medium">Scoring complete</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {result.customerId} · churn probability {formatPercent(result.churnProbability, 1)}
          </p>
          <Link
            to={`/subscribers/${encodeURIComponent(result.customerId)}`}
            className="mt-4 inline-flex text-sm font-medium text-primary-soft hover:underline"
          >
            View subscriber detail →
          </Link>
        </div>
      )}

      <p className="text-center text-sm text-muted-foreground">
        Need a full cohort?{" "}
        <Link to="/upload" className="font-medium text-primary-soft hover:underline">
          Upload CSV
        </Link>
      </p>
    </div>
  );
}
