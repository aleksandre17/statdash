#!/usr/bin/env python3
"""Stop — session-close disciplines. WARN_ONLY=True (set False to hard-enforce via exit 2).
Code/learning globs come from project.json; kit has no hardcoded paths."""
import os, sys, subprocess
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _manifest import load
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
if warn:
    for w in warn: sys.stderr.write("[stop-check] " + w + "\n")
    sys.stderr.write("[stop-check] session-close disciplines incomplete (WARN_ONLY=%s).\n" % WARN_ONLY)
    sys.exit(0 if WARN_ONLY else 2)
sys.exit(0)
