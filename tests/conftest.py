import os
import sys

# Mirror backend test env before root-level tests import the FastAPI app.
os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("JWT_SECRET", "test-jwt-secret-for-pytest-only-not-for-production")
os.environ.setdefault(
    "ADMIN_PASSWORD_HASH",
    "$2b$12$w5uwmvOZ7LEYex5dC7L3/uzqj0jXnSsOJuwwj3zAXWDjE5jRi8LUG",
)
os.environ.setdefault("ALLOW_USER_REGISTRATION", "true")

project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
backend_dir = os.path.join(project_root, "backend")
for path in (backend_dir, project_root):
    if path not in sys.path:
        sys.path.insert(0, path)
