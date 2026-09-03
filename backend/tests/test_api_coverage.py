"""Additional API coverage: auth flows, analytics, upload edge cases, predict helpers."""

import pandas as pd

from app.core.config import settings

SAMPLE_CSV_HEADER = (
    "customerID,gender,SeniorCitizen,Partner,Dependents,tenure,PhoneService,MultipleLines,InternetService,"
    "OnlineSecurity,OnlineBackup,DeviceProtection,TechSupport,StreamingTV,StreamingMovies,Contract,"
    "PaperlessBilling,PaymentMethod,MonthlyCharges,TotalCharges,Churn\n"
)
SAMPLE_CSV_ROW = (
    "1234-ABCD,Male,0,No,No,5,Yes,No,Fiber optic,No,No,No,No,No,No,Month-to-month,Yes,Electronic check,75.0,375.0,Yes\n"
)


def _upload_csv(client, headers: dict, content: str) -> int:
    resp = client.post(
        "/api/v1/upload",
        headers=headers,
        files={"file": ("sample.csv", content, "text/csv")},
    )
    assert resp.status_code == 202
    return resp.json()["upload_id"]


def test_invalid_jwt_rejected(client):
    resp = client.get(
        "/api/v1/analytics/overview",
        headers={"Authorization": "Bearer not-a-valid-token"},
    )
    assert resp.status_code == 401


def test_registration_disabled(client, monkeypatch):
    monkeypatch.setattr(settings, "ALLOW_USER_REGISTRATION", False)
    resp = client.post(
        "/api/v1/auth/register",
        json={
            "username": "blockeduser",
            "password": "password123",
            "security_question": "Color?",
            "security_answer": "blue",
        },
    )
    assert resp.status_code == 403


def test_password_reset_flow(client):
    client.post(
        "/api/v1/auth/register",
        json={
            "username": "resetuser",
            "password": "oldpassword",
            "security_question": "Favorite pet?",
            "security_answer": "cat",
        },
    )

    login_resp = client.post(
        "/api/v1/auth/login",
        data={"username": "resetuser", "password": "oldpassword"},
    )
    assert login_resp.status_code == 200
    old_token = login_resp.json()["access_token"]
    assert (
        client.get(
            "/api/v1/analytics/overview",
            headers={"Authorization": f"Bearer {old_token}"},
        ).status_code
        == 200
    )

    assert client.get("/api/v1/auth/security-question/resetuser").status_code == 200
    assert client.post(
        "/api/v1/auth/reset-password",
        json={"username": "resetuser", "security_answer": "dog", "new_password": "newpass"},
    ).status_code == 400
    assert client.post(
        "/api/v1/auth/reset-password",
        json={"username": "resetuser", "security_answer": "cat", "new_password": "newpass"},
    ).status_code == 200
    assert (
        client.get(
            "/api/v1/analytics/overview",
            headers={"Authorization": f"Bearer {old_token}"},
        ).status_code
        == 401
    )
    assert client.post(
        "/api/v1/auth/login",
        data={"username": "resetuser", "password": "oldpassword"},
    ).status_code == 401
    new_login = client.post(
        "/api/v1/auth/login",
        data={"username": "resetuser", "password": "newpass"},
    )
    assert new_login.status_code == 200
    assert (
        client.get(
            "/api/v1/analytics/overview",
            headers={"Authorization": f"Bearer {new_login.json()['access_token']}"},
        ).status_code
        == 200
    )


def test_security_question_blocks_admin(client):
    resp = client.get(f"/api/v1/auth/security-question/{settings.ADMIN_USERNAME}")
    assert resp.status_code == 400


def test_analytics_empty_overview(client, auth_headers):
    data = client.get("/api/v1/analytics/overview", headers=auth_headers).json()
    assert data["total_customers"] == 0
    assert data["risk_distribution"]["high"] == 0


def test_diagnostics_metadata(client, auth_headers):
    data = client.get("/api/v1/analytics/diagnostics-metadata", headers=auth_headers).json()
    assert "model_version" in data
    assert "drift_detected" in data


