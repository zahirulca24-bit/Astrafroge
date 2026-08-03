# AstraForge Crypto Backend

Production-oriented FastAPI backend for the **AstraForge Binance Intraday Trading Bot**.

Frontend repository: `zahirulca24-bit/AstraForge-Crypto-Frontend`

## Current Status — 2026-07-17

- Default branch: `main`
- Live or real-money execution: **DISABLED**
- Private trading boundary: **Binance USD-M Futures Demo only**
- Production readiness: **BLOCKED**
- Scanner, Signal, Risk, Security Gate and Demo Execution foundations are merged
- Persistence, reconciliation, exchange-authoritative Journal and final runtime verification remain incomplete

Existing Demo Execution, Trade Management and Journal code must not be treated as production-ready until the checklist below is completed and verified.

## Backend Audit Checklist — 2026-07-17

Checklist policy:

- Complete one item at a time.
- Change `[ ]` to `[x]` only after the code is merged into `main` and verification passes.
- After every completed item, update this README with the PR number, commit SHA and verification evidence.
- Do not mark an item complete from implementation claims alone.
- Real trading must remain disabled throughout this checklist.

### P0 — Durability and Exchange Truth

- [ ] **BE-01:** Add durable persistence for Signals, Risk decisions, orders, fills, positions and trades.
- [ ] **BE-02:** Persist idempotency and replay protection across restart and multi-instance deployment.
- [ ] **BE-03:** Reconcile Binance Demo orders continuously.
- [ ] **BE-04:** Reconcile Binance Demo positions continuously.
- [ ] **BE-05:** Detect partial fills, external closes, missing protective orders and exchange/runtime mismatches.
- [ ] **BE-06:** Recover open orders and positions after restart or deployment.
- [ ] **BE-07:** Fail closed whenever reconciliation cannot prove a safe exchange state.
- [ ] **BE-08:** Build Journal records only from verified exchange fills, orders and income records.
- [ ] **BE-09:** Calculate realized PnL using verified fills.
- [ ] **BE-10:** Include actual commissions and funding in closed-trade performance.

### P1 — Trade Management and Integration

- [ ] **BE-11:** Verify Active Trades from exchange-authoritative positions rather than process-only state.
- [ ] **BE-12:** Make manual close operations durable and idempotent.
- [ ] **BE-13:** Verify partial close, Stop Loss and Take Profit lifecycle events.
- [ ] **BE-14:** Record exchange order ID, client order ID, requested quantity, executed quantity, average fill price and final status.
- [ ] **BE-15:** Add strategy, symbol, daily, weekly and monthly performance reporting from verified closed trades.
- [ ] **BE-16:** Add notifications for orders, fills, TP/SL, Risk blocks, connection failures and reconciliation mismatches.
- [ ] **BE-17:** Confirm Scanner auto-start behavior is intentional, configurable and safe after deployment restart.
- [ ] **BE-18:** Verify Scanner latest-run summary and degraded-run diagnostics against the frontend contract.
- [ ] **BE-19:** Publish stable typed contracts required by Frontend Signals, Risk, Demo Account, Execution, Active Trades and Journal pages.

### P2 — CI, Documentation and Release

- [ ] **BE-20:** Run and pass Ruff on latest `main`.
- [ ] **BE-21:** Run and pass strict Mypy on latest `main`.
- [ ] **BE-22:** Run and pass the full Pytest suite with the required coverage threshold.
- [ ] **BE-23:** Run and pass FastAPI import smoke verification.
- [ ] **BE-24:** Run and pass Docker build verification.
- [ ] **BE-25:** Confirm the latest direct `main` commits have successful GitHub Actions evidence.
- [ ] **BE-26:** Keep README progress, merged PR status and current task synchronized with repository reality.
- [ ] **BE-27:** Verify deployed health, market, Scanner, Signal, Risk and Demo read-only endpoints.
- [ ] **BE-28:** Verify protected mutation authentication and idempotency against the deployed Demo runtime.
- [ ] **BE-29:** Complete frontend-connected runtime testing without enabling real trading.
- [ ] **BE-30:** Run a final backend security and production-readiness audit.

## Completion Log

Add one row only after an item is verified.

| Item | Status | PR | Commit | Verification |
|---|---|---|---|---|
| — | No checklist item verified yet | — | — | — |

## Implemented Foundations

- FastAPI foundation
- Public market data engine
- Universe and indicator engines
- Deterministic Scanner with bounded history and max-50 final selection
- Stable Signal lifecycle engine
- Account-backed Risk Engine
- Protected mutation endpoints with bearer authorization and idempotency keys
- Binance Demo execution hardening foundation
- Secret-safe Demo account diagnostics
- Frontend-compatible health endpoints

## Implemented Strategy Set

The Scanner contains five deterministic LONG and SHORT setup evaluators:

1. Trend Pullback
2. Breakout Retest
3. EMA Rejection
4. Liquidity Sweep Reversal
5. Continuation Setup

Timeframe model:

- `1H` — trend and regime
- `15M` — setup confirmation
- `5M` — entry readiness

Grade model:

