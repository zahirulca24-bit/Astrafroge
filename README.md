# AstraForge Render Monorepo

AstraForge is packaged as one repository with two deployable services:

- `frontend/`: React + TypeScript + Vite static site
- `backend/`: FastAPI API and scanner runtime
- `render.yaml`: Render Blueprint for both services and PostgreSQL

## Safety defaults

- Demo execution is disabled.
- Scanner auto-start is disabled on the API web service.
- Mutation authentication is required.
- The operator token is generated on Render and is never compiled into the frontend.
- The frontend displays unavailable states instead of fabricated market, scanner, account, or PnL data.

## Local start on Windows

Double-click `START_APP.bat`. The script starts:

- Backend: `http://localhost:8000`
- Frontend: `http://localhost:5173`

The backend can run locally without persistence, but database-backed features require `ASTRAFORGE_DATABASE_URL` in `backend/.env`.

## Render deployment

Read `RENDER_DEPLOY_GUIDE.md`. The first deployment requires this directory to be committed to a Git repository that Render can access.

## Verification commands

Frontend:

```bash
cd frontend
npm ci
npm run lint
npm test
npm run build
```

Backend:

```bash
cd backend
python -m pip install -e ".[dev]"
ruff check app tests
mypy app
pytest
```
