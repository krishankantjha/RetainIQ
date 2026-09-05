# Deployment Guide: RetainIQ Customer Retention Platform

This guide covers the **default local stack** (SQLite + single admin) and optional environment configuration.

> See **[docs/LOCAL_SETUP.md](LOCAL_SETUP.md)** for default credentials, messaging, and scope.

---

## Database (SQLite — default)

RetainIQ uses a **SQLite file** by default to persist:

- Upload metadata
- Scored **subscriber rows** (Telco schema cohort data)
- Predictions, SHAP drivers, and save plays

```env
DATABASE_URL=sqlite:///./customer_retention.db
```

**Local file:** `backend/customer_retention.db` (gitignored)

**Docker:** volume `retainiq_sqlite` mounted at `/app/backend/data/`

### Optional: PostgreSQL

The codebase still accepts `DATABASE_URL=postgresql://...` for future scaling. Docker Compose **no longer** starts Postgres by default.

---

## 1. Infrastructure topology (default stack)

```mermaid
graph TD
    User([Browser]) -->|Port 80| Proxy[Nginx]
    Proxy -->|80| React[React SPA]
    Proxy -->|8000| FastAPI[FastAPI API]
    React -->|REST + JWT| FastAPI
    FastAPI -->|SQLite file| DB[(cohort store)]
```

Services: **backend**, **frontend**, **nginx** — no separate database container.

---

## 2. Docker Compose

From the `docker/` folder (loads repo root `.env`):

```bash
docker compose --env-file ../.env up --build
```

Key environment variables (see root `.env.example`):

| Variable | Default |
|----------|---------|
| `DATABASE_URL` | `sqlite:///./data/customer_retention.db` |
| `ALLOW_USER_REGISTRATION` | `false` |
| `APP_ENV` | `development` |

**Default login** (development): `admin` / `password`

---

## 3. Environment Variables Specification

Customize application behavior at startup by supplying the following variables:

### Backend Application Environment
| Variable Name | Type | Default Value | Description |
| :--- | :---: | :--- | :--- |
| `APP_ENV` | String | `development` | Deployment environment mode (`development`, `production`). |
| `DEBUG` | Boolean | `True` | Enables debug log output and verbose traceback responses. |
| `DATABASE_URL` | String | `sqlite:///./customer_retention.db` | Connection URI. Defaults to local SQLite if unset. |
| `ALLOWED_ORIGINS` | String | `http://localhost:5173,http://127.0.0.1:5173` | Comma-separated list of allowed CORS domains. |
| `JWT_SECRET` | String | (Default string) | HMAC-SHA256 signing secret. **Mandatory override in production**; server will refuse to start if default is used. |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Integer | `60` | Lifecycle duration of user auth sessions. |

### Frontend build (Vite)

Set at **image build time** via `docker/frontend.Dockerfile`:

| Variable | Default | Description |
| :--- | :--- | :--- |
| `VITE_API_BASE_URL` | *(empty)* | API root for browser `fetch`. Empty = same-origin `/api` through nginx. Set in repo root `.env` for direct API URL. |

---

## 4. Database Migrations (Alembic)

The codebase utilizes Alembic for tracking structural database changes.

To initialize or upgrade your production database schema:
```bash
# Run from the 'backend' folder
alembic upgrade head
```

If deploying inside Docker, run the migration inside the running backend container:
```bash
docker exec -it retainiq-backend alembic upgrade head
```

---

## 5. Reverse Proxy Configuration

The React SPA is static files served by nginx in the `frontend` container. The root `nginx` service proxies `/` to `frontend:80` and `/api/` to `backend:8000`.

See `docker/nginx.conf` and `docker/frontend.nginx.conf`.

---

## 6. Security & Rate Limiting

To protect public endpoints, the backend uses a sliding-window rate limiter.
- **Upload & Explain Route Limit**: 60 requests per minute per client key (token or IP).
- **Auth Login Route Limit**: 10 requests per minute per client key (prevents brute-force credential attacks).
- **Target Paths**: `/api/v1/auth/login`, `/api/v1/upload`, `/api/v1/customers/{customer_id}/explain`.
- **Status Response**: Returns `429 Too Many Requests` with a JSON payload: `{"detail": "Too many requests. Please try again later."}`.
- **Stale Key Eviction**: The in-memory rate limiter database is pruned every 500 requests to prevent memory growth.

---

## 7. ML Artifact Retraining & CI/CD Pipeline

The platform implements a strict SHA-256 integrity verification system. If model artifacts are regenerated, `artifacts_manifest.json` must be updated, otherwise the application server will refuse to start.

### Retraining Workflow

See **[docs/ml_pipeline.md](docs/ml_pipeline.md)** for the full v1.1 run order. Summary:

```bash
python ml/preprocessing/clean.py
python ml/preprocessing/pipeline.py
python ml/segmentation/train_autoencoder.py
python ml/segmentation/kmeans.py
python ml/training/ensemble.py
python ml/training/threshold.py
python ml/training/confusion_matrix.py
python ml/training/calibration.py
python ml/explainability/shap_global.py
python scripts/generate_manifest.py
```

Production classifier: `ml/artifacts/models/ensemble_model.pkl` (not `model.pkl`).

### GitHub Actions CI/CD Skeleton
```yaml
name: Weekly Model Retrain & Deploy

on:
  workflow_dispatch:           # Manual trigger
  schedule:
    - cron: "0 2 * * 0"        # Weekly retraining on Sunday at 2 AM

jobs:
  retrain:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install dependencies
        run: pip install -r backend/requirements-dev.txt
      - name: Run training pipeline & signatures
        run: make retrain
      - name: Run test suite
        run: pytest tests/ -v
      - name: Build & push Docker image
        run: |
          docker build -t retainiq-backend:latest -f backend/Dockerfile .
          docker push ghcr.io/${{ github.repository }}/retainiq-backend:latest
      - name: Deploy to Production
        run: ssh deploy@prod "cd /opt/retainiq/docker && docker-compose pull && docker-compose up -d"
```

---

## 8. Execution Commands

To build and start the platform services locally or on a server:

```bash
# Set required environment secrets (or populate a .env file)
export JWT_SECRET="$(openssl rand -hex 32)"
export POSTGRES_PASSWORD="$(openssl rand -hex 16)"

# Navigate to the docker orchestration folder
cd docker

# Build and startup all services in the background
docker compose --env-file ../.env up --build -d

# Check startup logs and health status
docker-compose logs -f

# Run database schema migrations
docker exec -it retainiq-backend alembic upgrade head

# Shutdown services and clean up network resources
docker-compose down
```
