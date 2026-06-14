#!/usr/bin/env python3
"""SessionStart — inject durable §Current State, then check it's not STALE vs the repo.
The stale-check's markers come from project.json (resume_marker); kit has no hardcoded VNN."""
import os, sys, re, glob
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _manifest import load
root = os.environ.get("CLAUDE_PROJECT_DIR", ".")
brief = os.path.join(root, ".claude", "context", "opus-brief.md")
try:
    text = open(brief, encoding="utf-8").read()
except OSError:
    print("[hook] opus-brief.md missing — no resume state."); sys.exit(0)
out, on = [], False
for ln in text.splitlines():
    if ln.startswith("## Current State"): on = True
    elif ln.startswith("## Last Session"): on = False
    if on: out.append(ln)
print("=== RESUME STATE (opus-brief §Current State, injected by SessionStart hook) ===")
print("\n".join(out))
try:
    _mode = open(os.path.join(root, ".claude", "session", "mode"), encoding="utf-8").read().strip() or "build"
except OSError:
    _mode = "build"
_postures = {"build": "normal execution loop", "plan": "design/plan only — NO code edits",
             "review": "scrutiny — audit/review/verify focus", "strict": "maximum enforcement, more questions, reversible-first",
             "fast": "minimal ceremony for trivial reversible tasks"}
print(f"\n=== OPERATING MODE: {_mode} ({_postures.get(_mode, 'custom')}) — switch with /mode. A mode is a posture, never a bypass: hard guards stay on. ===")
print("\n=== OPERATING CONTRACT (every session — full doctrine: .claude/kit/INDEX.md) ===")
print("- You are the orchestrator (the lead, on whichever model the session runs). Route by decision-density (01); judgment → architect/Opus agents, mechanical → Haiku. The role binds on any lead model.")
print("- Only the USER commands Opus. Never overrule or silently change Opus's work; relay undistorted.")
print("- Refuse-by-default any task that degrades the project or falls below standard: argument + alternative + escalate (01 Principled refusal).")
print("- Before any irreversible / high-blast edit → run the risk check (09 §B). Class-M triggers (project.json) → Mandatory-Opus.")
print("- Fix-on-sight; no re-walk (05/06). Quality → Learning → Tokens (06): never cheap out on judgment.")
print("- Load doctrine on demand via .claude/kit/INDEX.md; laws live in CLAUDE.md.")
rm = load().get("resume_marker")
if rm:
    try:
        m = re.search(rm["regex"], text)
        claimed = int(m.group(1)) if m else 0
        files = glob.glob(os.path.join(root, *rm["repo_glob"].split("/")), recursive=True)
        vers = [int(mm.group(1)) for f in files if (mm := re.search(rm["repo_regex"], f))]
        repo_max = max(vers) if vers else None
        if repo_max and claimed and repo_max > claimed:
            print(f"\n⚠ STALE RESUME WARNING: brief claims {rm['label']} V{claimed}, repo has V{repo_max}. "
                  f"§Current State may be out of date — RECONCILE before trusting this resume.")
    except Exception:
        pass
sys.exit(0)
