"""
Model Performance and Health Monitoring.
Tracks baseline thresholds, load states, and overall system health status.
"""

import json
import logging
import os
import pickle
import sys

import pandas as pd

# Add project root to path
base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if base_dir not in sys.path:
    sys.path.insert(0, base_dir)

from configs.dataset_config import config_loader
from ml.training.feature_drift import detect_feature_drift

logger = logging.getLogger("ml.training.model_monitor")


def _degraded_health(message: str) -> dict:
    return {
        "status": "Degraded",
        "message": message,
        "model_name": "N/A",
        "model_version": "N/A",
        "last_trained": "N/A",
        "drift_detected": False,
        "drift_ratio": 0.0,
        "metrics": {},
        "drift_details": {},
    }


def _load_model_monitoring_info(artifacts_dir: str) -> dict | None:
    """Prefer diagnostics_metadata.json; fall back to legacy model_metadata.pkl."""
    diagnostics_path = os.path.join(artifacts_dir, "diagnostics_metadata.json")
    metadata_path = os.path.join(artifacts_dir, "model_metadata.pkl")

    if os.path.exists(diagnostics_path):
        try:
            with open(diagnostics_path, encoding="utf-8") as f:
                diag = json.load(f)
            holdout = diag.get("holdout_metrics") or {}
            metrics = {}
            if holdout.get("accuracy") is not None:
                metrics["accuracy"] = holdout["accuracy"]
            if holdout.get("f1") is not None:
                metrics["f1_score"] = holdout["f1"]
            if holdout.get("roc_auc") is not None:
                metrics["roc_auc"] = holdout["roc_auc"]

            return {
                "model_name": diag.get("model_version", "CalibratedGBDTEnsemble"),
                "model_version": diag.get("diagnostics_version", diag.get("model_version", "v1.1.0")),
                "last_trained": diag.get("evaluation_timestamp")
                or diag.get("artifact_timestamp", "N/A"),
                "metrics": metrics,
            }
        except Exception as e:
            logger.warning(f"Failed to read diagnostics metadata: {e}")

    if os.path.exists(metadata_path):
        try:
            with open(metadata_path, "rb") as f:
                meta = pickle.load(f)
            return {
                "model_name": meta.get("model_type") or meta.get("model_name", "calibrated_ensemble"),
                "model_version": meta.get("version", "1.1.0"),
                "last_trained": meta.get("training_date", "N/A"),
                "metrics": meta.get("validation_metrics", {}),
            }
        except Exception as e:
            logger.exception(f"Failed to deserialize model metadata: {e}")
            return None

    return None


def get_system_health(X_inference: pd.DataFrame) -> dict:
    """
    Computes overall system health by combining model loading state, active performance
    metrics from diagnostics metadata, and dynamic feature drift calculations.
    """
    logger.info("Evaluating system health state...")

    artifacts_dir_relative = config_loader.training["data_paths"].get("artifacts_dir", "ml/artifacts")
    artifacts_dir = os.path.join(base_dir, artifacts_dir_relative)

    monitor_info = _load_model_monitoring_info(artifacts_dir)
    if monitor_info is None:
        logger.error("Model monitoring metadata not found in %s", artifacts_dir)
        return _degraded_health("Model metadata artifacts missing. System health check degraded.")

    model_name = monitor_info["model_name"]
    model_version = monitor_info["model_version"]
    training_date = monitor_info["last_trained"]
    val_metrics = monitor_info["metrics"]

    try:
        drift_report = detect_feature_drift(X_inference)
        is_drifted = drift_report["is_drifted"]
        drift_ratio = drift_report["drift_ratio"]
        drift_metrics = drift_report["metrics"]
    except Exception as e:
        logger.error(f"Failed to execute feature drift detection check: {e}", exc_info=True)
        return {
            "status": "Warning",
            "message": f"Feature drift detection failed: {e}",
            "model_name": model_name,
            "model_version": model_version,
            "last_trained": training_date,
            "drift_detected": False,
            "drift_ratio": 0.0,
            "metrics": val_metrics,
            "drift_details": {},
        }

    status = "Healthy"
    message = "Model is operational with stable distribution bounds."

    num_total = sum(1 for m in drift_metrics.values() if m.get("method") == "ks_test")
    num_drifted = sum(1 for m in drift_metrics.values() if m.get("method") == "ks_test" and m.get("drifted"))
    numeric_drift_ratio = (num_drifted / num_total) if num_total > 0 else 0.0

    if is_drifted:
        status = "Warning"
        message = "Feature drift detected on one or more variables."

    if drift_ratio >= 0.20 or numeric_drift_ratio >= 0.40:
        status = "Degraded"
        message = (
            f"Significant feature drift detected (Combined Ratio: {drift_ratio * 100:.1f}%, "
            f"Numerical Ratio: {numeric_drift_ratio * 100:.1f}%). Recalibration recommended."
        )

    logger.info(
        f"System Health Status evaluated: {status} "
        f"(Combined Drift Ratio: {drift_ratio * 100:.1f}%, Numeric Drift Ratio: {numeric_drift_ratio * 100:.1f}%)"
    )

    if status == "Degraded":
        logger.critical(
            f"ALERT: Model health is DEGRADED. Feature drift exceeds threshold "
            f"(combined={drift_ratio * 100:.1f}%%, numerical={numeric_drift_ratio * 100:.1f}%%). "
            f"Immediate model recalibration is required. "
            f"Drifted features: {[k for k, v in drift_metrics.items() if v.get('drifted')]}"
        )
    elif status == "Warning":
        logger.warning(
            f"ALERT: Feature drift detected on one or more variables "
            f"(combined_ratio={drift_ratio * 100:.1f}%%). Monitor closely and consider retraining."
        )

    return {
        "status": status,
        "message": message,
        "model_name": model_name,
        "model_version": model_version,
        "last_trained": training_date,
        "drift_detected": is_drifted,
        "drift_ratio": drift_ratio,
        "metrics": val_metrics,
        "drift_details": drift_metrics,
    }
