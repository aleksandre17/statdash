"""Manage nuke — scoped image removal, no global docker image prune."""
from __future__ import annotations

from pathlib import Path

PKG = Path(__file__).resolve().parents[1]
MANAGE_SH = PKG / "drivers" / "java-boot" / "sh" / "manage.sh"
MANAGE_REMOTE = PKG / "toolkit" / "bash" / "manage-remote.sh"


def test_manage_sh_no_global_image_prune() -> None:
    text = MANAGE_SH.read_text(encoding="utf-8")
    assert 'docker image prune -f' not in text
    assert "manage_prune_deployed_images" in text


def test_manage_remote_prune_helper() -> None:
    text = MANAGE_REMOTE.read_text(encoding="utf-8")
    assert "manage_prune_deployed_images" in text
    assert "docker images -q" in text
    assert 'docker image prune -f' not in text


def test_manifest_schema_validates_consumer() -> None:
    import json
    import subprocess
    import sys

    root = Path(__file__).resolve().parents[2].parent
    r = subprocess.run(
        [sys.executable, str(PKG / "lib" / "validate_manifest.py")],
        cwd=root,
        env={**dict(__import__("os").environ), "GEOSTAT_PROJECT_ROOT": str(root)},
        capture_output=True,
        text=True,
    )
    assert r.returncode == 0, r.stderr or r.stdout
    assert "OK" in r.stdout
    schema = json.loads((PKG / "manifest.schema.json").read_text(encoding="utf-8"))
    assert "stack-deploy" in schema["properties"]["stack"]["properties"]["composeModules"]["description"]
