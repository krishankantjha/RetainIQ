import type { CohortRow } from "@/lib/api";
import { riskTierFromRow } from "@/lib/riskBands";

function escapeCell(value: string | number | boolean | null | undefined): string {
  const raw = value === null || value === undefined ? "" : String(value);
  if (raw.includes(",") || raw.includes('"') || raw.includes("\n")) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

function cohortRowToRecord(row: CohortRow): Record<string, string | number | boolean> {
  return {
    customer_id: row.customer_id,
    contract: row.contract,
    tenure: row.tenure,
    monthly_charges: row.monthly_charges,
    total_charges: row.total_charges,
    churn_probability: row.churn_probability,
    risk_band: riskTierFromRow(row),
    is_high_risk: row.is_high_risk,
    internet_service: row.internet_service,
    gender: row.gender,
    actual_churn_label: row.churn ?? "",
    cluster: row.cluster ?? "",
    cohort_persona: row.cohort_persona ?? "",
    predicted_at: row.predicted_at ?? "",
  };
}

export function downloadCohortCsv(rows: CohortRow[], filename: string): void {
  if (rows.length === 0) return;

  const records = rows.map(cohortRowToRecord);
  const headers = Object.keys(records[0]);
  const lines = [
    headers.join(","),
    ...records.map((record) =>
      headers.map((header) => escapeCell(record[header])).join(","),
    ),
  ];

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
