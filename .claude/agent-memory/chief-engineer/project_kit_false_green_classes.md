---
name: kit-false-green-classes
description: Two false-green classes the .claude-OS closing audit caught — cp1252 hook stdout crashes + engine-stale project.json paths; how to re-detect
metadata:
  type: project
---

The `.claude` kit enforcement layer can report green while being silently broken. Two classes found at the SSOT-reorg closing gate (branch `chore/claude-os-reorg`), both root-fixed:

1. **cp1252 stdout crash in Python hooks/tools (Windows).** A hook that `print()`s a glyph absent from cp1252 (notably `→` U+2192; also `✓/✗`) raises `UnicodeEncodeError` and aborts. `session-start.py` crashed MID-injection → the SessionStart auto-load was TRUNCATED and the stale-check never ran; `doctor.py` crashed on its first check line. Note: `§` and em-dash `—` ARE cp1252-encodable, so hooks using only those don't crash — the trap is the rarer glyph.
   **Fix / guard:** every hook/tool that prints must `try: sys.stdout.reconfigure(encoding="utf-8") except (AttributeError,ValueError): pass` at import. Output must not depend on the ambient console. This mirrors the earlier cp1252 `open()` fixes (files must be opened `encoding="utf-8"`).
   **Re-detect:** run hooks via `subprocess(text=True)` on a cp1252 console (what `selftest.py` does) — a passing selftest exercises this. A crash aborts before the assertion, so the symptom shows up as an *unrelated* assertion failing (e.g. "detects STALE").

2. **`project.json` pointed at the retired `platform/engine/**` tree** (real code is `platform/packages/**`). `modules`, `law_patterns` globs, `class_m_triggers`, `shared_lib_root`, `module_law_docs` all matched a non-existent path → **law patterns fired on nothing (false green)**. Also `doctor.py`'s pre-edit-gate live probe hardcoded a generic `apps/_probe/db/migration/...` path that never matched this repo's `ops/postgres/migrations/` trigger — now derives the probe from `resume_marker.repo_glob` (true positive).
   **Re-detect:** `doctor.py` line-limit/probe checks + grep `project.json` for paths that don't `ls`.

**Why:** these are the "false-green" failure mode — the gate is worse than no gate because it lulls. **How to apply:** when auditing the kit, never trust a green hook without confirming the hook actually *reached* its assertion and its manifest paths resolve on the real tree. See `docs/archive/kit-reorg/merge-log.md` §"Phase 6+8".
