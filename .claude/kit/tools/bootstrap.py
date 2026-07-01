#!/usr/bin/env python3
"""bootstrap.py — make a freshly-copied project ready in one shot.
Auto-detects the architecture, drafts project.json, scaffolds missing slots from kit/templates,
validates against the schema, and runs the hook self-test. Idempotent: never overwrites existing files.
Run:  python .claude/kit/tools/bootstrap.py        (the /bootstrap playbook calls this)
"""
import os, re, sys, json, glob, shutil, subprocess

ROOT = os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd()
KIT  = os.path.join(ROOT, ".claude", "kit")
TPL  = os.path.join(KIT, "templates")
def p(*a): return os.path.join(ROOT, *a)
report = {"detected": {}, "scaffolded": [], "kept": [], "todo": [], "checks": {}}

if not os.path.isdir(KIT):
    print("ERROR: .claude/kit/ not found. Vendor the kit first (git submodule add … .claude/kit)."); sys.exit(1)

def kit_version():
    try: return open(os.path.join(KIT, "VERSION")).read().strip()
    except Exception: return "unknown"

# ---------- --check : post-upgrade compatibility doctor (no scaffolding) ----------
if "--check" in sys.argv:
    print("kit version:", kit_version())
    ok = True
    try:
        import jsonschema
        jsonschema.validate(json.load(open(p(".claude", "project.json"))),
                            json.load(open(os.path.join(KIT, "project.schema.json"))))
        print("manifest vs schema: valid ✓")
    except Exception as e:
        ok = False
        print("manifest vs schema: FAIL —", e, "\n  → add/fix that field in .claude/project.json (a kit update added it)")
    r = subprocess.run([sys.executable, os.path.join(KIT, "hooks", "selftest.py")], capture_output=True, text=True)
    print("hooks selftest:", "8/8 ✓" if r.returncode == 0 else "FAIL\n" + r.stdout)
    good = ok and r.returncode == 0
    print("STATUS:", "COMPATIBLE ✓ (fix is in; nothing to change)" if good else "needs attention — see above")
    sys.exit(0 if good else 1)

# ---------- 1. detect architecture ----------
def dirs(sub):
    d = p(sub)
    return sorted(n for n in os.listdir(d)) if os.path.isdir(d) else []
apps = dirs("apps"); libs = dirs("libs")
modules = [f"apps/{a}" for a in apps] + [f"libs/{l}" for l in libs]
report["detected"]["modules"] = modules or ["(none — single-module or flat repo)"]

migs = glob.glob(p("**", "db", "migration", "V*__*.sql"), recursive=True) or \
       glob.glob(p("**", "migrations", "*.sql"), recursive=True)
contract_dir = next((m for m in modules if "contract" in m.lower()), None)
build = next((b for b in ["build.gradle.kts","pom.xml","package.json","pyproject.toml","go.mod","Cargo.toml"]
             if glob.glob(p("**", b), recursive=True)), None)
exts = {os.path.splitext(f)[1] for f in glob.glob(p("**","*.*"), recursive=True)[:4000]}
langs = [e for e in [".java",".kt",".ts",".tsx",".py",".go",".rs"] if e in exts]
report["detected"].update({"migrations": bool(migs), "contracts_module": contract_dir,
                           "build_file": build, "languages": langs})

# ---------- 2. draft project.json (only if absent) ----------
triggers = []
if migs:
    triggers.append({"match": r"(db/migration|migrations).*V?\d+.*\.sql$", "label": "NEW migration",
                     "irreversible": True, "note": "Mandatory-Opus + the owning module's DB rules + Decision Inventory"})
if contract_dir:
    name = contract_dir.split("/")[-1]
    triggers.append({"match": rf"/{name}/.*\.(java|kt|ts)$", "label": f"{name} change (cross-module contract)",
                     "irreversible": True, "note": "Mandatory-Opus + one-body"})
if build:
    triggers.append({"match": rf"{re.escape(build)}$", "label": "module/dependency change",
                     "irreversible": False, "note": "New module/lib? -> Mandatory-Opus"})
