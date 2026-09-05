import { Link } from "react-router-dom";
import { Upload } from "lucide-react";

export default function EmptyCohortBanner() {
  return (
    <div className="dash-card border-dashed p-6 sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary-soft ring-1 ring-primary/25">
          <Upload className="h-6 w-6" />
        </span>
        <div>
          <h2 className="text-lg font-semibold">No scored subscribers yet</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Upload an IBM Telco-format CSV to score subscribers. Metrics, risk bands, save plays,
            and tables on this page populate from that data — nothing is simulated.
          </p>
          <Link
            to="/upload"
            className="mt-4 inline-flex text-sm font-medium text-primary-soft hover:text-foreground hover:underline underline-offset-4"
          >
            Upload subscribers →
          </Link>
        </div>
      </div>
    </div>
  );
}
