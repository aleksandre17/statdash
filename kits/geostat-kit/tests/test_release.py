"""Release metadata — version pin for consumers."""
from __future__ import annotations

import re
from pathlib import Path

PKG = Path(__file__).resolve().parents[1]


def test_version_file_semver() -> None:
    ver = (PKG / "VERSION").read_text(encoding="utf-8").strip()
    assert re.match(r"^\d+\.\d+\.\d+$", ver)
    assert ver == "1.0.0"


def test_changelog_mentions_version() -> None:
    ver = (PKG / "VERSION").read_text(encoding="utf-8").strip()
    changelog = (PKG / "CHANGELOG.md").read_text(encoding="utf-8")
    assert ver in changelog
