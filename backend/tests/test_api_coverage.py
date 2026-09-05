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
            "username": "blockeduser@example.com",
            "full_name": "Blocked User",
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
            "username": "resetuser@example.com",
            "full_name": "Reset User",
            "password": "oldpassword",
            "security_question": "Favorite pet?",
            "security_answer": "cat",
        },
    )

    login_resp = client.post(
        "/api/v1/auth/login",
        data={"username": "resetuser@example.com", "password": "oldpassword"},
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

    assert client.get("/api/v1/auth/security-question/resetuser%40example.com").status_code == 200
    assert client.post(
        "/api/v1/auth/reset-password",
        json={"username": "resetuser@example.com", "security_answer": "dog", "new_password": "newpass"},
    ).status_code == 400
    assert client.post(
        "/api/v1/auth/reset-password",
        json={"username": "resetuser@example.com", "security_answer": "cat", "new_password": "newpass"},
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
        data={"username": "resetuser@example.com", "password": "oldpassword"},
    ).status_code == 401
    new_login = client.post(
        "/api/v1/auth/login",
        data={"username": "resetuser@example.com", "password": "newpass"},
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
    assert "cohort_persona" in payload["items"][0]


def test_cohort_filters_and_personas(client, auth_headers):
    _upload_csv(client, auth_headers, SAMPLE_CSV_HEADER + SAMPLE_CSV_ROW)

    personas = client.get("/api/v1/analytics/personas", headers=auth_headers).json()
    assert personas["total_subscribers"] == 1
    assert len(personas["personas"]) >= 1

    filtered = client.get(
        "/api/v1/analytics/cohort-data?contract=Month-to-month&sort_by=churn_probability&sort_dir=desc",
        headers=auth_headers,
    ).json()
    assert filtered["total"] == 1
    assert filtered["items"][0]["contract"] == "Month-to-month"

    empty_campaign = client.get(
        "/api/v1/analytics/cohort-data?campaign=Nonexistent%20Campaign",
        headers=auth_headers,
    ).json()
    assert empty_campaign["total"] == 0
    assert empty_campaign["items"] == []


SINGLE_SCORE_PAYLOAD = {
    "customerID": "SCORE-001",
    "gender": "Male",
    "SeniorCitizen": 0,
    "Partner": "No",
    "Dependents": "No",
    "tenure": 8,
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
    "MonthlyCharges": 85.0,
    "TotalCharges": 680.0,
}


def test_upload_threshold_persisted(client, auth_headers):
    resp = client.post(
        "/api/v1/upload?threshold=0.25",
        headers=auth_headers,
        files={"file": ("sample.csv", SAMPLE_CSV_HEADER + SAMPLE_CSV_ROW, "text/csv")},
    )
    assert resp.status_code == 202
    body = resp.json()
    assert body["decision_threshold"] == 0.25

    status = client.get(f"/api/v1/uploads/{body['upload_id']}/status", headers=auth_headers).json()
    assert status["decision_threshold"] == 0.25


def test_score_single_customer(client, auth_headers):
    resp = client.post(
        "/api/v1/predict/score?threshold=0.35",
        headers=auth_headers,
        json=SINGLE_SCORE_PAYLOAD,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["customer_id"] == "SCORE-001"
    assert 0.0 <= data["churn_probability"] <= 1.0
    assert len(data["top_drivers"]) > 0

    explain = client.get("/api/v1/customers/SCORE-001/explain", headers=auth_headers)
    assert explain.status_code == 200

    history = client.get("/api/v1/uploads?limit=5", headers=auth_headers).json()
    assert any(item["filename"].startswith("single-score-") for item in history)


def test_score_requires_customer_id(client, auth_headers):
    payload = dict(SINGLE_SCORE_PAYLOAD)
    payload.pop("customerID")
    resp = client.post("/api/v1/predict/score", headers=auth_headers, json=payload)
    assert resp.status_code == 400


def test_update_user_profile(client, auth_headers):
    client.post(
        "/api/v1/auth/register",
        json={
            "username": "profileuser@example.com",
            "full_name": "Original Name",
            "password": "password123",
            "security_question": "Color?",
            "security_answer": "blue",
        },
    )
    login_resp = client.post(
        "/api/v1/auth/login",
        data={"username": "profileuser@example.com", "password": "password123"},
    )
    headers = {"Authorization": f"Bearer {login_resp.json()['access_token']}"}

    patch_resp = client.patch(
        "/api/v1/auth/me",
        headers=headers,
        json={"full_name": "Updated Name"},
    )
    assert patch_resp.status_code == 200
    assert patch_resp.json()["full_name"] == "Updated Name"

    me_resp = client.get("/api/v1/auth/me", headers=headers)
    assert me_resp.json()["full_name"] == "Updated Name"


def test_login_returns_profile(client):
    client.post(
        "/api/v1/auth/register",
        json={
            "username": "loginprofile@example.com",
            "full_name": "Login Profile",
            "password": "password123",
            "security_question": "Color?",
            "security_answer": "blue",
        },
    )
    login_resp = client.post(
        "/api/v1/auth/login",
        data={"username": "loginprofile@example.com", "password": "password123"},
    )
    assert login_resp.status_code == 200
    body = login_resp.json()
    assert body["username"] == "loginprofile@example.com"
    assert body["full_name"] == "Login Profile"


def test_change_password(client):
    client.post(
        "/api/v1/auth/register",
        json={
            "username": "passuser@example.com",
            "full_name": "Pass User",
            "password": "oldpassword",
            "security_question": "Color?",
            "security_answer": "blue",
        },
    )
    login_resp = client.post(
        "/api/v1/auth/login",
        data={"username": "passuser@example.com", "password": "oldpassword"},
    )
    headers = {"Authorization": f"Bearer {login_resp.json()['access_token']}"}

    bad = client.post(
        "/api/v1/auth/change-password",
        headers=headers,
        json={"current_password": "wrongpass", "new_password": "newpassword1"},
    )
    assert bad.status_code == 400

    ok = client.post(
        "/api/v1/auth/change-password",
        headers=headers,
        json={"current_password": "oldpassword", "new_password": "newpassword1"},
    )
    assert ok.status_code == 200

    old_login = client.post(
        "/api/v1/auth/login",
        data={"username": "passuser@example.com", "password": "oldpassword"},
    )
    assert old_login.status_code == 401

    new_login = client.post(
        "/api/v1/auth/login",
        data={"username": "passuser@example.com", "password": "newpassword1"},
    )
    assert new_login.status_code == 200


def test_diagnostics_plots(client, auth_headers):
    plots = client.get("/api/v1/analytics/diagnostics-plots", headers=auth_headers).json()
    assert isinstance(plots, list)
    assert any(p["id"] == "roc_curve" for p in plots)

    available = next(p for p in plots if p["id"] == "roc_curve" and p["available"])
    resp = client.get(
        f"/api/v1/analytics/diagnostics-plots/{available['id']}",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("image/png")


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


def test_simulate_applies_contract_edit(client, auth_headers):
    from tests.test_api_coverage import SAMPLE_CSV_HEADER, SAMPLE_CSV_ROW, _upload_csv

    _upload_csv(client, auth_headers, SAMPLE_CSV_HEADER + SAMPLE_CSV_ROW)

    baseline = client.post(
        "/api/v1/predict/simulate",
        headers=auth_headers,
        json={"customerID": "1234-ABCD", "Contract": "Month-to-month"},
    )
    upgraded = client.post(
        "/api/v1/predict/simulate",
        headers=auth_headers,
        json={"customerID": "1234-ABCD", "Contract": "Two year"},
    )
    assert baseline.status_code == 200
    assert upgraded.status_code == 200
    baseline_prob = baseline.json()["simulated_probability"]
    upgraded_prob = upgraded.json()["simulated_probability"]
    assert upgraded_prob < baseline_prob


def test_model_health_endpoint(client, auth_headers, monkeypatch):
    monkeypatch.setattr(
        "app.services.prediction_service.get_preprocessed_active_customers",
        lambda db, user_id=None: pd.DataFrame(),
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


def test_phase3_analytics_endpoints_empty(client, auth_headers):
    trend = client.get("/api/v1/analytics/risk-trend", headers=auth_headers).json()
    assert trend["points"] == []

    drivers = client.get("/api/v1/analytics/global-drivers", headers=auth_headers).json()
    assert drivers["drivers"] == []
    assert drivers["subscriber_count"] == 0

    matrix = client.get("/api/v1/analytics/segment-matrix", headers=auth_headers).json()
    assert matrix["contracts"] == []
    assert matrix["matrix"] == []

    uploads = client.get("/api/v1/uploads", headers=auth_headers).json()
    assert uploads == []


def test_phase3_analytics_endpoints_with_cohort(client, auth_headers):
    _upload_csv(client, auth_headers, SAMPLE_CSV_HEADER + SAMPLE_CSV_ROW)

    trend = client.get("/api/v1/analytics/risk-trend", headers=auth_headers).json()
    assert len(trend["points"]) >= 1
    assert trend["points"][0]["subscriber_count"] >= 1

    drivers = client.get("/api/v1/analytics/global-drivers", headers=auth_headers).json()
    assert drivers["subscriber_count"] == 1
    assert len(drivers["drivers"]) >= 1

    matrix = client.get("/api/v1/analytics/segment-matrix", headers=auth_headers).json()
    assert len(matrix["contracts"]) >= 1
    assert len(matrix["cells"]) >= 1

    uploads = client.get("/api/v1/uploads", headers=auth_headers).json()
    assert len(uploads) >= 1
    assert uploads[0]["status"] == "completed"
