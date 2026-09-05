import type { CohortRow } from "@/lib/api";
import { riskTierFromRow } from "@/lib/riskBands";

export type HistogramBin = {
  label: string;
  count: number;
  min: number;
  max: number;
};

export type ContractRiskRow = {
  contract: string;
  high: number;
  medium: number;
  low: number;
  total: number;
};

export type TenureRiskRow = {
  label: string;
  highRate: number;
  total: number;
  high: number;
};

const CONTRACT_ORDER = ["Month-to-month", "One year", "Two year"] as const;

function contractSortIndex(contract: string): number {
  const index = CONTRACT_ORDER.indexOf(contract as (typeof CONTRACT_ORDER)[number]);
  return index === -1 ? CONTRACT_ORDER.length : index;
}

export function buildChurnHistogram(rows: CohortRow[], binCount = 10): HistogramBin[] {
  if (rows.length === 0) return [];

  const bins: HistogramBin[] = [];
  const step = 1 / binCount;

  for (let i = 0; i < binCount; i++) {
    const min = i * step;
    const max = i === binCount - 1 ? 1 : (i + 1) * step;
    const lowPct = Math.round(min * 100);
    const highPct = i === binCount - 1 ? 100 : Math.round(max * 100);
    const label = `${lowPct}–${highPct}%`;
    bins.push({ label, count: 0, min, max });
  }

  for (const row of rows) {
    const p = row.churn_probability;
    const index = Math.min(Math.floor(p / step), binCount - 1);
    bins[index].count += 1;
  }

  return bins;
}

export function buildContractRiskStacked(rows: CohortRow[]): ContractRiskRow[] {
  const map = new Map<string, ContractRiskRow>();

  for (const row of rows) {
    const contract = row.contract || "Unknown";
    const entry = map.get(contract) ?? {
      contract,
      high: 0,
      medium: 0,
      low: 0,
      total: 0,
    };
    entry.total += 1;
    const band = riskTierFromRow(row);
    entry[band] += 1;
    map.set(contract, entry);
  }

  return [...map.values()].sort(
    (a, b) => contractSortIndex(a.contract) - contractSortIndex(b.contract),
  );
}

export function buildTenureRiskBins(rows: CohortRow[], monthsPerBin = 12): TenureRiskRow[] {
  if (rows.length === 0) return [];

  const maxTenure = Math.max(...rows.map((r) => r.tenure));
  const binCount = Math.max(1, Math.ceil((maxTenure + 1) / monthsPerBin));
  const bins: TenureRiskRow[] = [];

  for (let i = 0; i < binCount; i++) {
    const start = i * monthsPerBin;
    const end = start + monthsPerBin - 1;
    bins.push({
      label: `${start}–${end} mo`,
      highRate: 0,
      total: 0,
      high: 0,
    });
  }

  for (const row of rows) {
    const index = Math.min(Math.floor(row.tenure / monthsPerBin), binCount - 1);
    bins[index].total += 1;
    if (row.is_high_risk) bins[index].high += 1;
  }

  for (const bin of bins) {
    bin.highRate = bin.total > 0 ? bin.high / bin.total : 0;
  }

  return bins.filter((b) => b.total > 0);
}
