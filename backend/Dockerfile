FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

RUN addgroup --system astrforge && adduser --system --ingroup astrforge astrforge

COPY pyproject.toml README.md ./
COPY app ./app
COPY alembic.ini ./
COPY migrations ./migrations
COPY scripts ./scripts

RUN chmod +x ./scripts/start-render.sh \
    && python -m pip install --upgrade pip \
    && python -m pip install .

USER astrforge
EXPOSE 8000

CMD ["./scripts/start-render.sh"]
