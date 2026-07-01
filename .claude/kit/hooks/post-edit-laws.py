#!/usr/bin/env python3
"""PostToolUse (Write|Edit|MultiEdit) — generic law check on the changed file. Patterns come from
project.json (law_patterns); the kit has no hardcoded antipatterns. exit 2 = corrective feedback."""
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
try:
    rel = os.path.relpath(fp, root).replace(os.sep, "/")
except ValueError:
    rel = base
def _match(glob): return fnmatch.fnmatch(rel, glob) or fnmatch.fnmatch(base, glob)
hy = load().get("hygiene", {}) or {}
lim = (hy.get("bloat_limits", {}) or {}).get(fp.rsplit(".",1)[-1].lower())
if lim:
    n = text.count("\n") + 1
    if n > lim * int(hy.get("hard_factor", 2)):
        sys.stderr.write(f"[post-edit-laws] BLOAT BLOCK: {rel} is {n} lines (hard ceiling {lim*int(hy.get('hard_factor',2))}). Split it — one concern per file (one-body, `05`/`09` hygiene). Do not keep appending.\n")
        sys.exit(2)
violations = [p["msg"] for p in load().get("law_patterns", [])
             if _match(p.get("glob", "*")) and re.search(p["forbid"], text, re.I)]
if violations:
    sys.stderr.write("[post-edit-laws] forbidden pattern(s) in %s — fix before continuing:\n" % fp)
    for v in violations: sys.stderr.write("  - " + v + "\n")
    sys.exit(2)
sys.exit(0)
