# AstraForge Render Deployment Guide

## 1. Push the project to GitHub

Commit the contents of this folder so `render.yaml`, `frontend/`, and `backend/` are at the repository root.

## 2. Create a Render Blueprint

In Render, choose **New → Blueprint**, connect the repository, and select the repository root `render.yaml`.

The Blueprint creates:

- `astraforge-backend` — Docker web service
- `astraforge-frontend` — static site
- `astraforge-postgres` — PostgreSQL database

## 3. Set the two required cross-service variables

The first Blueprint creation pauses for values marked `sync: false`.

### Backend

Set `ASTRAFORGE_CORS_ORIGINS` to a JSON array containing the final frontend URL:

```text
["https://astraforge-frontend.onrender.com"]
```

Use the exact URL Render assigns if the service name is changed.

### Frontend

Set `VITE_API_BASE_URL` to the final backend origin, without a trailing slash:

```text
https://astraforge-backend.onrender.com
```

Because Vite variables are build-time values, redeploy the frontend after changing this variable.

## 4. Verify

Backend liveness:

```text
https://<backend-host>/api/v1/health/live
```

Backend readiness:

```text
https://<backend-host>/api/v1/health/ready
```

Frontend status should show the backend and market-data state truthfully.

## 5. Scanner operator access

Render generates `ASTRAFORGE_MUTATION_API_TOKEN` for the backend. Copy it from the backend service environment only when scanner controls are needed, then enter it in the frontend Settings page. The token is held in browser memory only and is cleared on refresh. Never place it in a `VITE_*` variable.

## 6. Execution remains locked

Keep these values until Demo credentials and the later backend safety phases are complete:

```text
ASTRAFORGE_EXECUTION_ENABLED=false
ASTRAFORGE_SCANNER_AUTO_START=false
```

## 7. Production database note

Review the current Render PostgreSQL plan and retention limits before storing long-term trading history. Upgrade or use an approved external PostgreSQL service when needed.
