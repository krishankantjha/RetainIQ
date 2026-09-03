import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

from configs.dataset_config import config_loader
from ml.preprocessing.clean import fix_whitespace_blanks, fix_total_charges, drop_duplicates

logger = logging.getLogger("backend.app.services.ingestion")

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
artifacts_dir_relative = config_loader.training["data_paths"].get("artifacts_dir", "ml/artifacts")
artifacts_dir = os.path.join(PROJECT_ROOT, artifacts_dir_relative)


def _monthly_audit_log_path(now: datetime | None = None) -> Path:
    """Resolve the monthly audit log path and ensure it stays inside metrics/."""
    metrics_dir = (Path(artifacts_dir) / "metrics").resolve()
    metrics_dir.mkdir(parents=True, exist_ok=True)

    ts = now or datetime.now(timezone.utc)
    month_str = ts.strftime("%Y-%m")
    if len(month_str) != 7 or month_str[4] != "-":
        raise ValueError("Invalid audit log partition key")

    log_path = (metrics_dir / f"prediction_logs_{month_str}.jsonl").resolve()
    if log_path.parent != metrics_dir:
        raise ValueError("Audit log path must stay inside metrics directory")
    return log_path


def log_prediction_events(customer_ids: list, y_probs: np.ndarray, is_high_risks: np.ndarray, cluster_labels: np.ndarray):
    """
    Appends predictions audit trail to monthly-partitioned JSONL files.
    Files are rotated monthly (prediction_logs_YYYY-MM.jsonl)
    to prevent a single file growing unboundedly in production.
    """
    now = datetime.now(timezone.utc)
    log_path = _monthly_audit_log_path(now)
    timestamp = now.isoformat().replace("+00:00", "Z")

    try:
        lines = []
        for i, cid in enumerate(customer_ids):
            record = {
                "timestamp": timestamp,
                "customer_id": str(cid),
                "churn_probability": float(y_probs[i]),
                "is_high_risk": bool(is_high_risks[i]),
                "cluster": int(cluster_labels[i]),
            }
            lines.append(json.dumps(record))

        with open(log_path, "a", encoding="utf-8") as f:
            f.write("\n".join(lines) + "\n")
        logger.info(f"Successfully logged {len(customer_ids)} predictions to audit trail: {log_path}")
    except Exception as e:
        logger.error(f"Failed to write prediction logs to audit trail: {e}")


def clean_uploaded_data(df: pd.DataFrame) -> pd.DataFrame:
    """Applies basic data cleaning matching the ML data cleaning steps."""
    logger.info("Cleaning uploaded dataframe...")
    df_clean = df.copy()
    
    # Standardize columns casing to match expected
    col_mapping = {
        "customerid": "customerID",
        "seniorcitizen": "SeniorCitizen",
        "phoneservice": "PhoneService",
        "multiplelines": "MultipleLines",
        "internetservice": "InternetService",
        "onlinesecurity": "OnlineSecurity",
        "onlinebackup": "OnlineBackup",
        "deviceprotection": "DeviceProtection",
        "techsupport": "TechSupport",
        "streamingtv": "StreamingTV",
        "streamingmovies": "StreamingMovies",
        "paperlessbilling": "PaperlessBilling",
        "paymentmethod": "PaymentMethod",
        "monthlycharges": "MonthlyCharges",
        "totalcharges": "TotalCharges",
        "churn": "Churn"
    }
    # Apply casing standardization for any columns that might be lowercase
    df_clean = df_clean.rename(columns=lambda c: col_mapping.get(c.lower(), c))
    
    target_col = config_loader.feature.get("target_column", "Churn")
    # 21 columns required (or 20 if Churn is missing, we'll insert a placeholder Churn)
    if target_col not in df_clean.columns:
        df_clean[target_col] = None
        
    df_clean = fix_whitespace_blanks(df_clean, logger)
    df_clean = fix_total_charges(df_clean, logger)
    df_clean = drop_duplicates(df_clean, logger, strict_id_unique=True)
    
    # Reset index to ensure 0-based sequential row indexing
    df_clean = df_clean.reset_index(drop=True)
    return df_clean
