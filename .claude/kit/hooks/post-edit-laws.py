#!/usr/bin/env python3
"""PostToolUse (Write|Edit|MultiEdit) — generic law check on the changed file. Patterns come from
project.json (law_patterns); the kit has no hardcoded antipatterns. exit 2 = corrective feedback.

OWNERSHIP (dependency arrow, P4): eslint `no-restricted-imports` (`platform/eslint.config.js`) is
the single source of truth for the dependency arrow and all import-shaped boundaries (contracts
purity, xlsx ACL, panel reach-in). `post-edit-laws.py` owns only what the import graph cannot
express — content/purity invariants (privileged-dims, declarative-DataSpec, locale-agnostic string
literals) — plus an explicitly non-authoritative fast pre-lint tripwire on the two highest-blast
arrow edges. New arrow edges are added to eslint, never mirrored into the manifest.

MEMORY HYGIENE (memory_guard): on Write/Edit to `.claude/agent-memory/**/*.md`, a write-time size
ceiling enforces "memory is a distillate, not a log" — WARN above file_warn_kb, BLOCK (exit 2) above
file_block_kb (the 131KB append-log class is exactly what the block stops), and a WARN-only line
ceiling on MEMORY.md indexes (index_max_lines; never blocked — an index edit must not be lost).
Skips silently for any path outside agent-memory. Session-boundary hygiene lives in memory-home-guard.py."""
import sys, json, re, os, fnmatch
try:
    sys.stdout.reconfigure(encoding="utf-8")
except (AttributeError, ValueError):
    pass
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _manifest import load
try:
    data = json.load(sys.stdin)
except Exception:
    sys.exit(0)
fp = (data.get("tool_input") or {}).get("file_path", "")
if not fp or not os.path.isfile(fp): sys.exit(0)
fp = fp.replace("\\", "/")  # normalize separators so path-scoped globs match on Windows
try:
    text = open(fp, encoding="utf-8", errors="ignore").read()
except OSError:
    sys.exit(0)
base = os.path.basename(fp)
root = os.environ.get("CLAUDE_PROJECT_DIR", ".")
# The manifest itself deliberately holds `sample_violation` strings — fixtures that, BY
# CONSTRUCTION, match a forbid pattern (they exist to prove each law blocks). Scanning the
# manifest with its own laws is a category error and self-trips (e.g. the secret-scan sample).
_manifest_fp = os.path.join(root, ".claude", "project.json").replace("\\", "/")
if fp == _manifest_fp or fp.endswith("/.claude/project.json"):
    sys.exit(0)
try:
    rel = os.path.relpath(fp, root).replace(os.sep, "/")
except ValueError:
    rel = base
def _match(glob): return fnmatch.fnmatch(rel, glob) or fnmatch.fnmatch(base, glob)
mf = load()  # O2: load the manifest ONCE per run, reuse below (was loaded twice)
hy = mf.get("hygiene", {}) or {}
# --- memory hygiene: agent-memory/**/*.md write-time size ceiling (distillate, not a log) -----
# Runs before the generic bloat check so the doctrine message wins for memory files. Silent
# when the path is not under agent-memory or not a .md file.
if base.endswith(".md") and "/.claude/agent-memory/" in ("/" + fp):
    mg = mf.get("memory_guard", {}) or {}
    warn_kb = float(mg.get("file_warn_kb", 6))
    block_kb = float(mg.get("file_block_kb", 12))
    try:
        size_kb = os.path.getsize(fp) / 1024.0
    except OSError:
        size_kb = 0.0
    if size_kb > block_kb:
        sys.stderr.write(
            f"[post-edit-laws] MEMORY BLOCK: {rel} is {size_kb:.1f}KB (hard ceiling {block_kb:.0f}KB). "
            f"Memory is a distillate, not a log — distill or split into topic files. "
            f"The 131KB append-log class is exactly what this blocks.\n")
        sys.exit(2)
    if base == "MEMORY.md":  # WARN-only: an index edit must never be lost
        max_lines = int(mg.get("index_max_lines", 60))
        n_idx = text.count("\n") + 1
        if n_idx > max_lines:
            sys.stderr.write(
                f"[post-edit-laws] MEMORY INDEX WARN: {rel} is {n_idx} lines (soft limit {max_lines}). "
                f"MEMORY.md is a pointer-only index — move content into topic files, keep one-line entries.\n")
    if warn_kb < size_kb <= block_kb:
        sys.stderr.write(
            f"[post-edit-laws] MEMORY WARN: {rel} is {size_kb:.1f}KB (soft limit {warn_kb:.0f}KB). "
            f"Distill toward a tight memory; split if it is accreting.\n")
lim = (hy.get("bloat_limits", {}) or {}).get(fp.rsplit(".",1)[-1].lower())
if lim:
    n = text.count("\n") + 1
    ceiling = int(lim * float(hy.get("hard_factor", 2)))  # float: hard_factor 1.5 must NOT truncate to 1
    if n > ceiling:
        sys.stderr.write(f"[post-edit-laws] BLOAT BLOCK: {rel} is {n} lines (hard ceiling {ceiling}). Split it — one concern per file (one-body, `05`/`09` hygiene). Do not keep appending.\n")
        sys.exit(2)
# The FF suite (`*.fitness.*` / `*.test.*`) is, BY CONSTRUCTION, the SSOT that DEFINES these
# forbid patterns: its BITES fixtures + regex constants deliberately hold the very strings a law
# blocks, to PROVE the law bites (e.g. FF-NO-EXTERNAL-SPECIAL-CASE asserts on a planted
# `registerNodeProjector('kpi-strip', …)`). Scanning a guard with the tripwire whose own SSOT it
# IS is the same category error the manifest skip (above) avoids — and every law_pattern msg names
# the FF suite as authoritative. Content law_patterns target PRODUCTION source; the FF suite is
# self-authoritative, so it is exempt from the fast non-authoritative content tripwire.
_is_ff_guard = ".fitness." in base or ".test." in base
violations = [] if _is_ff_guard else [p["msg"] for p in mf.get("law_patterns", [])
             if _match(p.get("glob", "*")) and re.search(p["forbid"], text, re.I)]
if violations:
    sys.stderr.write("[post-edit-laws] forbidden pattern(s) in %s — fix before continuing:\n" % fp)
    for v in violations: sys.stderr.write("  - " + v + "\n")
    sys.exit(2)
sys.exit(0)
