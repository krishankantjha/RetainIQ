import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { formatModelSignal } from "@/lib/format";
import type { SavePlayStat } from "@/lib/api";

type SavePlaysTableProps = {
  plays: SavePlayStat[];
};

export default function SavePlaysTable({ plays }: SavePlaysTableProps) {
  if (plays.length === 0) {
    return (
      <div className="dash-card p-8 text-center">
        <p className="text-muted-foreground">
          No save plays yet — they appear after subscribers are scored.
        </p>
        <Link to="/upload" className="mt-3 inline-block text-sm font-medium text-primary-soft hover:underline">
          Upload subscribers →
        </Link>
      </div>
    );
  }

  return (
    <div className="dash-card overflow-x-auto">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead>
          <tr className="border-b border-border text-muted-foreground">
            <th className="px-5 py-3 font-medium">Save play</th>
            <th className="px-5 py-3 font-medium">Subscribers</th>
            <th className="px-5 py-3 font-medium">Avg SHAP signal</th>
            <th className="px-5 py-3 font-medium">Drill-down</th>
          </tr>
        </thead>
        <tbody>
          {plays.map((play) => (
            <tr key={play.campaign} className="border-b border-border/60 last:border-0">
              <td className="px-5 py-3 font-medium">{play.campaign}</td>
              <td className="px-5 py-3 text-muted-foreground">{play.recommendation_count}</td>
              <td className="px-5 py-3 text-muted-foreground">
                {formatModelSignal(play.average_estimated_impact)}
              </td>
              <td className="px-5 py-3">
                <Link
                  to={`/explorer?campaign=${encodeURIComponent(play.campaign)}`}
                  className="inline-flex items-center gap-1 text-sm font-medium text-primary-soft hover:underline"
                >
                  View subscribers
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
