import GlobalDriversPlot from "@/components/analytics/GlobalDriversPlot";
import RiskTrendPlot from "@/components/analytics/RiskTrendPlot";
import SegmentHeatmapPlot from "@/components/analytics/SegmentHeatmapPlot";
import ChartCard from "@/components/charts/ChartCard";
import type { GlobalDriver, RiskTrendPoint, SegmentMatrix } from "@/lib/api";
import { useNavigate } from "react-router-dom";

type AnalyticsChartsProps = {
  riskTrend: RiskTrendPoint[];
  drivers: GlobalDriver[];
  segmentMatrix: SegmentMatrix | null;
  matrixEmpty: boolean;
};

export default function AnalyticsCharts({
  riskTrend,
  drivers,
  segmentMatrix,
  matrixEmpty,
}: AnalyticsChartsProps) {
  const navigate = useNavigate();

  const handleHeatmapCell = (contract: string, tenureBin: string) => {
    const params = new URLSearchParams({
      contract,
      tenure_bin: tenureBin,
    });
    navigate(`/explorer?${params.toString()}`);
  };

  return (
    <>
      <section className="grid gap-6 xl:grid-cols-2">
        <ChartCard
          title="Risk by scoring batch"
          description="Average predicted churn and above-threshold share per scoring batch"
          empty={riskTrend.length === 0}
        >
          <RiskTrendPlot points={riskTrend} />
        </ChartCard>

        <ChartCard
          title="Contract × tenure heatmap"
          description="Average predicted churn across contract type and tenure bins — click a cell to explore subscribers"
          empty={matrixEmpty}
        >
          {segmentMatrix && !matrixEmpty ? (
            <SegmentHeatmapPlot data={segmentMatrix} onCellClick={handleHeatmapCell} />
          ) : null}
        </ChartCard>
      </section>

      <ChartCard
        title="Global SHAP drivers"
        description="Mean absolute SHAP impact across subscribers (red = pushes churn up, green = pushes churn down)"
        empty={drivers.length === 0}
        contentClassName="min-h-64"
      >
        {drivers.length > 0 ? <GlobalDriversPlot drivers={drivers} /> : null}
      </ChartCard>
    </>
  );
}
