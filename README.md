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
- Scanner & Signals **Phase 2 — Scanner Table Rebuild** merged in PR #22; final CI Run #71 passed.
- Scanner & Signals **Phase 3 — Signal Card Integration** merged in PR #23; CI Run #73 passed.
- Scanner & Signals **Phase 4 — Cross-Link Scanner ↔ Signal** merged in PR #24; CI Run #75 passed.

### Current validation focus

**Phase 5 — UI Consolidation is active.** Scanner and Signal work must remain backend-authoritative and the merged page must preserve the existing Phase 2–4 contracts without introducing local/fabricated signal truth.

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

Mobile/tablet stack responsively; desktop remains side-by-side 50/50.

## Locked implementation roadmap

### ✅ Phase 1 — Data Contract Alignment — COMPLETE

- Latest full scan exposes authoritative run identity and per-symbol audit truth.
- Universe rank is preserved for rejected/failed rows.
- Candidate identity and signal identity remain separate but linked.
- Frontend scanner mapping is tied to the latest full-run contract.
- Real backend Signal Engine client exists.
- Backend + frontend regression coverage added.

### ✅ Phase 2 — Scanner Table Rebuild — COMPLETE

- Backend exposes authoritative latest full-scan table rows through `/api/v1/scanner/evaluations/latest`.
- Reusable Scanner table panel consumes backend authoritative counts and statuses.
- Ready, Near Setup, Rejected and Failed rows remain visible.
- Symbol/side/status/strategy filters and sorting are implemented.
- Rejection/failure reason and chart action are exposed.
- Scanner formulas, strategy thresholds, risk rules and execution rules were not changed.

### ✅ Phase 3 — Signal Card Integration — COMPLETE

- Backend provides card-eligible Signal Engine records only through `/api/v1/signals/cards`: A+/A ACTIVE and B+ WATCH.
- Reusable right-side Signal card panel consumes backend Signal Engine status and cards.
- Grade, lifecycle, strategy, entry, backend stop when available, score, confidence, rationale, candidate ID and signal ID are rendered.
- TP/R:R remain unavailable until authoritative backend values exist; frontend does not invent them.
- Rejected/invalidated/expired/risk-blocked records do not become normal signal cards.

### ✅ Phase 4 — Cross-Link Scanner ↔ Signal — COMPLETE

- Backend exposes deterministic card linkage through `/api/v1/signals/links`.
- Scanner row selection targets only a real linked Signal record.
- Signal card selection targets the exact scanner candidate by candidate ID.
- Shared selection state highlights the same candidate across both panels.
- No fake candidate/signal relation is created.

### 🚧 Phase 5 — UI Consolidation — IN PROGRESS

- Replace the standalone Scanner/Signals content flow with one **Scanner & Signals** page.
- Render `ScannerTablePanel` and `SignalCardsPanel` side by side on desktop.
- Preserve responsive stacked layout on smaller screens.
- Keep legacy internal Scanner/Signals routing compatible while exposing one user-facing Scanner & Signals navigation entry.
- Reuse the backend Scanner table, Signal cards and Signal links contracts without modifying strategy/risk/execution behavior.
- Add frontend layout/navigation regression coverage and backend route-contract regression coverage.

### Phase 6 — QA & Validation

- Verify 50 scanner rows for a 50-symbol selected universe.
- Verify Ready / Near / Rejected / Failed counts.
- Verify qualified scanner candidate → Signal Engine record → Signal card.
- Verify row/card cross-highlighting.
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