- A+ = `90–100`
- A = `85–89`
- B+ = `80–84`, Watch/Near only
- Reject = below `80`

Canonical Scanner governance source: [`docs/SCANNER_RULES_APPROVAL.md`](docs/SCANNER_RULES_APPROVAL.md)

## Security Gate Contract

Protected mutation endpoints require:

```http
Authorization: Bearer <ASTRAFORGE_MUTATION_API_TOKEN>
Idempotency-Key: <unique 16-128 character value>
```

Current process-scoped replay protection is not sufficient for production durability. It must be replaced or backed by persistent cross-restart and multi-instance state under **BE-02**.

## Safety Rules

- Binance USD-M Futures Demo only for private account and execution functions.
- Never send an order to a live endpoint.
- Never switch Demo to Live automatically.
- Never use live Spot, paper trading or another environment as fallback.
- Fail closed on invalid configuration, unsafe exchange state, malformed data or reconciliation mismatch.
- Never expose or commit API keys, secrets, bearer tokens, signatures, signed payloads or `.env` files.
- Never fabricate prices, indicators, Signals, balances, fills, fees, PnL or performance.
- Never invent a Risk percentage, stop formula, PnL baseline or execution result.

## Environment

```env
ASTRAFORGE_ENVIRONMENT=development
ASTRAFORGE_LOG_LEVEL=INFO
ASTRAFORGE_CORS_ORIGINS=["http://localhost:3000","http://localhost:5173"]
ASTRAFORGE_CORS_ALLOW_CREDENTIALS=false
ASTRAFORGE_DATABASE_URL=
ASTRAFORGE_DATABASE_MIGRATE_ON_STARTUP=true
ASTRAFORGE_MUTATION_AUTH_REQUIRED=true
ASTRAFORGE_MUTATION_API_TOKEN=
ASTRAFORGE_MUTATION_REPLAY_TTL_SECONDS=900
ASTRAFORGE_MUTATION_REPLAY_CACHE_LIMIT=5000
ASTRAFORGE_EXECUTION_ENABLED=false
ASTRAFORGE_BINANCE_PUBLIC_BASE_URL=https://fapi.binance.com
ASTRAFORGE_BINANCE_DEMO_BASE_URL=
ASTRAFORGE_BINANCE_DEMO_API_KEY=
ASTRAFORGE_BINANCE_DEMO_API_SECRET=
ASTRAFORGE_BINANCE_DEMO_RECV_WINDOW_MS=5000
ASTRAFORGE_RISK_PER_TRADE_PERCENT=0
ASTRAFORGE_RISK_DAILY_LOSS_LIMIT_PERCENT=3
ASTRAFORGE_RISK_DAILY_PROFIT_LOCK_PERCENT=5
ASTRAFORGE_RISK_MAX_OPEN_TRADES=4
ASTRAFORGE_RISK_MAX_MARGIN_EXPOSURE_USDT=0
ASTRAFORGE_SCANNER_AUTO_START=true
```

Execution may be enabled only with verified Demo credentials, an approved Demo endpoint, a configured mutation token and all execution/Risk safeguards in place.

## Render Foundation

The repository includes a root-level `render.yaml` for a Docker web service and a
private Render Postgres database in the Singapore region.

Render deployment behavior:

- The API binds to `0.0.0.0` and `${PORT}` through the Docker `CMD`.
- The Docker start script runs `python -m app.persistence.migrate` before Uvicorn.
- Application startup then verifies database connectivity without rerunning migrations.
- The health check path is `/api/v1/health/live`.
- Scanner auto-start and execution are disabled on the Render web service.
- The database has no public IP allowlist entries and is reached through its private connection string.

The Blueprint uses Free instances for initial deployment testing. Render Free web
services do not support pre-deploy commands, so migration is performed by the
container start script. For a paid web service, migration can later be moved to a
Render pre-deploy command and `ASTRAFORGE_RUN_MIGRATIONS_BEFORE_START` can be set
to `false`.

Render Free Postgres is temporary and expires after its current free retention
period. Upgrade the database before treating the deployment as durable production
storage.

During the initial Blueprint creation, Render prompts for
`ASTRAFORGE_CORS_ORIGINS`. Enter a JSON list containing only the approved deployed
frontend origin, for example:

```text
["https://your-frontend.onrender.com"]
```

Do not place the generated mutation token in a Vite environment variable or any
browser bundle. Demo credentials are intentionally not defined in `render.yaml` and
execution remains disabled.

Local migration and startup:

```bash
cp .env.example .env
# Set ASTRAFORGE_DATABASE_URL to an approved PostgreSQL URL.
python -m app.persistence.migrate
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## Required Verification

```bash
python -m pip install -e ".[dev]"
ruff check .
mypy app
pytest -q --cov=app --cov-report=term-missing
python -c "from app.main import app; assert app.title == 'AstraForge Crypto Backend'"
docker build -t astraforge-backend:verify .
```

Do not report a command, CI run or deployment as PASS unless it was actually executed successfully against the stated commit.

## Current Next Action

Start with **BE-01**. Complete and verify one checklist item, merge it into `main`, then update its checkbox and Completion Log before starting the next item.
