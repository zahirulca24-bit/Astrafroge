# AstraForge Frontend

React, TypeScript, and Vite frontend for the AstraForge FastAPI backend. It displays validated backend market/scanner status and preserves truthful unavailable states when data is absent. Local demo plans are explicitly labeled as not submitted or executed.

## Local installation

```bash
npm ci
```

Copy `.env.example` to `.env.local` and set:

| Variable | Description |
|---|---|
| `VITE_API_BASE_URL` | AstraForge backend origin, without a trailing slash |
| `VITE_SUPABASE_URL` | Optional Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Optional Supabase anonymous key |

Never place private tokens, API secrets, or exchange credentials in `VITE_*` variables. Vite embeds them in the public browser bundle. Scanner mutation authorization is entered at runtime in Settings and retained in browser memory only.

## Commands

```bash
npm run dev
npm run lint
npm test
npm run build
```

## Backend requirements

The frontend expects the existing AstraForge `/api/v1` contracts for health, system status, market data, indicators, universe, scanner, and Demo execution status. Scanner start, stop, and run-now operations require the backend operator token and idempotency headers.

The frontend does not reproduce scanner, risk, signal, or execution business rules. Values absent from the backend contract are shown as unavailable.

## Render static-site settings

- Build command: `npm ci && npm run build`
- Publish directory: `dist`
- SPA rewrite: `/*` to `/index.html`
- Required build variable: `VITE_API_BASE_URL`

For the combined frontend/backend deployment, use the repository-root `render.yaml`.
