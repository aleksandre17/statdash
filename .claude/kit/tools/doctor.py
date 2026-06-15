#!/usr/bin/env python3
"""doctor.py — verify a deployed project is fully wired and the enforcement layer actually fires.
Run anytime:  python .claude/kit/tools/doctor.py        (the /verify playbook calls this)
Exit 0 = HEALTHY, 1 = issues. Read-only except a throwaway temp file it cleans up.
"""
import os, re, sys, json, glob, subprocess, tempfile
ROOT = os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd()
KIT = os.path.join(ROOT, ".claude", "kit")
P = lambda *a: os.path.join(ROOT, *a)
checks = []  # (ok, label, detail)
def ck(ok, label, detail=""): checks.append((bool(ok), label, detail))

# --- presence & version ---
ck(os.path.isdir(KIT), "kit vendored at .claude/kit/")
ver = open(os.path.join(KIT, "VERSION")).read().strip() if os.path.exists(os.path.join(KIT, "VERSION")) else "?"

# --- manifest valid vs schema ---
try:
    import jsonschema
    mf = json.load(open(P(".claude/project.json")))
    jsonschema.validate(mf, json.load(open(os.path.join(KIT, "project.schema.json"))))
    ck(True, "manifest valid vs schema")
except Exception as e:
    mf = {}; ck(False, "manifest valid vs schema", str(e)[:70])

# --- hook self-test (canonical fixture) ---
r = subprocess.run([sys.executable, os.path.join(KIT, "hooks", "selftest.py")], capture_output=True, text=True)
ck(r.returncode == 0, "hooks self-test 8/8")

# --- LIVE hook fire on THIS project's config (not just fixture) ---
gate = os.path.join(KIT, "hooks", "pre-edit-gate.py")
law = os.path.join(KIT, "hooks", "post-edit-laws.py")
env = {**os.environ, "CLAUDE_PROJECT_DIR": ROOT}
# (a) pre-edit-gate flags a Class-M path built from the manifest's migration trigger, if any
probed = False
for t in mf.get("class_m_triggers", []):
    if "migration" in t.get("label", "").lower() or "migration" in t.get("match", ""):
        probe = "apps/_probe/db/migration/V999999__doctor.sql"  # forward slashes — platform-independent probe
        rr = subprocess.run([sys.executable, gate], input=json.dumps({"tool_input": {"file_path": probe}}),
                            capture_output=True, text=True, env=env)
        ck("CLASS-M" in (rr.stdout + rr.stderr).upper() or "IRREVERS" in (rr.stdout + rr.stderr).upper(),
           "pre-edit-gate fires on a Class-M path (live)")
        probed = True; break
if not probed: ck(True, "pre-edit-gate live probe (no migration trigger — skipped)")
# (b) post-edit-laws blocks a synthetic violation of the first law_pattern, if expressible
lp = mf.get("law_patterns", [])
if lp:
    sample = lp[0].get("sample_violation")  # optional ready-made probe string
    if sample:
        tmp = os.path.join(tempfile.mkdtemp(), os.path.basename(lp[0].get("glob", "probe.sql")).replace("*", "V999"))
        open(tmp, "w").write(sample)
        rr = subprocess.run([sys.executable, law], input=json.dumps({"tool_input": {"file_path": tmp}}),
                            capture_output=True, text=True, env=env)
        ck(rr.returncode == 2, "post-edit-laws BLOCKS a law violation (live)")
    else:
        ck(True, "post-edit-laws live probe (no sample_violation in manifest — skipped)")
else:
    ck(True, "post-edit-laws (no law_patterns defined — skipped)")

# --- agent layer ---
adir = P(".claude/agents")
for a in ["orchestrator", "chief-engineer", "architect", "database-architect", "senior-backend-developer", "senior-frontend-developer", "project-manager", "debugger", "platform-architect", "explorer", "junior-executor"]:
    ck(os.path.exists(os.path.join(adir, f"{a}.md")), f"agent: {a}")
specs = [os.path.basename(x).replace(".md", "") for x in glob.glob(os.path.join(adir, "*-specialist.md"))]
ck(len(specs) >= 1, "module-specialist present", f"specialists={len(specs)}")
if os.path.exists(os.path.join(adir, "orchestrator.md")):
    o = open(os.path.join(adir, "orchestrator.md")).read()
    m = re.search(r"Agent\(([^)]*)\)", o); allow = m.group(1) if m else ""
    miss = [s for s in specs if s not in allow]
    ck(not miss, "orchestrator allowlist ⊇ specialists", f"missing {miss}")