def test_cohort_pagination(client, auth_headers):
    rows = "".join(
        f"CUST-{i},Male,0,No,No,5,Yes,No,Fiber optic,No,No,No,No,No,No,"
        f"Month-to-month,Yes,Electronic check,75.0,375.0,Yes\n"
        for i in range(3)
    )
    _upload_csv(client, auth_headers, SAMPLE_CSV_HEADER + rows)

    payload = client.get(
        "/api/v1/analytics/cohort-data?page=1&page_size=2",
        headers=auth_headers,
    ).json()
    assert payload["total"] == 3
    assert len(payload["items"]) == 2
    assert payload["total_pages"] == 2


def test_upload_status_endpoint(client, auth_headers):
    upload_id = _upload_csv(client, auth_headers, SAMPLE_CSV_HEADER + SAMPLE_CSV_ROW)
    data = client.get(f"/api/v1/uploads/{upload_id}/status", headers=auth_headers).json()
    assert data["status"] == "completed"
    assert data["row_count"] == 1


def test_upload_status_not_found(client, auth_headers):
    assert client.get("/api/v1/uploads/99999/status", headers=auth_headers).status_code == 404


def test_upload_rejects_non_csv(client, auth_headers):
    files = {"file": ("data.txt", "not,a,csv", "text/plain")}
    assert client.post("/api/v1/upload", headers=auth_headers, files=files).status_code == 400


def test_upload_rejects_oversized_file(client, auth_headers, monkeypatch):
    monkeypatch.setattr(settings, "MAX_UPLOAD_SIZE_MB", 0)
    files = {"file": ("big.csv", SAMPLE_CSV_HEADER + SAMPLE_CSV_ROW, "text/csv")}
    assert client.post("/api/v1/upload", headers=auth_headers, files=files).status_code == 413


def test_customer_search(client, auth_headers):
    _upload_csv(client, auth_headers, SAMPLE_CSV_HEADER + SAMPLE_CSV_ROW)
    assert client.get("/api/v1/customers/search?q=", headers=auth_headers).json() == []
    assert "1234-ABCD" in client.get("/api/v1/customers/search?q=1234", headers=auth_headers).json()


def test_explain_unknown_customer_404(client, auth_headers):
    assert client.get("/api/v1/customers/UNKNOWN-ID/explain", headers=auth_headers).status_code == 404


def test_simulate_prediction(client, auth_headers):
    payload = {
        "customerID": "SIM-001",
        "gender": "Male",
        "SeniorCitizen": 0,
        "Partner": "No",
        "Dependents": "No",
        "tenure": 12,
        "PhoneService": "Yes",
        "MultipleLines": "No",
        "InternetService": "Fiber optic",
        "OnlineSecurity": "No",
        "OnlineBackup": "No",
        "DeviceProtection": "No",
        "TechSupport": "No",
        "StreamingTV": "No",
        "StreamingMovies": "No",
        "Contract": "Month-to-month",
        "PaperlessBilling": "Yes",
        "PaymentMethod": "Electronic check",
        "MonthlyCharges": 75.0,
        "TotalCharges": 900.0,
    }
    resp = client.post("/api/v1/predict/simulate", headers=auth_headers, json=payload)
    assert resp.status_code == 200
    assert 0.0 <= resp.json()["simulated_probability"] <= 1.0


def test_model_health_endpoint(client, auth_headers, monkeypatch):
    monkeypatch.setattr(
        "app.services.prediction_service.get_preprocessed_active_customers",
        lambda db: pd.DataFrame(),
    )
    monkeypatch.setattr(
        "ml.training.model_monitor.get_system_health",
        lambda X: {
            "status": "Healthy",
            "model_version": "1.1.0",
            "drift_detected": False,
            "drift_ratio": 0.0,
            "drift_details": {},
            "metrics": {},
            "message": "ok",
            "model_name": "ensemble",
            "last_trained": "N/A",
        },
    )
    data = client.get("/api/v1/analytics/model-health", headers=auth_headers).json()
    assert data["status"] == "Healthy"
