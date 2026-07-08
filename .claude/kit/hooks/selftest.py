#!/usr/bin/env python3
"""Hook self-test — hooks are load-bearing, so verify them before relying (hole #4).
Runs every hook against safe synthetic inputs in throwaway dirs. Touches NO real state
(git init happens in tmp only — never the real repo). A true FITNESS FUNCTION over the LIVE
manifest (.claude/project.json): every law_pattern's sample_violation must (a) match its own
forbid and (b) actually be blocked (exit 2) by post-edit-laws.

Usage: python .claude/kit/hooks/selftest.py  ->  PASS/FAIL per case, exit 1 if any FAIL."""
import os, sys, re, json, subprocess, tempfile, shutil
try:
    sys.stdout.reconfigure(encoding="utf-8")
except (AttributeError, ValueError):
    pass
HOOKS = os.path.dirname(os.path.abspath(__file__))
# P1: resolve the LIVE manifest (<repo>/.claude/project.json), NOT the stale templates example.
LIVE_MF = os.path.join(os.path.dirname(os.path.dirname(HOOKS)), "project.json")
PY = sys.executable
results = []


def run(hook, env_root=None, stdin=None):
    env = dict(os.environ)
    if env_root:
        env["CLAUDE_PROJECT_DIR"] = env_root
    p = subprocess.run([PY, os.path.join(HOOKS, hook)], input=stdin,
                       capture_output=True, text=True, encoding="utf-8", errors="replace",
                       timeout=30, env=env)
    return p.returncode, p.stdout, p.stderr


def run_git(cwd, *args):
    return subprocess.run(["git", "-C", cwd, *args], capture_output=True, text=True,
                          encoding="utf-8", errors="replace", timeout=30)


def check(name, cond):
    results.append((name, cond))
    print(f"  {'PASS' if cond else 'FAIL'}  {name}")


def _probe_rel(glob):
    """Smallest path that satisfies fnmatch for a law's glob (basename or path-scoped)."""
    star = glob.find("*")
    prefix = glob if star < 0 else glob[:star]
    if "/" in prefix:
        return prefix.rsplit("/", 1)[0] + "/probe.tsx"
    return "probe.tsx"


# ---- live manifest (P3: it must parse AND carry non-empty law_patterns) --------------------
try:
    live = json.load(open(LIVE_MF, encoding="utf-8"))
except Exception as e:
    live = {}
    print(f"  (could not parse live manifest {LIVE_MF}: {e})")
check("live project.json parses & law_patterns non-empty (P1/P3)",
      isinstance(live.get("law_patterns"), list) and len(live.get("law_patterns", [])) > 0)

