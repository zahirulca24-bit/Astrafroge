"""Static regression checks for the Render deployment foundation."""

from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def test_render_blueprint_is_free_tier_compatible() -> None:
    blueprint = (ROOT / "render.yaml").read_text(encoding="utf-8")

    assert "runtime: docker" in blueprint
    assert "plan: free" in blueprint
    assert "healthCheckPath: /api/v1/health/live" in blueprint
    assert "preDeployCommand:" not in blueprint
    assert "ASTRAFORGE_RUN_MIGRATIONS_BEFORE_START" in blueprint
    assert "ASTRAFORGE_SCANNER_AUTO_START" in blueprint
    assert 'value: "false"' in blueprint


def test_render_start_script_migrates_then_binds_to_render_port() -> None:
    script = (ROOT / "scripts" / "start-render.sh").read_text(encoding="utf-8")

    assert "python -m app.persistence.migrate" in script
    assert '"${PORT:-8000}"' in script
    assert "exec uvicorn app.main:app --host 0.0.0.0" in script


def test_dockerfile_runs_non_root_render_start_script() -> None:
    dockerfile = (ROOT / "Dockerfile").read_text(encoding="utf-8")

    assert "USER astrforge" in dockerfile
    assert 'CMD ["./scripts/start-render.sh"]' in dockerfile
