from app.database.models.uploads import Upload


def test_unauthorized_endpoints(client):
    assert client.post("/api/v1/upload").status_code == 401
    assert client.get("/api/v1/customers/1234-ABCD/explain").status_code == 401
    assert client.get("/api/v1/analytics/overview").status_code == 401
    assert client.get("/api/v1/analytics/save-plays").status_code == 401


def test_login_and_token_generation(client):
    bad_login = client.post(
        "/api/v1/auth/login",
        data={"username": "admin", "password": "wrongpassword"},
    )
    assert bad_login.status_code == 401
    assert bad_login.json()["detail"] == "Incorrect password."

    missing_login = client.post(
        "/api/v1/auth/login",
        data={"username": "nobody@example.com", "password": "password123"},
    )
    assert missing_login.status_code == 401
    assert missing_login.json()["detail"] == "No account found for this email. Sign up to create one."

    good_login = client.post(
        "/api/v1/auth/login",
        data={"username": "admin", "password": "password"},
    )
    assert good_login.status_code == 200
    data = good_login.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["username"] == "admin"
    assert data["full_name"] == "Admin"


def test_full_pipeline_and_endpoints(client, auth_headers, db_session):
    csv_content = (
        "customerID,gender,SeniorCitizen,Partner,Dependents,tenure,PhoneService,MultipleLines,InternetService,"
        "OnlineSecurity,OnlineBackup,DeviceProtection,TechSupport,StreamingTV,StreamingMovies,Contract,"
        "PaperlessBilling,PaymentMethod,MonthlyCharges,TotalCharges,Churn\n"
        "1234-ABCD,Male,0,No,No,5,Yes,No,Fiber optic,No,No,No,No,No,No,Month-to-month,Yes,Electronic check,75.0,375.0,Yes\n"
        "5678-EFGH,Female,1,Yes,No,36,Yes,Yes,Fiber optic,Yes,No,Yes,No,Yes,Yes,One year,No,Credit card (automatic),105.0,3780.0,No\n"
    )
    files = {"file": ("test_cohort.csv", csv_content, "text/csv")}
    upload_resp = client.post("/api/v1/upload", headers=auth_headers, files=files)
    assert upload_resp.status_code == 202
    assert upload_resp.json()["status"] == "pending"
    upload_id = upload_resp.json()["upload_id"]

    upload = db_session.query(Upload).filter(Upload.id == upload_id).first()
    assert upload is not None
    assert upload.status == "completed"
    assert upload.row_count == 2

    explain_resp = client.get("/api/v1/customers/1234-ABCD/explain", headers=auth_headers)
    assert explain_resp.status_code == 200
    explain_data = explain_resp.json()
    assert explain_data["customer_id"] == "1234-ABCD"
    assert 0.0 <= explain_data["churn_probability"] <= 1.0
    assert len(explain_data["top_drivers"]) > 0
    assert isinstance(explain_data["cluster"], int)

    overview_data = client.get("/api/v1/analytics/overview", headers=auth_headers).json()
    assert overview_data["total_customers"] == 2

    plays_data = client.get("/api/v1/analytics/save-plays", headers=auth_headers).json()
    assert isinstance(plays_data, list)

    cohort_payload = client.get("/api/v1/analytics/cohort-data", headers=auth_headers).json()
    assert cohort_payload["total"] == 2
    assert len(cohort_payload["items"]) == 2


def test_upload_duplicate_customer_ids(client, auth_headers, db_session):
    csv_content = (
        "customerID,gender,SeniorCitizen,Partner,Dependents,tenure,PhoneService,MultipleLines,InternetService,"
        "OnlineSecurity,OnlineBackup,DeviceProtection,TechSupport,StreamingTV,StreamingMovies,Contract,"
        "PaperlessBilling,PaymentMethod,MonthlyCharges,TotalCharges,Churn\n"
        "1234-ABCD,Male,0,No,No,5,Yes,No,Fiber optic,No,No,No,No,No,No,Month-to-month,Yes,Electronic check,75.0,375.0,Yes\n"
        "1234-ABCD,Female,1,Yes,No,36,Yes,Yes,Fiber optic,Yes,No,Yes,No,Yes,Yes,One year,No,Credit card (automatic),105.0,3780.0,No\n"
    )
    upload_resp = client.post(
        "/api/v1/upload",
        headers=auth_headers,
        files={"file": ("test_duplicate.csv", csv_content, "text/csv")},
    )
    assert upload_resp.status_code == 202
    upload = db_session.query(Upload).filter(Upload.id == upload_resp.json()["upload_id"]).first()
    assert upload.status == "failed"
    assert "duplicate customer IDs" in upload.error_message


def test_upload_non_utf8_encoding(client, auth_headers, db_session):
    csv_content_bytes = (
        "customerID,gender,SeniorCitizen,Partner,Dependents,tenure,PhoneService,MultipleLines,InternetService,"
        "OnlineSecurity,OnlineBackup,DeviceProtection,TechSupport,StreamingTV,StreamingMovies,Contract,"
        "PaperlessBilling,PaymentMethod,MonthlyCharges,TotalCharges,Churn\n"
        "9999-\u00e9XYZ,Male,0,No,No,5,Yes,No,Fiber optic,No,No,No,No,No,No,Month-to-month,Yes,Electronic check,75.0,375.0,Yes\n"
    ).encode("latin-1")
    upload_resp = client.post(
        "/api/v1/upload",
        headers=auth_headers,
        files={"file": ("test_latin.csv", csv_content_bytes, "text/csv")},
    )
    assert upload_resp.status_code == 202
    upload = db_session.query(Upload).filter(Upload.id == upload_resp.json()["upload_id"]).first()
    assert upload.status == "completed"
    assert upload.row_count == 1


def test_user_registration_and_authentication(client):
    reg_resp = client.post(
        "/api/v1/auth/register",
        json={
            "username": "customuser@example.com",
            "full_name": "Custom User",
            "password": "custompassword",
            "security_question": "What is your favorite color?",
            "security_answer": "blue",
        },
    )
    assert reg_resp.status_code == 201

    duplicate_reg = client.post(
        "/api/v1/auth/register",
        json={
            "username": "customuser@example.com",
            "full_name": "Another User",
            "password": "differentpassword",
            "security_question": "What is your favorite color?",
            "security_answer": "blue",
        },
    )
    assert duplicate_reg.status_code == 400

    login_resp = client.post(
        "/api/v1/auth/login",
        data={"username": "customuser@example.com", "password": "custompassword"},
    )
    assert login_resp.status_code == 200
    headers = {"Authorization": f"Bearer {login_resp.json()['access_token']}"}
    assert client.get("/api/v1/analytics/overview", headers=headers).status_code == 200
