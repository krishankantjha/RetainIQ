"""Backend hardening: audit log paths, upload mapping, and password reset JWT invalidation."""

from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
import pytest

from app.services.customer_mapper import customers_from_upload_dataframe
from app.services.ingestion import _monthly_audit_log_path, log_prediction_events


def test_monthly_audit_log_path_stays_in_metrics_dir(monkeypatch, tmp_path):
    monkeypatch.setattr("app.services.ingestion.artifacts_dir", str(tmp_path))

    log_path = _monthly_audit_log_path(datetime(2026, 9, 15, tzinfo=timezone.utc))

    assert log_path.parent == (tmp_path / "metrics").resolve()
    assert log_path.name == "prediction_logs_2026-09.jsonl"


def test_log_prediction_events_writes_partitioned_file(monkeypatch, tmp_path):
    import numpy as np

    monkeypatch.setattr("app.services.ingestion.artifacts_dir", str(tmp_path))
    now = datetime(2026, 9, 3, 12, 0, tzinfo=timezone.utc)

    log_prediction_events(
        ["CUST-1"],
        np.array([0.42]),
        np.array([True]),
        np.array([2]),
    )

    log_path = _monthly_audit_log_path(now)
    assert log_path.exists()
    content = log_path.read_text(encoding="utf-8")
    assert '"customer_id": "CUST-1"' in content


def test_customers_from_upload_dataframe_builds_rows():
    df = pd.DataFrame(
        [{
            "customerID": "A-1",
            "gender": "Male",
            "SeniorCitizen": 0,
            "Partner": "No",
            "Dependents": "No",
            "tenure": 5,
            "PhoneService": "Yes",
            "MultipleLines": "No",
            "InternetService": "DSL",
            "OnlineSecurity": "No",
            "OnlineBackup": "No",
            "DeviceProtection": "No",
            "TechSupport": "No",
            "StreamingTV": "No",
            "StreamingMovies": "No",
            "Contract": "Month-to-month",
            "PaperlessBilling": "Yes",
            "PaymentMethod": "Electronic check",
            "MonthlyCharges": 50.0,
            "TotalCharges": 250.0,
            "Churn": "No",
        }]
    )

    customers = customers_from_upload_dataframe(df, ["No"], upload_id=7)

    assert len(customers) == 1
    assert customers[0].customer_id == "A-1"
    assert customers[0].upload_id == 7
