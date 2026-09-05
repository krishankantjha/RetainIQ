"""Tests for per-user upload and cohort data isolation."""

import io

import pandas as pd
import pytest

from app.database.models.uploads import Upload
from app.database.models.user import User


@pytest.fixture
def telco_csv_bytes():
    df = pd.DataFrame(
        {
            "customerID": ["user-a-001"],
            "gender": ["Male"],
            "SeniorCitizen": [0],
            "Partner": ["Yes"],
            "Dependents": ["No"],
            "tenure": [12],
            "PhoneService": ["Yes"],
            "MultipleLines": ["No"],
            "InternetService": ["DSL"],
            "OnlineSecurity": ["No"],
            "OnlineBackup": ["Yes"],
            "DeviceProtection": ["No"],
            "TechSupport": ["No"],
            "StreamingTV": ["No"],
            "StreamingMovies": ["No"],
            "Contract": ["Month-to-month"],
            "PaperlessBilling": ["Yes"],
            "PaymentMethod": ["Electronic check"],
            "MonthlyCharges": [70.0],
            "TotalCharges": ["840"],
            "Churn": ["No"],
        }
    )
    return df.to_csv(index=False).encode("utf-8")


def _register_and_login(client, email: str, password: str = "secret12") -> dict:
    register_resp = client.post(
        "/api/v1/auth/register",
        json={
            "username": email,
            "full_name": "Test User",
            "password": password,
            "security_question": "Favorite color?",
            "security_answer": "blue",
        },
    )
    assert register_resp.status_code == 201

    login_resp = client.post(
        "/api/v1/auth/login",
        data={"username": email, "password": password},
    )
    assert login_resp.status_code == 200
    token = login_resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_uploads_are_isolated_between_users(client, db_session, telco_csv_bytes):
    user_a_headers = _register_and_login(client, "user-a@example.com")
    user_b_headers = _register_and_login(client, "user-b@example.com")

    upload_resp = client.post(
        "/api/v1/upload",
        headers=user_a_headers,
        files={"file": ("cohort.csv", io.BytesIO(telco_csv_bytes), "text/csv")},
    )
    assert upload_resp.status_code == 202
    upload_id = upload_resp.json()["upload_id"]

    user_a = db_session.query(User).filter(User.username == "user-a@example.com").one()
    upload = db_session.query(Upload).filter(Upload.id == upload_id).one()
    assert upload.user_id == user_a.id

    user_b_history = client.get("/api/v1/uploads", headers=user_b_headers)
    assert user_b_history.status_code == 200
    assert user_b_history.json() == []

    user_b_status = client.get(f"/api/v1/uploads/{upload_id}/status", headers=user_b_headers)
    assert user_b_status.status_code == 404

    user_b_overview = client.get("/api/v1/analytics/overview", headers=user_b_headers)
    assert user_b_overview.status_code == 200
    assert user_b_overview.json()["total_customers"] == 0


def test_admin_sees_all_uploads(client, db_session, auth_headers, telco_csv_bytes):
    user_headers = _register_and_login(client, "scoped-user@example.com")
    upload_resp = client.post(
        "/api/v1/upload",
        headers=user_headers,
        files={"file": ("cohort.csv", io.BytesIO(telco_csv_bytes), "text/csv")},
    )
    assert upload_resp.status_code == 202

    admin_history = client.get("/api/v1/uploads", headers=auth_headers)
    assert admin_history.status_code == 200
    assert len(admin_history.json()) >= 1
