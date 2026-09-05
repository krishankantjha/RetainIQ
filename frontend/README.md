# RetainIQ Web UI

React + Vite single-page app for RetainIQ authentication and dashboard.

## Prerequisites

- Node.js 20+
- Backend running at http://127.0.0.1:8000

## Setup

```bash
cp .env.example .env   # from repo root
cd frontend
npm install
```

## Development

```bash
npm run dev
```

Open http://localhost:5173

Default local login: `admin` / `password` (when backend `APP_ENV=development`).

## Production build

```bash
npm run build
npm run preview
```

`dist/` is served by the Docker frontend image (see `docker/frontend.Dockerfile`).

## Environment

All variables live in the **repo root** `.env`. Vite reads only `VITE_*` keys.

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_BASE_URL` | *(empty)* | FastAPI base URL (empty = same-origin `/api` via nginx or Vite proxy) |
| `VITE_GUEST_USERNAME` | `admin` | One-click login username |
| `VITE_GUEST_PASSWORD` | `password` | One-click login password |
