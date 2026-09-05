import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";

import SavePlaysTable from "@/components/save-plays/SavePlaysTable";
import { fetchSavePlays, type SavePlayStat } from "@/lib/api";

export default function SavePlaysPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [plays, setPlays] = useState<SavePlayStat[]>([]);

  useEffect(() => {
    let cancelled = false;

    fetchSavePlays()
      .then((data) => {
        if (!cancelled) setPlays(data);
      })
      .catch((err) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Failed to load save plays";
        if (message === "Session expired") {
          navigate("/", { replace: true });
          return;
        }
        setError(message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Suggested save plays from SHAP drivers across your scored subscribers. Click{" "}
        <strong>View subscribers</strong> to drill into the explorer filtered by save play.
      </p>

      {loading && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading save plays…
        </div>
      )}

      {error && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {!loading && !error && <SavePlaysTable plays={plays} />}
    </div>
  );
}
