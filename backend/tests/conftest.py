import os
import sys

os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("JWT_SECRET", "test-jwt-secret-for-pytest-only-not-for-production")
os.environ.setdefault(
    "ADMIN_PASSWORD_HASH",
    "$2b$12$w5uwmvOZ7LEYex5dC7L3/uzqj0jXnSsOJuwwj3zAXWDjE5jRi8LUG",
)
os.environ.setdefault("ALLOW_USER_REGISTRATION", "true")

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
project_root = os.path.abspath(os.path.join(backend_dir, ".."))
for path in (backend_dir, project_root):
    if path not in sys.path:
        sys.path.insert(0, path)

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.database.session as session_module
from app.database.base import Base
from app.database.models.customer import Customer
from app.database.models.prediction import Prediction
from app.database.models.uploads import Upload
from app.database.models.user import User

TEST_DATABASE_URL = "sqlite:///:memory:"
test_engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)
session_module.SessionLocal = TestingSessionLocal

from app.main import app


@pytest.fixture(scope="session", autouse=True)
def setup_test_database():
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture(autouse=True)
def clean_tables():
    db = TestingSessionLocal()
    db.query(Prediction).delete()
    db.query(Customer).delete()
    db.query(Upload).delete()
    db.query(User).delete()
    db.commit()
    db.close()


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def auth_headers(client):
    login_resp = client.post(
        "/api/v1/auth/login",
        data={"username": "admin", "password": "password"},
    )
    assert login_resp.status_code == 200
    return {"Authorization": f"Bearer {login_resp.json()['access_token']}"}


@pytest.fixture
def db_session():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
