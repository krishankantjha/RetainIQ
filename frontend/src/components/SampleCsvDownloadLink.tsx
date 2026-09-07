import { Download, Loader2 } from "lucide-react";
import { useState } from "react";

import { downloadSampleCsv } from "@/lib/sampleDataset";

type SampleCsvDownloadLinkProps = {
  label?: string;
  className?: string;
};

export default function SampleCsvDownloadLink({
  label = "Download sample CSV",
  className = "inline-flex items-center gap-1.5 text-sm font-medium text-primary-soft hover:text-foreground hover:underline underline-offset-4 disabled:opacity-60",
}: SampleCsvDownloadLinkProps) {
  const [downloading, setDownloading] = useState(false);

  async function handleClick() {
    setDownloading(true);
    try {
      await downloadSampleCsv();
    } catch {
      window.alert("Could not download the sample CSV. Please try again.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <button type="button" onClick={handleClick} disabled={downloading} className={className}>
      {downloading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Downloading…
        </>
      ) : (
        <>
          <Download className="h-4 w-4" />
          {label}
        </>
      )}
    </button>
  );
}
