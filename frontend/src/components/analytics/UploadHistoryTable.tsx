import type { UploadRecord } from "@/lib/api";
import { formatNumber, formatPercent } from "@/lib/format";

type UploadHistoryTableProps = {
  uploads: UploadRecord[];
};

function formatUploadedAt(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function statusClass(status: string): string {
  switch (status) {
    case "completed":
      return "text-risk-low";
    case "failed":
      return "text-destructive";
    case "processing":
      return "text-risk-medium";
    default:
      return "text-muted-foreground";
  }
}

export default function UploadHistoryTable({ uploads }: UploadHistoryTableProps) {
  if (uploads.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No uploads yet. Score subscribers from the Upload page.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border text-muted-foreground">
            <th className="pb-2 pr-4 font-medium">File</th>
            <th className="pb-2 pr-4 font-medium">Status</th>
            <th className="pb-2 pr-4 font-medium">Rows</th>
            <th className="pb-2 pr-4 font-medium">Threshold</th>
            <th className="pb-2 font-medium">Uploaded</th>
          </tr>
        </thead>
        <tbody>
          {uploads.map((upload) => (
            <tr key={upload.upload_id} className="border-b border-border/60">
              <td className="py-2.5 pr-4 font-medium">{upload.filename}</td>
              <td className={`py-2.5 pr-4 capitalize ${statusClass(upload.status)}`}>
                {upload.status}
                {upload.error_message ? (
                  <span className="mt-0.5 block text-xs text-destructive/80">
                    {upload.error_message}
                  </span>
                ) : null}
              </td>
              <td className="py-2.5 pr-4 tabular-nums">{formatNumber(upload.row_count)}</td>
              <td className="py-2.5 pr-4 text-muted-foreground">
                {upload.decision_threshold != null
                  ? formatPercent(upload.decision_threshold, 0)
                  : "Default"}
              </td>
              <td className="py-2.5 text-muted-foreground">{formatUploadedAt(upload.uploaded_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