# --- settings wiring ---
try:
    st = json.load(open(P(".claude/settings.json"))); sttxt = json.dumps(st)
    ck(st.get("agent") == "orchestrator", "settings: default agent = orchestrator")
    for ev in ["session-start", "pre-edit-gate", "post-edit-laws", "stop-check", "session-end-tokenlog"]:
        ck(ev in sttxt and ".claude/kit/hooks/" in sttxt, f"settings wires hook: {ev}")
except Exception as e:
    ck(False, "settings.json", str(e)[:60])

# --- slots present ---
for slot in [".claude/context/opus-brief.md", ".claude/strategy/03-A-examples.md",
             ".claude/commands/dev.md", ".claude/commands/laws.md", "CLAUDE.md",
             "memory/project_vision.md", "memory/project_roadmap.md", "memory/project_debt.md", "memory/user_profile.md"]:
    ck(os.path.exists(P(slot)), f"slot: {slot}")

# --- skills ---
for sk in (os.listdir(os.path.join(KIT, "skills")) if os.path.isdir(os.path.join(KIT, "skills")) else []):
    ck(os.path.exists(P(".claude", "skills", sk, "SKILL.md")), f"skill scaffolded: {sk}")

# --- work board (when configured) ---
wd = (mf.get("paths", {}) or {}).get("work_dir")
if wd:
    ck(os.path.isdir(P(wd, "items")), f"work board scaffolded: {wd}/items/")
    ck(os.path.exists(P(wd, "PROCESS.md")), f"work board protocol: {wd}/PROCESS.md")

# --- agent mirror drift guard (kit role agents == project copies unless tuned) ---
import hashlib as _hl
def _md5(fp): return _hl.md5(open(fp,"rb").read()).hexdigest()
for a in [f for f in os.listdir(os.path.join(KIT, "agents")) if f.endswith(".md")]:
    kp, pp = os.path.join(KIT, "agents", a), P(".claude", "agents", a)
    if not os.path.exists(pp) or _md5(kp) == _md5(pp): continue
    ck("tuned: true" in open(pp, encoding="utf-8").read().split(chr(10)+chr(45)*3+chr(10))[0],
       f"agent mirror: {a} diverged from kit without 'tuned: true' (refresh or mark)")

# --- slash-command shims (so /name works in Claude Code) ---
for kp in [f for f in os.listdir(os.path.join(KIT, "commands")) if f.endswith(".md")]:
    ck(os.path.exists(P(".claude", "commands", kp)), f"slash-command shim: /{kp[:-3]}")

# --- hygiene: structure guard + bloat report ---
hy = mf.get("hygiene", {}) or {}
sd = set(hy.get("claude_sanctioned_dirs", []))
if sd:
    extras = [d for d in os.listdir(P(".claude")) if os.path.isdir(P(".claude", d)) and d not in sd]
    ck(not extras, f"structure: .claude has only sanctioned dirs{' (extras: '+', '.join(extras)+')' if extras else ''}")
rt = set(hy.get("repo_sanctioned_top", []))
if rt:
    extras = [d for d in os.listdir(ROOT) if os.path.isdir(P(d)) and d not in rt]
    ck(not extras, f"structure: repo top-level sanctioned{' (extras: '+', '.join(extras)+')' if extras else ''}")
bl = hy.get("bloat_limits", {}) or {}
if bl:
    fat = []
    for root in (".claude", "memory"):
        for dp, _, fs in os.walk(P(root)):
            if "__pycache__" in dp or os.sep+"kit"+os.sep+"skills" in dp: continue
            for f in fs:
                ext = f.rsplit(".",1)[-1].lower()
                if ext in bl:
                    n = open(os.path.join(dp,f),encoding="utf-8",errors="ignore").read().count("\n")+1
                    if n > bl[ext]: fat.append(f"{os.path.relpath(os.path.join(dp,f), ROOT)}({n})")
    ck(not fat, f"hygiene: no file over its line limit{' (over: '+', '.join(fat[:5])+')' if fat else ''}")

# --- INDEX lists every playbook + strategy file ---
idx = open(os.path.join(KIT, "INDEX.md")).read() if os.path.exists(os.path.join(KIT, "INDEX.md")) else ""
for c in glob.glob(os.path.join(KIT, "commands", "*.md")):
    ck(os.path.basename(c) in idx, f"INDEX lists: {os.path.basename(c)}")

# --- report ---
passed = sum(1 for ok, *_ in checks if ok); failed = len(checks) - passed
print(f"\n=== DOCTOR — {os.path.basename(ROOT.rstrip('/'))} (kit {ver}) ===")
for ok, label, detail in checks:
    print(f"  {'✓' if ok else '✗'} {label}" + (f"  [{detail}]" if detail and not ok else ""))
print(f"\n{passed}/{len(checks)} checks passed.", "HEALTHY ✓" if not failed else f"— {failed} ISSUE(S): fix the ✗ lines above.")
sys.exit(0 if not failed else 1)
