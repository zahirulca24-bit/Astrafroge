#!/bin/sh
set -eu

if [ "${ASTRAFORGE_RUN_MIGRATIONS_BEFORE_START:-false}" = "true" ]; then
  python -m app.persistence.migrate
fi

exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
