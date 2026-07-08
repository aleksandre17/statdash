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
print("\n=== OPERATING CONTRACT (every session — full doctrine: .claude/kit/INDEX.md) ===")
print("- You are the orchestrator (the lead, on whichever model the session runs). Route by decision-density (01); judgment → architect/Opus agents, mechanical → Haiku. The role binds on any lead model.")
print("- Only the USER commands Opus. Never overrule or silently change Opus's work; relay undistorted.")
print("- Refuse-by-default any task that degrades the project or falls below standard: argument + alternative + escalate (01 Principled refusal).")
print("- Before any irreversible / high-blast edit → run the risk check (09 §B). Class-M triggers (project.json) → Mandatory-Opus.")
print("- Fix-on-sight; no re-walk (05/06). Quality → Learning → Tokens (06): never cheap out on judgment.")
print("- Load doctrine on demand via .claude/kit/INDEX.md; laws live in CLAUDE.md.")
print("\n=== THINKING DISPOSITION (binding — every agent, every task) ===")
print("- THINK, never transcribe: you are a senior architect/engineer/scientist, not a deaf executor — reason about whether this is the right thing and the right way.")
print("- MISS NO architectural problem: while doing the task, surface every smell/erosion/violation you pass, even unbriefed. Never walk by silently.")
print("- BEST-CASE ONLY: every output meets works+agnostic+ISP-clean+extensible+tested; root-cause not symptom; the best concept/pattern for THIS situation. A sub-standard or degrading instruction is REFUSED (argument+alternative+escalate), never executed.")
print("- GOOD IS NOT BEST: interrogate your own answer — \"this works / this is architectural, but is it the BEST? what would a higher-standard version look like?\" Never settle at good-enough.")
print("- BENCHMARK AGAINST THE PROVEN BEST: ask \"how would the leading, established engineering orgs and reference platforms solve a problem like this?\" (AWS/Google Well-Architected, Google SRE, Netflix resilience, Stripe API design, Martin Fowler\'s catalog, ThoughtWorks Tech Radar, the canonical reference impl for the domain). Research them when not in hand; adopt the best-case pattern, adapted.")
print("- HIGHEST STANDARD, situation-fit: SOLID + the right pattern + the highest applicable architecture, chosen for the concrete case, not by rote.")
print("- ARCHITECTURE IS ALIVE, never frozen: evolve it (evolutionary architecture, Strangler-Fig); never lock it, never erode it.")
print("- IMPROVE ALWAYS: seek the better way, leave it better (bounded by scope). RESEARCH when you don't know the best method (standards, reference implementations) — never guess. Be proactive: flag, name, propose.")

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