draft = {
    "$schema": "./kit/project.schema.json", "project": os.path.basename(ROOT.rstrip("/")),
    "law_doc": "CLAUDE.md", "module_law_docs": {}, "lang_codes": [],
    "class_m_triggers": triggers, "law_patterns": [],
    "resume_marker": ({"regex": r"[Ll]ast .*migration:?\*?\*?\s*V?(\d+)",
                       "repo_glob": "**/db/migration/V*__*.sql", "repo_regex": r"[/\\]V?(\d+)",
                       "label": "migration"} if migs else {}),
    "learning_dir": "docs/learning/",
    "code_globs": langs or [".py"],
    "paths": {"audit_dir": "docs/audit/", "architecture_dir": "docs/architecture/",
              "roadmap_file": "IMPLEMENTATION-ROADMAP.md", "layers_dir": "docs/layers/",
              "learning_dir": "docs/learning/", "decisions_file": "docs/decisions.md", "work_dir": "work"},
    "modules": modules,
}
mf = p(".claude", "project.json")
if os.path.exists(mf):
    json.dump(draft, open(p(".claude","project.detected.json"),"w"), indent=2, ensure_ascii=False)
    report["kept"].append(".claude/project.json (existing kept — draft → .claude/project.detected.json to merge)")
else:
    json.dump(draft, open(mf,"w"), indent=2, ensure_ascii=False)
    report["scaffolded"].append(".claude/project.json (from detection)")
    report["todo"].append("project.json: fill law_patterns (forbidden regexes), module_law_docs, lang_codes")

# ---------- 3. scaffold missing slots (never overwrite) ----------
def place(dst, src, todo=None):
    d = p(*dst)
    if os.path.exists(d): report["kept"].append("/".join(dst)); return
    os.makedirs(os.path.dirname(d), exist_ok=True)
    if os.path.exists(src): shutil.copy(src, d)
    else: open(d,"w").write("")
    report["scaffolded"].append("/".join(dst))
    if todo: report["todo"].append(todo)

# settings.json (fix nothing — template already points hooks at .claude/kit/hooks)
place([".claude","settings.json"], os.path.join(KIT,"settings.template.json"))
place([".claude","context","opus-brief.md"], os.path.join(TPL,"opus-brief.template.md"),
      "opus-brief.md: write the first §Current State (or run /architecture then /roadmap)")
place([".claude","commands","dev.md"], os.path.join(TPL,"dev.md.template"),
      "commands/dev.md: your build/test/run commands")
place([".claude","commands","laws.md"], os.path.join(TPL,"laws.md.template"))
for slot in ["project_vision","project_roadmap","project_debt","user_profile"]:
    place(["memory", f"{slot}.md"], os.path.join(TPL, f"{slot}.template.md"),
          f"memory/{slot}.md: fill it")
if not os.path.exists(p("CLAUDE.md")):
    place(["CLAUDE.md"], os.path.join(TPL,"CLAUDE.md.template"),
          "CLAUDE.md: the project's stack + non-negotiable laws (the kit points here)")
else:
    report["kept"].append("CLAUDE.md (existing — laws read from here)")

# ---------- 3b. scaffold the agent layer (.claude/agents/ — where Claude Code discovers subagents) ----------
KAGENTS = os.path.join(KIT, "agents")
if os.path.isdir(KAGENTS):
    for fn in os.listdir(KAGENTS):
        if fn.endswith(".template"): continue  # handled per-module below
        place([".claude", "agents", fn], os.path.join(KAGENTS, fn))
    # generate one <module>-specialist.md per detected app module (sonnet), from the template
    tpl = os.path.join(KAGENTS, "module-specialist.md.template")
    if os.path.exists(tpl) and apps:
        body = open(tpl, encoding="utf-8").read()
        for a in apps:
            name = a.replace("/", "-")
            dst = p(".claude", "agents", f"{name}-specialist.md")
            if os.path.exists(dst): report["kept"].append(f".claude/agents/{name}-specialist.md"); continue
            open(dst, "w", encoding="utf-8").write(body.replace("<module>", name).replace("<module-path>", f"apps/{a}"))
            report["scaffolded"].append(f".claude/agents/{name}-specialist.md (generated)")
    # the orchestrator can only spawn agents in its Agent(...) allowlist — sync the generated specialists in
    orch = p(".claude", "agents", "orchestrator.md")
    specialists = [f"{a.replace('/', '-')}-specialist" for a in apps]
    if os.path.exists(orch) and specialists:
        t = open(orch, encoding="utf-8").read()
        m = re.search(r"Agent\(([^)]*)\)", t)
        if m:
            have = [x.strip() for x in m.group(1).split(",") if x.strip()]
            add = [s for s in specialists if s not in have]
            if add:
                t = t[:m.start()] + "Agent(" + ", ".join(have + add) + ")" + t[m.end():]
                open(orch, "w", encoding="utf-8").write(t)
                report["scaffolded"].append(f"orchestrator allowlist += {', '.join(add)}")