tmp = tempfile.mkdtemp()
tmpg = tempfile.mkdtemp()   # git fixture for P2 Tier A
tmp2 = tempfile.mkdtemp()   # broken-manifest fixture for P3
tmp3 = tempfile.mkdtemp()   # memory-home-guard fixture for P8
try:
    # ---- fixture: fake project, stale brief vs a newer live-shaped resume marker -----------
    os.makedirs(os.path.join(tmp, ".claude", "context"))
    os.makedirs(os.path.join(tmp, ".claude", "session"))
    if not os.path.isfile(LIVE_MF):
        raise SystemExit("live manifest missing — cannot run fitness self-test")
    shutil.copy(LIVE_MF, os.path.join(tmp, ".claude", "project.json"))
    # resume_marker in the live manifest points at ops/postgres/migrations/V*__*.sql
    mig = os.path.join(tmp, "ops", "postgres", "migrations"); os.makedirs(mig)
    open(os.path.join(mig, "V83__x.sql"), "w", encoding="utf-8").write("-- ok")
    open(os.path.join(tmp, ".claude", "context", "opus-brief.md"), "w", encoding="utf-8").write(
        "## Current State\n**Last migration:** V81 (x).\n## Last Session\n")
    open(os.path.join(tmp, ".claude", "session", "token-log.md"), "w", encoding="utf-8").write(
        "[2026-06-01] run tokens=~1000\n")

    rc, so, se = run("session-start.py", env_root=tmp)
    check("session-start injects resume state", "RESUME STATE" in so)
    check("session-start detects STALE (brief V81 vs repo V83)", "STALE RESUME WARNING" in so)

    rc, so, se = run("pre-edit-gate.py", env_root=tmp,
                     stdin=json.dumps({"tool_input": {"file_path": "ops/postgres/migrations/V90__a.sql"}}))
    check("pre-edit-gate flags migration as Class-M+IRREVERSIBLE", "IRREVERSIBLE" in so and rc == 0)
    rc, so, se = run("pre-edit-gate.py", stdin=json.dumps({"tool_input": {"file_path": "x/App.jsx"}}))
    check("pre-edit-gate silent on ordinary file", so.strip() == "" and rc == 0)

    # ---- P1 fitness: every live law_pattern's sample_violation is a true positive + is blocked
    for law in live.get("law_patterns", []):
        sv = law.get("sample_violation")
        if not sv:
            continue
        lid = law.get("id", "?")
        self_match = bool(re.search(law["forbid"], sv, re.I))
        rel = _probe_rel(law.get("glob", "*"))
        pf = os.path.join(tmp, *rel.split("/"))
        os.makedirs(os.path.dirname(pf), exist_ok=True)
        open(pf, "w", encoding="utf-8").write(sv + "\n")
        rc, so, se = run("post-edit-laws.py", env_root=tmp,
                         stdin=json.dumps({"tool_input": {"file_path": pf}}))
        check(f"law '{lid}': sample_violation self-matches forbid AND is blocked (exit 2)",
              self_match and rc == 2)

    rc, so, se = run("post-edit-laws.py", stdin=json.dumps({"tool_input": {"file_path": "/nonexistent.sql"}}))
    check("post-edit-laws safe on missing file (exit 0)", rc == 0)

    # ---- P8: post-edit bloat BLOCK (exit 2), self-adjusting to the live limit ---------------
    _hy = (live.get("hygiene") or {})
    _lim = int((_hy.get("bloat_limits") or {}).get("ts", 400))
    _ceil = int(_lim * float(_hy.get("hard_factor", 2)))
    big = os.path.join(tmp, "bloat.ts")
    open(big, "w", encoding="utf-8").write("\n".join(f"const a{i}=1;" for i in range(_ceil + 20)))
    rc, so, se = run("post-edit-laws.py", env_root=tmp, stdin=json.dumps({"tool_input": {"file_path": big}}))
    check("post-edit-laws BLOAT BLOCK over hard ceiling (exit 2, P8)", rc == 2 and "BLOAT BLOCK" in se)

    # ---- P9: memory-hygiene write-time ceiling on agent-memory/**/*.md (self-adjusting) -----
    _mg = (live.get("memory_guard") or {})
    _wkb = float(_mg.get("file_warn_kb", 6)); _bkb = float(_mg.get("file_block_kb", 12))
    mem_dir = os.path.join(tmp, ".claude", "agent-memory", "agentX"); os.makedirs(mem_dir, exist_ok=True)
    mem_block = os.path.join(mem_dir, "oversized.md")  # single line, big bytes: trips size, not line-bloat
    open(mem_block, "w", encoding="utf-8").write("x" * int((_bkb + 2) * 1024))
    rc, so, se = run("post-edit-laws.py", env_root=tmp, stdin=json.dumps({"tool_input": {"file_path": mem_block}}))
    check("post-edit-laws MEMORY BLOCK over block ceiling (exit 2, P9)", rc == 2 and "MEMORY BLOCK" in se)
    mem_warn = os.path.join(mem_dir, "warnband.md")
    open(mem_warn, "w", encoding="utf-8").write("x" * int((_wkb + 1) * 1024))
    rc, so, se = run("post-edit-laws.py", env_root=tmp, stdin=json.dumps({"tool_input": {"file_path": mem_warn}}))
    check("post-edit-laws MEMORY WARN in warn band (exit 0 + stderr WARN, P9)", rc == 0 and "WARN" in se)

    # ---- P3: manifest PRESENT but unparseable -> stderr warning, still exit 0 ---------------
    os.makedirs(os.path.join(tmp2, ".claude"))
    open(os.path.join(tmp2, ".claude", "project.json"), "w", encoding="utf-8").write("{ broken json,,, ")
    probe2 = os.path.join(tmp2, "probe.tsx"); open(probe2, "w", encoding="utf-8").write("const ok = 1;\n")
    rc, so, se = run("post-edit-laws.py", env_root=tmp2, stdin=json.dumps({"tool_input": {"file_path": probe2}}))
    check("manifest parse-FAILURE emits stderr warning, non-fatal (P3)", "failed to parse" in se.lower() and rc == 0)

    # ---- P8: memory-home-guard relocate + prune + name-clash-keeps-both --------------------
    root_home = os.path.join(tmp3, ".claude", "agent-memory", "agentX"); os.makedirs(root_home)
    open(os.path.join(root_home, "foo.md"), "w", encoding="utf-8").write("ROOT VERSION")
    stray_agent = os.path.join(tmp3, "sub", ".claude", "agent-memory", "agentX"); os.makedirs(stray_agent)
    open(os.path.join(stray_agent, "foo.md"), "w", encoding="utf-8").write("STRAY VERSION (different)")
    open(os.path.join(stray_agent, "bar.md"), "w", encoding="utf-8").write("only in stray")
    rc, so, se = run("memory-home-guard.py", env_root=tmp3)
    check("memory-home-guard relocates stray file to root SSOT (P8)",
          os.path.exists(os.path.join(root_home, "bar.md")))
    check("memory-home-guard prunes the emptied stray tree (P8)",
          not os.path.exists(os.path.join(tmp3, "sub", ".claude")))
    check("memory-home-guard name-clash keeps BOTH copies (P8)",
          os.path.exists(os.path.join(root_home, "foo.md")) and
          os.path.exists(os.path.join(root_home, "foo.relocated.md")))

    # ---- P9: memory-home-guard hygiene pass (relocation twin + dir-quota breach) ------------
    twin_dir = os.path.join(tmp3, ".claude", "agent-memory", "agentQ"); os.makedirs(twin_dir)
    open(os.path.join(twin_dir, "topic.relocated.md"), "w", encoding="utf-8").write("unreconciled twin")
    bloat_dir = os.path.join(tmp3, ".claude", "agent-memory", "agentBloat"); os.makedirs(bloat_dir)
    _dmf = int((live.get("memory_guard") or {}).get("dir_max_files", 40))
    for i in range(_dmf + 2):
        open(os.path.join(bloat_dir, f"m{i}.md"), "w", encoding="utf-8").write("x")
    rc, so, se = run("memory-home-guard.py", env_root=tmp3)
    check("memory-home-guard WARNs on unreconciled .relocated twin (P9)",
          "relocation twin" in so.lower() and "reconcile" in so.lower())
    check("memory-home-guard WARNs on dir-quota breach naming the dir (P9)",
          "agentBloat" in so and "curation" in so.lower())

    # ---- Part C / P2 Tier A: phantom working-tree wipe in a tmp git repo -------------------
    modules = live.get("modules", [])
    if modules:
        mod0 = modules[0]  # generic — read from manifest, never a literal
        os.makedirs(os.path.join(tmpg, ".claude", "context"))
        shutil.copy(LIVE_MF, os.path.join(tmpg, ".claude", "project.json"))
        open(os.path.join(tmpg, ".claude", "context", "opus-brief.md"), "w", encoding="utf-8").write(
            "## Current State\nresume\n## Last Session\n")
        run_git(tmpg, "init"); run_git(tmpg, "config", "user.email", "t@t.t"); run_git(tmpg, "config", "user.name", "t")
        moddir = os.path.join(tmpg, *mod0.split("/")); os.makedirs(moddir)
        for i in range(30):
            open(os.path.join(moddir, f"f{i}.ts"), "w", encoding="utf-8").write(f"// {i}\n")
        run_git(tmpg, "add", "-A"); run_git(tmpg, "commit", "-m", "seed")
        for i in range(30):  # phantom wipe: os.remove, NOT git rm (uncommitted deletion)
            os.remove(os.path.join(moddir, f"f{i}.ts"))
        rc, so, se = run("stop-check.py", env_root=tmpg)
        check("stop-check WARNs on working-tree loss (P2 Tier A)", "WORKING-TREE LOSS" in se)
        rc, so, se = run("session-start.py", env_root=tmpg)
        check("session-start surfaces loss + EMPTIED on resume (P2 Tier A)",
              "WORKING-TREE LOSS" in so and "EMPTIED" in so)
        # negative: restore, delete a SINGLE file -> must be silent
        run_git(tmpg, "checkout", "--", ".")
        os.remove(os.path.join(moddir, "f0.ts"))
        rc, so, se = run("stop-check.py", env_root=tmpg)
        check("stop-check SILENT on a single-file delete (P2 negative)", "WORKING-TREE LOSS" not in se)
    else:
        check("P2 Tier A fixture (modules[] present in manifest)", False)

    # ---- Part C / P2 Tier B: pre-bash-guard (env_root=tmpg so any snapshot stays off real repo)
    rc, so, se = run("pre-bash-guard.py", env_root=tmpg,
                     stdin=json.dumps({"tool_input": {"command": "git reset --hard HEAD~5"}}))
    check("pre-bash-guard flags destructive command (P2 Tier B)", "DESTRUCTIVE" in so and rc == 0)
    rc, so, se = run("pre-bash-guard.py", env_root=tmpg,
                     stdin=json.dumps({"tool_input": {"command": "ls -la"}}))
    check("pre-bash-guard SILENT on ordinary command (P2 Tier B)", so.strip() == "" and rc == 0)

    # ---- P10: subagent-ledger (requested vs verified model + per-run tokens) ---------------
    import time as _t
    tmp4 = tempfile.mkdtemp(prefix="selftest-ledger-")
    try:
        os.makedirs(os.path.join(tmp4, ".claude", "session"), exist_ok=True)
        _led = os.path.join(tmp4, ".claude", "session", "token-log.md")
        _today = _t.strftime("%Y-%m-%d")
        open(_led, "w", encoding="utf-8").write(
            f"[{_today}] LAUNCH agent=x model-requested=sonnet task=fixture\n")
        _tr = os.path.join(tmp4, "agent-test1.jsonl")
        open(_tr, "w", encoding="utf-8").write(
            '{"message":{"model":"claude-sonnet-5","usage":{"output_tokens":10}}}\n'
            '{"message":{"model":"claude-sonnet-5","usage":{"output_tokens":7}}}\n')
        rc, so, se = run("subagent-ledger.py", env_root=tmp4,
                         stdin=json.dumps({"transcript_path": _tr}))
        _log = open(_led, encoding="utf-8").read()
        check("subagent-ledger records actual model + tokens (P10)",
              rc == 0 and "run=agent-test1" in _log and "model-actual=claude-sonnet-5" in _log
              and "out-tokens=17" in _log)
        rc, so, se = run("subagent-ledger.py", env_root=tmp4,
                         stdin=json.dumps({"transcript_path": _tr}))
        _log = open(_led, encoding="utf-8").read()
        check("subagent-ledger dedupes on second stop (P10)", _log.count("run=agent-test1") == 1)
        _tr2 = os.path.join(tmp4, "agent-test2.jsonl")
        open(_tr2, "w", encoding="utf-8").write(
            '{"message":{"model":"claude-opus-4-8","usage":{"output_tokens":5}}}\n')
        rc, so, se = run("subagent-ledger.py", env_root=tmp4,
                         stdin=json.dumps({"transcript_path": _tr2}))
        _log = open(_led, encoding="utf-8").read()
        check("subagent-ledger flags unrequested model family (P10)",
              "run=agent-test2" in _log and "MODEL-VERIFY" in _log)
    finally:
        shutil.rmtree(tmp4, ignore_errors=True)

    # ---- existing close-out disciplines still healthy --------------------------------------
    rc, so, se = run("stop-check.py", env_root=tmp)
    check("stop-check runs without crashing (WARN posture)", rc == 0)
    rc, so, se = run("session-end-tokenlog.py", env_root=tmp)
    log = open(os.path.join(tmp, ".claude", "session", "token-log.md"), encoding="utf-8").read()
    check("session-end appends a measured rollup", "SESSION ROLLUP" in log)
finally:
    for d in (tmp, tmpg, tmp2, tmp3):
        shutil.rmtree(d, ignore_errors=True)

failed = [n for n, ok in results if not ok]
print(f"\n{len(results)-len(failed)}/{len(results)} passed." + (f" FAILED: {failed}" if failed else " All hooks healthy."))
sys.exit(1 if failed else 0)
