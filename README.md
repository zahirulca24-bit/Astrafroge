# AstraForge Render Monorepo

AstraForge is packaged as one repository with two deployable services:

- `frontend/`: React + TypeScript + Vite static site
- `backend/`: FastAPI API, scanner runtime, and Binance Demo integration
- `render.yaml`: Render Blueprint for frontend, backend, and PostgreSQL

## Current project status

**Date:** 04 August 2026  
**Day:** Tuesday  
**Environment:** Render production deployment  
**Mode:** Binance Demo only

### Verified working

- Frontend deployed on Render.
- FastAPI backend deployed on Render.
- Render PostgreSQL database created and connected.
- Backend health endpoint returns `200 OK`.
- Frontend-to-backend CORS connection is working.
- Binance public USD-M Futures market data is connected.
- Backend universe endpoint reports 852 total symbols and 50 tradable symbols.
- BTC/USDT chart and market indicators load in the frontend.
- Binance Demo private API is connected.
- Demo account endpoint reports `demo_private_execution_ready: true` and `can_trade: true`.
- Demo wallet balance, available margin, and open positions are displayed in the frontend.
- Protected scanner mutations require the Render operator token.
- PR #3 was merged to fix operator-token sharing across lazy-loaded frontend modules.

### Pending verification

- Wait for the merged PR #3 frontend deployment to complete on Render.
- Hard-refresh the frontend.
- Open **Settings → Backend Integration** and set the operator mutation token again for the browser session.
- Confirm **Start Scanner** sends `POST /api/v1/scanner/start`.
- Verify `/api/v1/scanner/status` changes from `OFF` to `ON`.
- Verify the first full-universe scanner run completes.
- Verify candidates and signals are generated and persisted.
- Keep demo execution disabled until scanner, signal, risk, and order-lifecycle verification passes.

## Next session starting point

1. Confirm the latest frontend Render deployment is live.
2. Set the operator token in the frontend session.
3. Click **Start Scanner** while Chrome DevTools Network is open.
4. Verify the authenticated request and response for:

```text
POST /api/v1/scanner/start
```

5. Recheck:

```text
GET /api/v1/scanner/status
GET /api/v1/scanner/candidates
GET /api/v1/signals
```

6. Review backend logs if the scanner remains `OFF` or the scan fails.

## Production URLs

```text
Frontend: https://astraforge-frontend.onrender.com
Backend:  https://astraforge-backend.onrender.com
Health:   https://astraforge-backend.onrender.com/api/v1/health/live
```

## Render environment naming

The Binance Demo variables expected by the backend are:

```text
ASTRAFORGE_BINANCE_DEMO_BASE_URL=https://demo-fapi.binance.com
ASTRAFORGE_BINANCE_DEMO_API_KEY=<secret>
ASTRAFORGE_BINANCE_DEMO_API_SECRET=<secret>
```

Protected scanner actions use:

```text
ASTRAFORGE_MUTATION_AUTH_REQUIRED=true
ASTRAFORGE_MUTATION_API_TOKEN=<secret>
```

Never place private API keys, secrets, or the mutation token in frontend `VITE_*` variables.

## Safety defaults

- Demo execution is disabled by default.
- Scanner auto-start is disabled on the API web service.
- Mutation authentication is required.
- The operator token is entered at runtime and remains memory-only in the browser.
- Exchange credentials remain backend-only.
- The frontend displays unavailable states instead of fabricated market, scanner, account, or PnL data.

## Local start on Windows

Double-click `START_APP.bat`. The script starts:

- Backend: `http://localhost:8000`
- Frontend: `http://localhost:5173`

The backend can run locally without persistence, but database-backed features require `ASTRAFORGE_DATABASE_URL` in `backend/.env`.

## Render deployment

Read `RENDER_DEPLOY_GUIDE.md`. The repository root contains the Render Blueprint configuration.

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
