# RetainIQ — Local setup & default configuration

RetainIQ runs with **SQLite** and a **single admin account** by default. Public sign-up is disabled unless you enable it explicitly.

## Default configuration

| Setting | Default |
|---------|---------|
| **Database** | SQLite file (`backend/customer_retention.db` locally) |
| **Authentication** | Single `admin` account (env-configured password hash) |
| **Registration** | Disabled (`ALLOW_USER_REGISTRATION=false`) |
| **Data scope** | Telecom subscriber cohorts (IBM Telco CSV schema) |

## Default credentials (local development)

When `APP_ENV=development` and `ADMIN_PASSWORD_HASH` is unset:

- **Username:** `admin`
- **Password:** `password`

Change these before any shared or public deployment.

## Quick start (local)

**Backend:**

```bash
cd backend
alembic upgrade head
uvicorn app.main:app --reload
```

**React UI:**

```bash
cd frontend
npm install
npm run dev
```

Environment variables live in the **repo root** `.env` (copy from `.env.example`). Vite reads `VITE_*` keys from there.

Open http://localhost:5173 — sign in with `admin` / `password` (development defaults).

Backend must be running on http://127.0.0.1:8000.

## Docker Compose

```bash
cp .env.example .env
cd docker
docker compose --env-file ../.env up --build
```

- API: http://localhost:8000/docs  
- UI (via nginx): http://localhost  
- UI (frontend container direct): http://localhost:8080  
- SQLite file: Docker volume `retainiq_sqlite` → `/app/backend/data/customer_retention.db`

## Product messaging

Use:

> Upload a **telecom subscriber cohort** (Telco CSV schema). RetainIQ scores churn risk per subscriber and recommends save plays.

Avoid implying support for arbitrary industries or dataset shapes unless you add that capability.

## PostgreSQL (optional)

Not required for local development. Set `DATABASE_URL=postgresql://...` if you need a server database later. Docker Compose does not start Postgres by default.
