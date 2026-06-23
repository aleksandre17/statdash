"""pytest fixtures for geostat-kit package tests.

The suite validates the kit's *machinery* (manifest resolution, driver
registry, compose/config generation, deploy-path logic) against a **synthetic,
self-contained reference consumer** under ``tests/fixtures/golden-consumer``.

Why a synthetic fixture and not the live consumer manifest:
  * The kit is a reusable package. Coupling its tests to whatever
    ``geostat.ops.json`` happens to sit at the real project root makes the
    suite break every time the consumer's module set changes (this is exactly
    what produced the long-standing red baseline — the tests asserted a stale
    reference project: frontend / chat-api / retrieval / ingestion).
  * Pointing every manifest-driven test at a fixture the kit *owns* means the
    suite exercises the kit's logic deterministically, independent of any
    consumer. This is the standard "golden fixture" pattern for a library.

The fixture deliberately models a *representative* multi-module consumer
(java-boot api + java-boot worker + node-vite ui) so that every code path stays
covered: env-profiles config-gen, simple config-gen, postgres datastores,
credentials, stack-deploy ordering, vscode-gen, layout-v2, migrate-layout.

Override ``GEOSTAT_PROJECT_ROOT`` to point the suite at a real consumer when
you want to smoke-test an adoption (documented in tests/README.md).
"""
from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

import pytest

PKG = Path(__file__).resolve().parents[1]
FIXTURE_ROOT = Path(__file__).resolve().parent / "fixtures" / "geostat-chat-ai"

# Never collect inside the synthetic consumer fixture. It contains a junction
# (kits/geostat-kit -> the real kit) that would otherwise make pytest recurse
# infinitely back into this tree. The fixture holds data, not tests.
collect_ignore = ["fixtures"]


def pytest_ignore_collect(collection_path, config):  # noqa: ARG001
    return "fixtures" in Path(str(collection_path)).parts

# Allow an explicit override (manual adoption smoke-test); otherwise the
# self-contained synthetic consumer fixture is the project root for the suite.
REPO = Path(os.environ["GEOSTAT_PROJECT_ROOT"]).resolve() if os.environ.get(
    "GEOSTAT_PROJECT_ROOT"
) else FIXTURE_ROOT


def _link_kit_into_fixture(fixture_root: Path, kit_root: Path) -> None:
    """Materialise ``<fixture>/kits/geostat-kit`` -> the real kit.

    The fixture manifest declares ``"package": "kits/geostat-kit"`` so that the
    package-boundary tests (``package == "kits/geostat-kit"`` *and* it resolves
    to this kit) both hold. The link target is gitignored (junction/symlink),
    so we recreate it at session start — keeps the fixture self-healing without
    committing a platform-specific link.
    """
    link = fixture_root / "kits" / "geostat-kit"
    link.parent.mkdir(parents=True, exist_ok=True)
    if link.exists():
        # Already linked (or a stale real dir) — trust it if it resolves.
        try:
            if (link / "drivers" / "registry.json").is_file():
                return
        except OSError:
            pass
    if sys.platform.startswith("win"):
        # Directory junction — no admin privilege required (unlike symlink).
        subprocess.run(
            ["cmd", "/c", "mklink", "/J", str(link), str(kit_root)],
            check=True,
            capture_output=True,
            text=True,
        )
    else:
        os.symlink(kit_root, link, target_is_directory=True)


def _write_volatile_secrets(fixture_root: Path) -> None:
    """Create the gitignored ``deploy.env`` the suite reads.

    ``**/deploy.env`` is gitignored by the kit (never commit real secrets), so
    the fixture's copy can't be committed. Its identity values are fixed and
    drive compose-service naming + migrate-rename assertions, so we write a
    deterministic copy at session start from the committed ``.example``-shaped
    template, with the canonical service names the tests expect.
    """
    secrets = fixture_root / "ops" / "config"
    secrets.mkdir(parents=True, exist_ok=True)
    template = secrets / "deploy.env.fixture"
    target = secrets / "deploy.env"
    if template.is_file():
        target.write_text(template.read_text(encoding="utf-8"), encoding="utf-8")


@pytest.fixture(scope="session", autouse=True)
def _fixture_project(request: pytest.FixtureRequest) -> None:
    """Prepare the synthetic consumer + wire driver_api env for the session."""
    if REPO == FIXTURE_ROOT:
        _link_kit_into_fixture(FIXTURE_ROOT, PKG)
        _write_volatile_secrets(FIXTURE_ROOT)
    os.environ.setdefault("GEOSTAT_PROJECT_ROOT", str(REPO))
    os.environ["GEOSTAT_KIT_ROOT"] = str(PKG)


def repo_module(repo_root: Path, manifest: dict, module_id: str) -> Path:
    parts = manifest["modules"][module_id]["path"].split("/")
    return repo_root.joinpath(*parts)


def repo_secrets(repo_root: Path, manifest: dict) -> Path:
    parts = manifest.get("secrets", "ops/config").split("/")
    return repo_root.joinpath(*parts)


@pytest.fixture
def compose_service_names(manifest: dict) -> dict[str, str]:
    """Abstract service names from manifest slug defaults (not project brands)."""
    slug = "test-app"
    return {
        "api": f"{slug}-api",
        "app": f"{slug}-app",
        "worker": f"{slug}-worker",
    }


@pytest.fixture
def pkg_root() -> Path:
    return PKG


@pytest.fixture
def repo_root() -> Path:
    return REPO


@pytest.fixture
def manifest(repo_root: Path) -> dict:
    import json

    path = repo_root / "geostat.ops.json"
    with path.open(encoding="utf-8") as f:
        return json.load(f)


@pytest.fixture
def registry(pkg_root: Path) -> dict:
    import json

    path = pkg_root / "drivers" / "registry.json"
    with path.open(encoding="utf-8") as f:
        return json.load(f)


@pytest.fixture
def secrets_root(repo_root: Path, manifest: dict) -> Path:
    return repo_secrets(repo_root, manifest)


@pytest.fixture
def frontend_dir(repo_root: Path, manifest: dict) -> Path:
    return repo_module(repo_root, manifest, "frontend")


@pytest.fixture
def backend_dir(repo_root: Path, manifest: dict) -> Path:
    return repo_module(repo_root, manifest, "chat-api")


@pytest.fixture
def catalog_path(repo_root: Path, manifest: dict) -> Path:
    rel = manifest.get("compose", {}).get("catalog", "ops/compose/catalog.json")
    return repo_root.joinpath(*rel.split("/"))
