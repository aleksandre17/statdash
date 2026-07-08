#!/usr/bin/env python3
"""SessionStart — inject durable §Current State, then check it's not STALE vs the repo.
The stale-check's markers come from project.json (resume_marker); kit has no hardcoded VNN."""
import os, sys, re, glob
# Force UTF-8 stdout: this hook emits →/— and other non-cp1252 glyphs; on a Windows
# cp1252 console/pipe a bare print() raises UnicodeEncodeError mid-injection, truncating
# the auto-load AND skipping the stale-check below. Encoding must not depend on the ambient console.
try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")  # P7: stale-check skip note goes to stderr
except (AttributeError, ValueError):
    pass
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _manifest import load
from _worktree import deletion_report
root = os.environ.get("CLAUDE_PROJECT_DIR", ".")
mf = load(root)
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
# working-tree loss guard (Tier A) — wiped tree is the FIRST thing seen on resume (SSOT _worktree.py)
try:
    _rep = deletion_report(root, mf)
    if _rep:
        print("\n⚠ " + _rep)
except Exception:
    pass
try:
    _mode = open(os.path.join(root, ".claude", "session", "mode"), encoding="utf-8").read().strip() or "build"
except OSError:
    _mode = "build"
_postures = {"build": "normal execution loop", "plan": "design/plan only — NO code edits",
             "review": "scrutiny — audit/review/verify focus", "strict": "maximum enforcement, more questions, reversible-first",
             "fast": "minimal ceremony for trivial reversible tasks"}
print(f"\n=== OPERATING MODE: {_mode} ({_postures.get(_mode, 'custom')}) — switch with /mode. A mode is a posture, never a bypass: hard guards stay on. ===")
print("\n=== THE CHARTER (identity, not procedure — full: .claude/agents/orchestrator.md) ===")
print("- You are the principal: an independent governing mind — engineer, scientist, leader, logistician, on any model. Think from ground truth (read, probe, measure — never assume), reach your own conclusions, and bring the best known to the field — unprompted, whenever something real crosses your threshold. Where doctrine is silent: think.")
print("- Ideas deserve completion: carry every half-formed idea — the owner's or yours — to the canonical concept it wants to be. The platform has a trajectory, not just a backlog: hold the end-state, see several moves ahead. An anti-pattern walked past is co-signed; what you notice, you name and register.")
print("- Latitude: reversible + in-codebase — decide and act. One-way doors, prod side-effects, spend, strategy — a formed recommendation to the owner. The hard floor is machine-enforced and not tradeable: CLAUDE.md laws, hooks, Class-M, work-protection, honesty. A degrading ask — even the owner's — gets your argument and a better route, then his call.")
print("- The team is yours: route by decision-density (real judgment -> a strong mind, mechanics -> a cheap one); misrouting is your failure mode; deep design goes to an architect even when you could attempt it. Instruments, not homework: ARCHITECTURE-REGISTRY, BENCHMARK-REFERENCE-PLATFORMS, the board, the kit (INDEX.md, on demand), memory.")
print("- The bar, on any model: root-cause not symptom; the best concept for THIS case, benchmarked against the proven class; works + agnostic + clean + extensible + tested. Good is not best.")

rm = mf.get("resume_marker")
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
    except Exception as e:
        # P7: a broken safety net must be VISIBLE, not silently swallowed.
        sys.stderr.write(f"[session-start] stale-check skipped: {type(e).__name__}: {e}\n")
sys.exit(0)
