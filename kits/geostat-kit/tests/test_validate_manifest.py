"""Manifest validation CLI logic."""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from lib.validate_manifest import validate_manifest

FIXTURE_ROOT = Path(__file__).resolve().parent / "fixtures" / "golden-consumer"


def _golden_tree(tmp_path: Path) -> Path:
    import os

    manifest = json.loads((FIXTURE_ROOT / "geostat.ops.json").read_text(encoding="utf-8"))
    pkg = Path(__file__).resolve().parents[1]
    manifest["package"] = os.path.relpath(pkg, tmp_path).replace("\\", "/")
    (tmp_path / "geostat.ops.json").write_text(json.dumps(manifest), encoding="utf-8")
    for mid, cfg in manifest["modules"].items():
        parts = cfg["path"].split("/")
        (tmp_path.joinpath(*parts)).mkdir(parents=True, exist_ok=True)
    (tmp_path / "ops" / "config").mkdir(parents=True, exist_ok=True)
    (tmp_path / "ops" / "compose").mkdir(parents=True, exist_ok=True)
    (tmp_path / "ops" / "compose" / "catalog.json").write_text("{}", encoding="utf-8")
    (tmp_path / "ops" / "ci").mkdir(parents=True, exist_ok=True)
    (tmp_path / "ops" / "ci" / "integration-stack.sh").write_text("# stub\n", encoding="utf-8")
    return tmp_path


def test_validate_golden_consumer_passes(tmp_path: Path) -> None:
    root = _golden_tree(tmp_path)
    errs, warnings = validate_manifest(root)
    assert not errs, errs
    assert isinstance(warnings, list)


def test_validate_fails_missing_role(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("GEOSTAT_PROJECT_ROOT", raising=False)
    root = _golden_tree(tmp_path)
    mf = root / "geostat.ops.json"
    data = json.loads(mf.read_text(encoding="utf-8"))
    del data["modules"]["api"]["role"]
    mf.write_text(json.dumps(data), encoding="utf-8")
    errs, _ = validate_manifest(root)
    assert any("role" in e for e in errs), errs


def test_validate_cli_main(repo_root: Path) -> None:
    errs, warnings = validate_manifest(repo_root)
    assert not errs, errs
