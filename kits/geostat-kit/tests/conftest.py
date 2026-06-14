"""pytest fixtures for geostat-kit package tests."""
from __future__ import annotations

import json
from pathlib import Path

import pytest

PKG = Path(__file__).resolve().parents[1]
REPO = PKG.parents[1]


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
    path = repo_root / "geostat.ops.json"
    with path.open(encoding="utf-8") as f:
        return json.load(f)


@pytest.fixture
def registry(pkg_root: Path) -> dict:
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
