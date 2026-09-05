import { Loader2 } from "lucide-react";
import { useState } from "react";

import { simulateChurn } from "@/lib/api";
import { formatPercent } from "@/lib/format";

const CONTRACT_OPTIONS = ["Month-to-month", "One year", "Two year"];
const YES_NO_OPTIONS = ["No", "Yes"];
const PAYMENT_OPTIONS = [
  "Electronic check",
  "Mailed check",
  "Bank transfer (automatic)",
  "Credit card (automatic)",
];

type CounterfactualEditorProps = {
  customerId: string;
  customerFeatures: Record<string, unknown>;
  originalRisk: number;
};

type FormState = {
  Contract: string;
  TechSupport: string;
  OnlineSecurity: string;
  PaymentMethod: string;
  tenure: number;
};

function readString(features: Record<string, unknown>, key: string, fallback: string): string {
  const value = features[key];
  return value === null || value === undefined ? fallback : String(value);
}

function readNumber(features: Record<string, unknown>, key: string, fallback: number): number {
  const value = features[key];
  return typeof value === "number" ? value : Number(value ?? fallback);
}

export default function CounterfactualEditor({
  customerId,
  customerFeatures,
  originalRisk,
}: CounterfactualEditorProps) {
  const [form, setForm] = useState<FormState>(() => ({
    Contract: readString(customerFeatures, "Contract", "Month-to-month"),
    TechSupport: readString(customerFeatures, "TechSupport", "No"),
    OnlineSecurity: readString(customerFeatures, "OnlineSecurity", "No"),
    PaymentMethod: readString(customerFeatures, "PaymentMethod", "Mailed check"),
    tenure: readNumber(customerFeatures, "tenure", 0),
  }));
  const [simulatedRisk, setSimulatedRisk] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runSimulation = async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = {
        ...customerFeatures,
        customerID: customerId,
        Contract: form.Contract,
        TechSupport: form.TechSupport,
        OnlineSecurity: form.OnlineSecurity,
        PaymentMethod: form.PaymentMethod,
        tenure: form.tenure,
      };
      const result = await simulateChurn(payload);
      setSimulatedRisk(result);
    } catch (err) {
      setSimulatedRisk(null);
      setError(err instanceof Error ? err.message : "Simulation failed");
    } finally {
      setLoading(false);
    }
  };

  const reduction =
    simulatedRisk !== null ? Math.max(0, originalRisk - simulatedRisk) : null;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="text-muted-foreground">Contract</span>
          <select
            value={form.Contract}
            onChange={(e) => setForm((prev) => ({ ...prev, Contract: e.target.value }))}
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
            onChange={(e) =>
              setForm((prev) => ({ ...prev, tenure: Number(e.target.value) || 0 }))
            }
            className="mt-1 w-full rounded-lg border border-border bg-surface-low px-3 py-2"
          />
        </label>

        <label className="block text-sm">
          <span className="text-muted-foreground">Tech support</span>
          <select
            value={form.TechSupport}
            onChange={(e) => setForm((prev) => ({ ...prev, TechSupport: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-border bg-surface-low px-3 py-2"
          >
            {YES_NO_OPTIONS.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="text-muted-foreground">Online security</span>
          <select
            value={form.OnlineSecurity}
            onChange={(e) => setForm((prev) => ({ ...prev, OnlineSecurity: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-border bg-surface-low px-3 py-2"
          >
            {YES_NO_OPTIONS.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>

        <label className="block text-sm sm:col-span-2">
          <span className="text-muted-foreground">Payment method</span>
          <select
            value={form.PaymentMethod}
            onChange={(e) => setForm((prev) => ({ ...prev, PaymentMethod: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-border bg-surface-low px-3 py-2"
          >
            {PAYMENT_OPTIONS.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>
      </div>

      <button
        type="button"
        onClick={runSimulation}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Run simulation
      </button>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {simulatedRisk !== null && (
        <div className="rounded-lg border border-border bg-surface-high/30 px-4 py-3 text-sm">
          <p>
            Current risk: <strong>{formatPercent(originalRisk, 1)}</strong>
          </p>
          <p className="mt-1">
            Simulated risk: <strong>{formatPercent(simulatedRisk, 1)}</strong>
          </p>
          <p className="mt-1 text-risk-low">
            Modeled score change: <strong>{formatPercent(reduction ?? 0, 1)}</strong>
          </p>
        </div>
      )}
    </div>
  );
}
