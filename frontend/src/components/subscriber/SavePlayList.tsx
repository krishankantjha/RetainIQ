import type { SavePlay } from "@/lib/api";
import { formatModelSignal } from "@/lib/format";

type SavePlayListProps = {
  plays: SavePlay[];
};

export default function SavePlayList({ plays }: SavePlayListProps) {
  if (plays.length === 0) {
    return <p className="text-sm text-muted-foreground">No save plays recommended for this account.</p>;
  }

  return (
    <ul className="space-y-3">
      {plays.map((play) => (
        <li
          key={`${play.campaign}-${play.action}`}
          className="rounded-lg border border-border bg-surface-high/30 px-4 py-3"
        >
          <p className="font-medium text-primary-soft">{play.campaign}</p>
          <p className="mt-1 text-sm text-muted-foreground">{play.action}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            SHAP signal: {formatModelSignal(play.estimated_impact)}
          </p>
        </li>
      ))}
    </ul>
  );
}
