# Render Foundation Implementation

Date: 2026-08-04
Scope: Backend Phase 1 — Render Foundation

## Implemented

- Added a root `render.yaml` Blueprint for:
  - Docker web service in Singapore
  - Render Postgres in the same region
  - private database access (`ipAllowList: []`)
  - generated backend mutation token
  - explicit production environment
  - frontend CORS value requested during Blueprint creation
  - execution disabled
  - scanner auto-start disabled on the API web service
  - `/api/v1/health/live` health check
- Added `scripts/start-render.sh`:
  - optionally runs Alembic migrations before server startup
  - fails closed if migration fails
  - binds Uvicorn to `0.0.0.0` and `${PORT:-8000}`
- Updated the Docker image to run as the existing non-root user and start through the Render script.
- Added a dedicated migration command: `python -m app.persistence.migrate`.
- Normalized Render `postgres://` and `postgresql://` URLs to SQLAlchemy's installed psycopg v3 driver for both runtime and Alembic.
- Separated schema migration from database connectivity verification.
- Added `ASTRAFORGE_DATABASE_MIGRATE_ON_STARTUP`:
  - defaults to `true` in development/test
  - defaults to `false` in staging/production unless explicitly set
- Updated `.env.example` for database, migration mode, local frontend ports and public Binance base URL.
- Updated README with Render Blueprint and local migration instructions.

## Verification Performed

- Full Pytest suite: **251 passed**
- Coverage: **90.63%** (required minimum 90%)
- Python compile check: passed
- FastAPI import smoke check: passed
- `render.yaml` YAML parse and required field checks: passed
- Package wheel build with `--no-build-isolation --no-deps`: passed
- Local Uvicorn health check using Render start script: HTTP 200
- Migration + start-script integration smoke test: passed; 10 tables created

## Verification Not Available in This Environment

- Docker image build was not executed because Docker is not installed in the working environment.
- Ruff and Mypy were not executed because those binaries were unavailable and the package index did not provide them. The existing GitHub Actions workflow remains configured to enforce both.
- No live Render deployment was performed.
- No live Render Postgres connection was tested.

## Safety State

- Real/demo execution remains disabled in the Blueprint.
- Scanner auto-start remains disabled on the Render API web service.
- The generated backend mutation token must never be copied into a browser `VITE_*` variable.
- Binance Demo credentials are not included in the Blueprint.
