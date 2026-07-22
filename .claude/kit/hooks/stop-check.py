#!/usr/bin/env python3
"""Stop — session-close disciplines. WARN_ONLY=True (set False to hard-enforce via exit 2).
Code/learning globs come from project.json; kit has no hardcoded paths."""
import os, sys, subprocess
try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")  # warnings (incl. the — dash in the loss report) go to stderr
except (AttributeError, ValueError):
    pass
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _manifest import load
from _worktree import deletion_report
WARN_ONLY = True
root = os.environ.get("CLAUDE_PROJECT_DIR", ".")
mf = load()
warn = []
brief = os.path.join(root, ".claude", "context", "opus-brief.md")
try:
    cs, on = [], False
    for ln in open(brief, encoding="utf-8").read().splitlines():
        if ln.startswith("## Current State"): on = True; continue
        if ln.startswith("## Last Session"): on = False
        if on: cs.append(ln)
    if len(cs) > 80:
        warn.append(f"opus-brief §Current State = {len(cs)} lines > 80. Rotate (05): oldest layer -> docs/layers/.")
except OSError:
    pass
# --- brief FRESHNESS tripwire (owner, 2026-07-22: "why is opus-brief ALWAYS old?") -----------
# Root cause: the update was tied to a close ritual that rarely fires, and nothing watched
# staleness. Machine rule: if repo commits are newer than the §Current State date, the brief
# lies to the next SessionStart injection — warn EVERY Stop until it is rewritten mid-flight.
try:
    import re as _re, subprocess as _sp, datetime as _dt
    m = _re.search(r"^## Current State \((\d{4}-\d{2}-\d{2})",
                   open(brief, encoding="utf-8").read(), _re.M)
    last_commit = _sp.run(["git", "-C", root, "log", "-1", "--format=%cs"],
                          capture_output=True, text=True, timeout=10).stdout.strip()
    if m and last_commit and last_commit > m.group(1):
        warn.append(f"opus-brief §Current State is STALE ({m.group(1)}) — commits exist from "
                    f"{last_commit}. Rewrite §Current State NOW (mid-flight, not at close): "
                    f"the next SessionStart injects this file as truth.")
except Exception:
    pass
log = os.path.join(root, ".claude", "session", "token-log.md")
try:
    if not [l for l in open(log, encoding="utf-8") if l.startswith("[")]:
        warn.append("token-log.md has no run entries this session — append the ledger line before closing.")
except OSError:
    pass
# --- rotation size nudge (load exactly what is necessary): trim, don't let the hot layer bloat ---
ctx = os.path.join(root, ".claude", "session", "context.md")
for path, label, limit_kb in ((ctx, "context.md", 15), (log, "token-log.md", 20)):
    try:
        kb = os.path.getsize(path) / 1024
        if kb > limit_kb:
            warn.append(f"{label} = {kb:.0f}KB > ~{limit_kb}KB. Run /rotate: hot head stays, "
                        f"cold layers -> docs/layers/ + .claude/session/archive/ (kit 05).")
    except OSError:
        pass
try:
    learning_dir = mf.get("learning_dir", "docs/learning/")
    code_globs = tuple(mf.get("code_globs", [".java", ".jsx", ".ts"]))
    diff = subprocess.run(["git", "-C", root, "diff", "--name-only", "HEAD"],
                          capture_output=True, text=True, timeout=10).stdout.split()
    if any(f.endswith(code_globs) for f in diff) and not any(f.startswith(learning_dir) for f in diff):
        warn.append(f"Production code changed but no {learning_dir} note staged. If an architectural concept was touched -> learning note is due (07). Judgment call.")
except Exception:
    pass
# working-tree loss guard (Tier A, WARN-only — SSOT in _worktree.py)
try:
    rep = deletion_report(root, mf)
    if rep:
        warn.append(rep)
except Exception:
    pass
# canonical work-dir guard — the rogue 2nd work dir must not return; scratch must not get tracked.
# Canon: ONE work/ (board only) + docs/ for docs; ephemera (png/probe/*-shots) never tracked.
try:
    if os.path.isdir(os.path.join(root, "platform", "work")):
        warn.append("platform/work/ exists again — the rogue 2nd work dir (canon: ONE work/ = board only, docs/ for docs). Relocate its artifacts + remove it.")
    wt = subprocess.run(["git", "-C", root, "ls-files", "work/"], capture_output=True, text=True, timeout=10).stdout.split()
    # Sanctioned tracked evidence (manifest hygiene.evidence_globs, e.g. per-card J-walk proof
    # dirs) is NOT scratch — the journey-gate's evidence trail is deliberately committed.
    import fnmatch as _fn
    ev_globs = (mf.get("hygiene", {}) or {}).get("evidence_globs", []) or []
    def _sanctioned(f):
        return any(_fn.fnmatch(f, g) or _fn.fnmatch(f, g.rstrip("*") + "**") for g in ev_globs)
    scratch = [f for f in wt if not _sanctioned(f)
               and (f.endswith(".png") or "-shots/" in f or "probe" in os.path.basename(f))]
    if scratch:
        warn.append(f"{len(scratch)} scratch file(s) tracked under work/ (png/probe/shots) — regenerable ephemera must not be committed. git rm --cached + .gitignore.")
except Exception:
    pass
if warn:
    for w in warn: sys.stderr.write("[stop-check] " + w + "\n")
    sys.stderr.write("[stop-check] session-close disciplines incomplete (WARN_ONLY=%s).\n" % WARN_ONLY)
    sys.exit(0 if WARN_ONLY else 2)
sys.exit(0)
