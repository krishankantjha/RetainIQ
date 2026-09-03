"""Write diagnostics_metadata.json after ensemble training."""

import hashlib
import json
import os
from datetime import datetime, timezone
from typing import Optional


def sha256_file(filepath: str) -> str:
    digest = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(8192):
            digest.update(chunk)
    return digest.hexdigest()


def utc_timestamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def write_diagnostics_metadata(
    artifacts_dir: str,
    *,
    ensemble_model_path: str,
    holdout_accuracy: float,
    holdout_f1: float,
    holdout_roc_auc: float,
    decision_threshold: float,
    model_version: str = "CalibratedGBDTEnsemble_v1.1",
    diagnostics_version: str = "v1.1.0",
    artifact_timestamp: Optional[str] = None,
    evaluation_timestamp: Optional[str] = None,
) -> str:
    """Persist UI drift metadata alongside trained ensemble artifacts."""
    if not os.path.isfile(ensemble_model_path):
        raise FileNotFoundError(f"Ensemble model not found: {ensemble_model_path}")

    payload = {
        "model_version": model_version,
        "artifact_timestamp": artifact_timestamp or utc_timestamp(),
        "evaluation_timestamp": evaluation_timestamp or utc_timestamp(),
        "diagnostics_version": diagnostics_version,
        "model_sha256": sha256_file(ensemble_model_path),
        "decision_threshold": float(decision_threshold),
        "holdout_metrics": {
            "accuracy": round(float(holdout_accuracy), 4),
            "f1": round(float(holdout_f1), 4),
            "roc_auc": round(float(holdout_roc_auc), 4),
        },
    }

    out_path = os.path.join(artifacts_dir, "diagnostics_metadata.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)
        f.write("\n")
    return out_path