# ---------- 3c. scaffold skills (.claude/skills/ — where Claude Code discovers skills) ----------
KSKILLS = os.path.join(KIT, "skills")
if os.path.isdir(KSKILLS):
    for sk in os.listdir(KSKILLS):
        srcd = os.path.join(KSKILLS, sk)
        if not os.path.isdir(srcd): continue
        dst = p(".claude", "skills", sk, "SKILL.md")
        if os.path.exists(dst):
            report["kept"].append(f".claude/skills/{sk}/SKILL.md"); continue
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        src = os.path.join(srcd, "SKILL.md")
        if os.path.exists(src):
            import shutil as _sh; _sh.copy(src, dst); report["scaffolded"].append(f".claude/skills/{sk}/SKILL.md")

# ---------- 3d. scaffold work board ----------
wd = None
try:
    wd = (json.load(open(mf)).get("paths", {}) or {}).get("work_dir")
except Exception:
    pass
if wd:
    import shutil as _sh
    twd = os.path.join(KIT, "templates", "work")
    if os.path.isdir(twd):
        os.makedirs(p(wd, "items"), exist_ok=True)
        for t in ("PROCESS.md", "BOARD.md"):
            src, dst = os.path.join(twd, t + ".template"), p(wd, t)
            if os.path.exists(src) and not os.path.exists(dst):
                _sh.copy(src, dst); report["scaffolded"].append(f"{wd}/{t}")
        gk = p(wd, "items", ".gitkeep")
        if not os.path.exists(gk): open(gk, "w").close()

# ---------- 3e. scaffold slash-command shims (.claude/commands/ — where Claude Code discovers /commands) ----------
# The shim is produced by the SSOT renderer (render.render_command), so a freshly-scaffolded
# command is byte-identical to what `render.py --check` (the drift guard) expects — no divergence.
import glob as _g
sys.path.insert(0, os.path.join(KIT, "tools"))
import render as _render
for kp in _g.glob(os.path.join(KIT, "commands", "*.md")):
    nm = os.path.basename(kp)[:-3]
    dst = p(".claude", "commands", nm + ".md")
    if os.path.exists(dst): continue
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    kit_text = open(kp, encoding="utf-8").read()
    open(dst, "w", encoding="utf-8", newline="").write(_render.render_command(nm, kit_text))
    report["scaffolded"].append(f".claude/commands/{nm}.md")

# ---------- 4. validate + self-test ----------
try:
    import jsonschema
    jsonschema.validate(json.load(open(mf)), json.load(open(os.path.join(KIT,"project.schema.json"))))
    report["checks"]["manifest_valid"] = True
except Exception as e:
    report["checks"]["manifest_valid"] = f"FAIL: {e}"
try:
    r = subprocess.run([sys.executable, os.path.join(KIT,"hooks","selftest.py")],
                       capture_output=True, text=True, timeout=60)
    report["checks"]["selftest"] = "8/8" if r.returncode == 0 else f"FAIL\n{r.stdout}"
except Exception as e:
    report["checks"]["selftest"] = f"ERROR: {e}"

# ---------- 5. report ----------
print("\n=== BOOTSTRAP REPORT ===")
print("\nDetected architecture:")
for k,v in report["detected"].items(): print(f"  {k}: {v}")
print("\nScaffolded (new):");  [print(f"  + {x}") for x in report["scaffolded"]] or print("  (none)")
print("\nKept (already present):"); [print(f"  = {x}") for x in report["kept"]] or print("  (none)")
print("\nChecks:");  [print(f"  {k}: {v}") for k,v in report["checks"].items()]
print("\nTODO before first real task (judgment — needs you):")
[print(f"  [ ] {x}") for x in report["todo"]] or print("  (none — ready)")
ready = report["checks"].get("manifest_valid") is True and report["checks"].get("selftest") == "8/8"
print("\nSTATUS:", "READY ✓ (clear the TODO, then say /architecture or /layer)" if ready else "needs attention — see Checks")
sys.exit(0 if ready else 1)
