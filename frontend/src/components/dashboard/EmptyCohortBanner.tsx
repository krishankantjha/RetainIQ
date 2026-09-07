import { Link } from "react-router-dom";
import { Download, Upload } from "lucide-react";

import { SAMPLE_CSV_FILENAME, SAMPLE_CSV_PATH } from "@/lib/sampleDataset";

export default function EmptyCohortBanner() {
  return (
    <div className="dash-card border-dashed p-6 sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary-soft ring-1 ring-primary/25">
          <Upload className="h-6 w-6" />
        </span>
        <div>
          <h2 className="text-lg font-semibold">No subscriber data yet</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Upload the IBM Telco sample CSV to populate metrics and charts on this page.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
            <a
              href={SAMPLE_CSV_PATH}
              download={SAMPLE_CSV_FILENAME}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-soft hover:text-foreground hover:underline underline-offset-4"
            >
              <Download className="h-4 w-4" />
              Download sample CSV
            </a>
            <Link
              to="/upload"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-soft hover:text-foreground hover:underline underline-offset-4"
            >
              Upload data →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
