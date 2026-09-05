import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CheckCircle2, FileUp, Loader2, UserPlus, XCircle } from "lucide-react";

import UploadHistoryTable from "@/components/analytics/UploadHistoryTable";
import {
  fetchOverview,
  fetchUploadHistory,
  fetchUploadStatus,
  uploadCsv,
  type UploadRecord,
  type UploadStatus,
} from "@/lib/api";
import { formatNumber, formatPercent } from "@/lib/format";

const POLL_MS = 2000;
const DEFAULT_THRESHOLD = 0.15;

export default function UploadPage() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<UploadStatus | null>(null);
  const [threshold, setThreshold] = useState(DEFAULT_THRESHOLD);
  const [history, setHistory] = useState<UploadRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const loadHistory = useCallback(async () => {
    try {
      const uploads = await fetchUploadHistory();
      setHistory(uploads);
      return uploads;
    } catch {
      return [];
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOverview()
      .then((overview) => {
        const configured = overview.risk_bands?.decision_threshold;
        if (configured !== undefined) setThreshold(configured);
      })
      .catch(() => undefined);

    void loadHistory();
  }, [loadHistory]);

  const pollStatus = useCallback(async (uploadId: number) => {
    const result = await fetchUploadStatus(uploadId);
    setStatus(result);
    return result;
  }, []);

  useEffect(() => {
    if (!status || status.status === "completed" || status.status === "failed") return;

    const timer = window.setInterval(async () => {
      try {
        const next = await pollStatus(status.upload_id);
        if (next.status === "completed" || next.status === "failed") {
          window.clearInterval(timer);
          void loadHistory();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Status check failed");
        window.clearInterval(timer);
      }
    }, POLL_MS);

    return () => window.clearInterval(timer);
  }, [status, pollStatus, loadHistory]);

  useEffect(() => {
    const hasActive = history.some(
      (upload) => upload.status === "pending" || upload.status === "processing",
    );
    if (!hasActive) return;

    const timer = window.setInterval(() => {
      void loadHistory();
    }, POLL_MS);

    return () => window.clearInterval(timer);
  }, [history, loadHistory]);

  const handleFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("Only CSV files are supported.");
      return;
    }

    setError(null);
    setStatus(null);
    setUploading(true);

    try {
      const accepted = await uploadCsv(file, threshold);
      const initial = await pollStatus(accepted.upload_id);
      setStatus(initial);
      void loadHistory();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      if (message === "Session expired") {
        navigate("/", { replace: true });
        return;
      }
      setError(message);
    } finally {
      setUploading(false);
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const processing =
    status?.status === "pending" || status?.status === "processing";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Upload a subscriber CSV or score one account at a time.
        </p>
        <Link
          to="/score"
          className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-surface-low"
        >
          <UserPlus className="h-4 w-4" />
          Score single subscriber
        </Link>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`dash-card flex flex-col items-center justify-center px-6 py-14 text-center transition-colors ${
          dragOver ? "border-primary/50 bg-primary/5" : ""
        }`}
      >
        <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-primary-soft ring-1 ring-primary/25">
          <FileUp className="h-7 w-7" />
        </span>
        <h2 className="mt-5 text-lg font-semibold">Upload subscribers</h2>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          IBM Telco Customer Churn schema (CSV). Scoring runs in the background after upload.
        </p>

        <div className="mt-6 w-full max-w-md rounded-lg border border-border/70 bg-surface-high/20 p-4 text-left">
          <label className="block text-sm font-medium" htmlFor="upload-threshold">
            High-risk threshold: {formatPercent(threshold, 0)}
          </label>
          <input
            id="upload-threshold"
            type="range"
            min={5}
            max={50}
            step={1}
            value={Math.round(threshold * 100)}
            onChange={(e) => setThreshold(Number(e.target.value) / 100)}
            disabled={uploading || processing}
            className="mt-2 w-full accent-primary disabled:opacity-50"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Applied when flagging subscribers at or above the decision threshold for this upload.
          </p>
        </div>

        <button
          type="button"
          disabled={uploading || processing}
          onClick={() => inputRef.current?.click()}
          className="mt-6 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow hover:bg-primary/90 disabled:opacity-60"
        >
          {uploading ? "Uploading…" : "Choose CSV file"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = "";
          }}
        />
        <p className="mt-3 text-xs text-muted-foreground">or drag and drop here</p>
      </div>

      {error && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {status && (
        <div className="dash-card p-5">
          <div className="flex items-start gap-3">
            {status.status === "completed" && (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-risk-low" />
            )}
            {status.status === "failed" && (
              <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-risk-high" />
            )}
            {processing && <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-primary-soft" />}
            <div className="min-w-0 flex-1">
              <p className="font-medium">{status.filename}</p>
              <p className="mt-1 text-sm capitalize text-muted-foreground">Status: {status.status}</p>
              {status.decision_threshold != null && (
                <p className="mt-1 text-sm text-muted-foreground">
                  Threshold: {formatPercent(status.decision_threshold, 0)}
                </p>
              )}
              {status.status === "completed" && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatNumber(status.row_count)} subscribers scored
                </p>
              )}
              {status.error_message && (
                <p className="mt-2 text-sm text-destructive">{status.error_message}</p>
              )}
              {status.status === "completed" && (
                <Link
                  to="/dashboard"
                  className="mt-4 inline-flex text-sm font-medium text-primary-soft hover:underline"
                >
                  View dashboard →
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="dash-card p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Upload history</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Recent CSV and single-score jobs
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setHistoryLoading(true);
              void loadHistory();
            }}
            className="rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-surface-low"
          >
            Refresh
          </button>
        </div>
        <div className="mt-4">
          {historyLoading ? (
            <p className="text-sm text-muted-foreground">Loading history…</p>
          ) : (
            <UploadHistoryTable uploads={history} />
          )}
        </div>
      </div>
    </div>
  );
}
