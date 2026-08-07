# AstraForge Render Monorepo

AstraForge is packaged as one repository with two deployable services:

- `frontend/`: React + TypeScript + Vite static site
- `backend/`: FastAPI API, scanner runtime, signal engine, risk/execution services, and Binance Demo integration
- `render.yaml`: Render Blueprint for frontend, backend, and PostgreSQL

## Current project status

**Date:** 08 August 2026  
**Environment:** Render production deployment  
**Mode:** Binance Demo only

### Verified working

- Frontend and FastAPI backend are deployed on Render.
- Render PostgreSQL is connected.
- Binance public USD-M Futures market data is available again after the market-data recovery work.
- BTC/USDT candles and market indicators load in the frontend.
- Universe selection returns 50 tradable symbols for scanner evaluation.
- Scanner runtime is running and returning deterministic audit/rejection reasons.
- Signal Engine backend exists and is sourced from Scanner candidates.
- Operator-token authentication has been removed by explicit owner-approved configuration.
- Scanner & Signals **Phase 1 — Data Contract Alignment** merged in PR #21; CI Run #66 passed.

### Current validation focus

**Phase 2 — Scanner Table Rebuild is active.** Scanner and Signal work must be completed backend + frontend together in every phase. No phase is considered complete with only one side implemented.

## Locked Scanner & Signals layout

Desktop layout is a 50/50 split:

- **Left 50% — Scanner Table**
  - latest selected/evaluated universe rows
  - Ready / Near Setup / Rejected / Failed state
  - 1H trend, 15M setup, 5M entry
  - strategy/setup, score, confidence, R:R
  - rejection/audit reason
  - chart action
- **Right 50% — Signal Cards**
  - backend Signal Engine records only
  - A+ / A actionable signals
  - B+ Watch
  - entry, stop, targets, R:R, rationale
  - candidate ID + signal ID
  - no fabricated signal cards

Mobile/tablet may stack responsively, but desktop remains 50/50.

## Locked implementation roadmap

### ✅ Phase 1 — Data Contract Alignment — COMPLETE

- Latest full scan exposes authoritative run identity and per-symbol audit truth.
- Universe rank is preserved for rejected/failed rows.
- Candidate identity and signal identity remain separate but linked.
- Frontend scanner mapping is tied to the latest full-run contract.
- Real backend Signal Engine client exists for the next signal-card phase.
- Backend + frontend regression coverage added.

### 🚧 Phase 2 — Scanner Table Rebuild — IN PROGRESS

- Backend exposes authoritative latest full-scan table rows.
- Build the reusable left 50% Scanner table panel.
- Render all evaluated rows, including Ready, Near Setup, Rejected and Failed.
- Add symbol/side/status/strategy filters and rank/score/confidence/status sorting.
- Show rejection/failure reason and chart action.
- Counts come directly from the backend table contract; frontend must not invent rejected totals.
- Keep scanner formulas, strategy thresholds, risk rules and execution rules unchanged.

### Phase 3 — Signal Card Integration

- Build the right 50% Signal card panel.
- Source cards only from `/api/v1/signals` and Signal Engine status.
- Render A+, A, and B+ Watch states with backend-provided identity and lifecycle.
- Do not promote rejected scanner rows into signal cards.

### Phase 4 — Cross-Link Scanner ↔ Signal

- Scanner row click highlights its related Signal card when one exists.
- Signal card click highlights its scanner row.
- Candidate ID ↔ Signal ID linkage remains deterministic.

### Phase 5 — UI Consolidation

- Replace standalone Scanner and Signals navigation with **Scanner & Signals**.
- Desktop 50/50 split; responsive stacked mobile layout.
- Remove duplicate standalone-page behavior after the merged page is verified.

### Phase 6 — QA & Validation

- Verify 50 scanner rows for a 50-symbol selected universe.
- Verify Ready / Near / Rejected / Failed counts.
- Verify qualified scanner candidate → Signal Engine record → Signal card.
- Verify no fake/local-derived signals.
- Verify refresh/auto-scan and backend-unavailable states.
- Run backend + frontend regression tests before merge.

## Locked navigation target

```text
Dashboard
→ Scanner & Signals
→ Chart & Watchlist
→ Trades & Journal
→ Backtest
→ Settings
```

`Trades & Journal` will default to today's active and closed trades; older closed trades remain available in Journal history. Every closed trade must retain a close reason, and SL-hit trades must preserve evidence-backed post-trade reason when available rather than inventing one.

`Backtest` is a separate page immediately before Settings.

## Phase boundary

Scanner & Signals implementation must not silently change:

- scanner formulas
- strategy thresholds
- risk rules
- execution rules

Any later change to those engines requires a separate reviewed task.

## Production URLs

```text
Frontend: https://astraforge-frontend.onrender.com
Backend:  https://astraforge-backend.onrender.com
Health:   https://astraforge-backend.onrender.com/api/v1/health/live
```

## Safety defaults

- Demo execution remains disabled until the end-to-end scanner → signal → risk → execution workflow is verified.
- Exchange credentials remain backend-only.
- The frontend must display unavailable/empty states instead of fabricated market, scanner, signal, trade, or PnL data.

## Local start on Windows

Double-click `START_APP.bat`.

- Backend: `http://localhost:8000`
- Frontend: `http://localhost:5173`

Database-backed features require `ASTRAFORGE_DATABASE_URL` in `backend/.env`.

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
