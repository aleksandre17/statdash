#!/usr/bin/env python3
"""Hook self-test (hole #4: hooks are now load-bearing — verify them before relying).
Runs every hook against safe synthetic inputs in a throwaway dir. Touches NO real state.
Usage: python .claude/kit/hooks/selftest.py   ->   prints PASS/FAIL per hook, exit 1 if any FAIL."""
import os, sys, json, subprocess, tempfile, shutil
HOOKS = os.path.dirname(os.path.abspath(__file__))
PY = sys.executable
results = []

def run(hook, env_root=None, stdin=None):
    env = dict(os.environ)
    if env_root: env["CLAUDE_PROJECT_DIR"] = env_root
    p = subprocess.run([PY, os.path.join(HOOKS, hook)], input=stdin,
                       capture_output=True, text=True, timeout=15, env=env)
    return p.returncode, p.stdout, p.stderr

def check(name, cond):
    results.append((name, cond)); print(f"  {'PASS' if cond else 'FAIL'}  {name}")

tmp = tempfile.mkdtemp()
try:
    # fixtures: a fake project with a stale brief (claims V81) and a real V83 migration
    os.makedirs(os.path.join(tmp, ".claude", "context"))
    os.makedirs(os.path.join(tmp, ".claude", "session"))
    mig = os.path.join(tmp, "apps", "ing", "db", "migration"); os.makedirs(mig)
    open(os.path.join(mig, "V83__x.sql"), "w").write("-- ok")
    open(os.path.join(tmp, ".claude", "context", "opus-brief.md"), "w").write(
        "## Current State\n**Last committed migration:** V81 (x).\n## Last Session\n")
    open(os.path.join(tmp, ".claude", "session", "token-log.md"), "w").write("[2026-06-01] run tokens=~1000\n")
    _root = os.path.dirname(HOOKS)
    _mf = os.path.join(_root, "project.json")
    if not os.path.isfile(_mf): _mf = os.path.join(_root, "templates", "project.json.example")
    shutil.copy(_mf, os.path.join(tmp, ".claude", "project.json"))

    rc, so, se = run("session-start.py", env_root=tmp)
    check("session-start injects resume state", "RESUME STATE" in so)
    check("session-start detects STALE (V81 vs repo V83)", "STALE RESUME WARNING" in so)

    rc, so, se = run("pre-edit-gate.py", env_root=tmp, stdin=json.dumps({"tool_input":{"file_path":"x/db/migration/V90__a.sql"}}))
    check("pre-edit-gate flags migration as Class-M+IRREVERSIBLE", "IRREVERSIBLE" in so and rc == 0)
    rc, so, se = run("pre-edit-gate.py", stdin=json.dumps({"tool_input":{"file_path":"x/App.jsx"}}))
    check("pre-edit-gate silent on ordinary file", so.strip() == "" and rc == 0)

    bad = os.path.join(tmp, "V1__b.sql"); open(bad, "w").write("status TEXT CHECK (status IN ('a','b'))")
    rc, so, se = run("post-edit-laws.py", env_root=tmp, stdin=json.dumps({"tool_input":{"file_path":bad}}))
    check("post-edit-laws blocks CHECK-enum (exit 2)", rc == 2)
    rc, so, se = run("post-edit-laws.py", stdin=json.dumps({"tool_input":{"file_path":"/nonexistent.sql"}}))
    check("post-edit-laws safe on missing file (exit 0)", rc == 0)

    rc, so, se = run("stop-check.py", env_root=tmp)
    check("stop-check runs without crashing (WARN posture)", rc == 0)

    rc, so, se = run("session-end-tokenlog.py", env_root=tmp)
    log = open(os.path.join(tmp, ".claude", "session", "token-log.md")).read()
    check("session-end appends a measured rollup", "SESSION ROLLUP" in log)
finally:
    shutil.rmtree(tmp, ignore_errors=True)

failed = [n for n, ok in results if not ok]
print(f"\n{len(results)-len(failed)}/{len(results)} passed." + (f" FAILED: {failed}" if failed else " All hooks healthy."))
sys.exit(1 if failed else 0)
