# AstraForge Audit and Deployment Status

## Frontend corrections applied

- Removed hardcoded BTC/ETH and fabricated market/PnL display fallbacks.
- Added truthful disconnected, degraded, stale, and unavailable states.
- Centralized API access and standardized `VITE_API_BASE_URL`.
- Added request timeout/abort support and polling overlap prevention.
- Throttled repeated offline warning logs.
- Validated and sanitized local browser storage.
- Added CSV escaping and tests.
- Kept the operator mutation token in browser memory only; no token is compiled into the bundle.
- Unified scanner start/stop/run-now calls and preserved backend authorization/idempotency.
- Verified the backend actually exposes scanner start, stop, and run-now routes.
- Removed frontend-derived scanner SL/TP/R:R calculations because those values are not in the backend contract.
- Added route-level lazy loading and Render security headers/CSP.
- Updated branding and documentation.
- Added truthful last-known labeling for local plan prices when market data is unavailable.

## Backend/Render foundation

- FastAPI Docker service uses Render-provided `$PORT`.
- PostgreSQL is connected through the Render Blueprint.
- Alembic migrations run before process start.
- Production CORS is explicit and wildcard-free.
- Mutation authentication is required.
- Execution and scanner auto-start remain disabled by default.
- Root `render.yaml` deploys frontend, backend, and PostgreSQL from one monorepo.

## Verification performed

- Backend pytest: **251 passed**.
- Backend Python compilation: **passed**.
- FastAPI import and required route check: **passed**.
- Backend contract smoke requests: health, system, scanner, and execution status behaved as expected.
- Root and standalone Render YAML parsing: **passed**.
- Frontend TS/TSX syntax transpilation: **passed**.
- Frontend local import resolution: **passed**.
- Frontend static security/integrity checks: **passed**.
- Package lockfile matches `package.json` and uses public `registry.npmjs.org` URLs.

## Verification limitation

A full frontend `npm ci`, TypeScript semantic check, Vitest run, and Vite production build could not be completed in this execution environment because its internal npm mirror returned 404 responses and direct public-registry DNS requests timed out. The repository CI and Render build commands are included so these checks run in a normal GitHub/Render environment. No successful frontend build is claimed here.

## Live deployment status

The project is deployment-ready as a repository artifact, but it has not been deployed to the user's Render account from this environment because no Render account/repository connection is available. Follow `RENDER_DEPLOY_GUIDE.md` after pushing the ZIP contents to GitHub.
