"""Render pre-deploy database migration entrypoint."""

from __future__ import annotations

from app.core.config import Settings
from app.persistence.database import Persistence, PersistenceConfigurationError


def main() -> None:
    """Upgrade the configured production database and verify connectivity."""

    settings = Settings()
    persistence = Persistence.from_settings(settings)
    if persistence is None:
        raise PersistenceConfigurationError(
            "ASTRAFORGE_DATABASE_URL or DATABASE_URL is required for migrations"
        )
    try:
        persistence.upgrade_schema()
        persistence.verify_connection()
    finally:
        persistence.close()


if __name__ == "__main__":
    main()
