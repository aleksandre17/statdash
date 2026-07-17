#!/usr/bin/env python3
"""memory-home-guard.py — enforce the SINGLE memory home (SSOT) structurally, outside the model.

WHY THIS HOOK EXISTS (the real mechanism, evidence-based):
  The native memory tool (`memory: project` in agent frontmatter) resolves its store
  RELATIVE TO THE AGENT'S CURRENT WORKING DIRECTORY. It does NOT read $CLAUDE_PROJECT_DIR
  (that env var only steers the hooks below), and it does NOT walk up to the nearest
  ancestor `.claude`. Proof: `platform/.claude/agent-memory` was created by a sub-agent
  while the root `.claude` already existed as an ancestor — an ancestor-walk could never
  create a home strictly BELOW an existing `.claude`; only cwd-direct creation explains it.
  A specialist that operates in packages/core therefore writes packages/core/.claude/...,
  a specialist in packages/styles writes packages/styles/.claude/..., etc.

  Because the tool is closed and cwd-relative, we CANNOT prevent a stray home from being
  *created*. The robust structural fix is to make strays NON-PERSISTENT and NON-DIVERGENT:
  this hook runs on SessionStart + SubagentStop + Stop (outside the model, every boundary),
  idempotently relocating any non-root `.claude/agent-memory` into the root SSOT and deleting
  the emptied stray. doctor.py's "single memory home" check is the CI backstop. Net effect:
  a second home can appear for at most one agent turn, then self-heals — divergence is impossible.

Read/relocate only; never edits source. Always exits 0 (a backstop must never block a turn).

HYGIENE PASS (memory_guard): piggybacked on the same boundary visit, a stat-level-only sweep of the
canonical home (no content reads — milliseconds over ~hundreds of files). WARN-only, emits nothing
when clean: unreconciled `*.relocated.md` twins (reconcile now), agent dirs over dir_max_files /
dir_max_kb (curation due — event-driven, not calendar), and any file over file_block_kb that slipped
in outside Write/Edit (e.g. a bash append). Complements the write-time ceiling in post-edit-laws.py.
"""
import os, sys, shutil

try:
    sys.stdout.reconfigure(encoding="utf-8")
except (AttributeError, ValueError):
    pass
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _manifest import load

# ROOT resolution (hardened 2026-07-15): NEVER bare cwd. A manual run from inside `.claude/`
# once computed CANON = `.claude/.claude/agent-memory` and "restored" the ENTIRE memory tree
# into a phantom nested home. The hook file itself lives at <root>/.claude/kit/hooks/ — that
# anchor is always true; env var wins when set, cwd is only a last-resort sanity-checked guess.
_SELF_ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".."))
ROOT = os.environ.get("CLAUDE_PROJECT_DIR") or (
    _SELF_ROOT if os.path.isdir(os.path.join(_SELF_ROOT, ".claude")) else os.getcwd()
)
CANON = os.path.normpath(os.path.join(ROOT, ".claude", "agent-memory"))


def _candidate_homes(root):
    """O1: strays are created cwd-relative, and specialists run at declared MODULE roots. So the
    real candidate set is tiny and known — root + each `modules[]` entry's `.claude/agent-memory`.
    Direct stat() on that set is sub-millisecond (vs os.walk over ~14k files ~= seconds)."""
    homes = []
    for m in load(root).get("modules", []) or []:
        homes.append(os.path.join(root, *m.replace("\\", "/").split("/"), ".claude", "agent-memory"))
    return homes


def _capped_walk(root, maxdepth=5):
    """Backstop for UNDECLARED cwds (e.g. a non-module parent dir like `platform/`). Depth-capped
    and heavy-tree-pruned so it stays sub-second even on a large repo — never a full 14k-file walk."""
    base = root.rstrip(os.sep).count(os.sep)
    for dp, dns, _ in os.walk(root):
        dns[:] = [d for d in dns if d not in ("node_modules", ".git", "dist", ".idea", "__pycache__")]
        if dp.count(os.sep) - base >= maxdepth:
            dns[:] = []
        if os.path.basename(dp) == "agent-memory" and os.path.basename(os.path.dirname(dp)) == ".claude":
            yield dp


def find_strays(root):
    """Union of the fast manifest-driven candidates and the depth-capped backstop walk, deduped.
    Preserves exact relocate+prune+name-clash behavior; only the DISCOVERY got cheaper."""
    strays, seen = [], set()

    def _consider(path):
        cn = os.path.normpath(path)
        if cn == CANON or cn in seen or not os.path.isdir(cn):
            return
        seen.add(cn)
        strays.append(cn)

    for h in _candidate_homes(root):
        _consider(h)
    for d in _capped_walk(root):
        _consider(d)
    return strays


def merge_index(stray_idx, root_idx):
    """Append any stray MEMORY.md bullet whose text is not already present in the root index,
    under an auto-merge heading. Guarantees no lost pointer / no dead link (targets are moved)."""
    if not os.path.exists(stray_idx):
        return
    stray_lines = [l for l in open(stray_idx, encoding="utf-8").read().splitlines() if l.strip().startswith("- ")]
    existing = open(root_idx, encoding="utf-8").read() if os.path.exists(root_idx) else "# Memory Index\n"
    add = [l for l in stray_lines if l.strip() not in existing]
    if not add:
        return
    if not existing.endswith("\n"):
        existing += "\n"
    block = "\n## Auto-relocated (memory-home-guard — reconcile into a topic section)\n" + "\n".join(add) + "\n"
    open(root_idx, "w", encoding="utf-8").write(existing + block)


def relocate(stray):
    """stray = .../.claude/agent-memory ; merge each <agent>/ into root, then delete stray + empty .claude."""
    moved = []
    for agent in sorted(os.listdir(stray)):
        s_agent = os.path.join(stray, agent)
        if not os.path.isdir(s_agent):
            continue
        r_agent = os.path.join(CANON, agent)
        os.makedirs(r_agent, exist_ok=True)
        for fn in sorted(os.listdir(s_agent)):
            s_file, r_file = os.path.join(s_agent, fn), os.path.join(r_agent, fn)
            if fn == "MEMORY.md":
                merge_index(s_file, r_file)
                continue
            if not os.path.exists(r_file):
                shutil.move(s_file, r_file)
                moved.append(f"{agent}/{fn}")
            else:
                s_txt = open(s_file, encoding="utf-8", errors="ignore").read()
                r_txt = open(r_file, encoding="utf-8", errors="ignore").read()
                if s_txt.strip() == r_txt.strip():
                    continue  # identical — root already holds it
                # different content, same name — keep both so nothing is lost; human/agent reconciles
                alt = os.path.join(r_agent, fn[:-3] + ".relocated.md")
                shutil.move(s_file, alt)
                moved.append(f"{agent}/{fn} -> {os.path.basename(alt)} (name clash, both kept)")
    # prune the emptied stray tree
    shutil.rmtree(stray, ignore_errors=True)
    parent = os.path.dirname(stray)  # the nested .claude/
    if os.path.isdir(parent) and not os.listdir(parent):
        shutil.rmtree(parent, ignore_errors=True)
    return moved


def hygiene_report(canon, mf):
    """Stat-level-only hygiene sweep of the canonical home (NO content reads). Returns a list of
    WARN lines (empty when clean). Cheap by construction: one scandir per agent dir + st_size only."""
    mg = (mf.get("memory_guard", {}) or {})
    dir_max_files = int(mg.get("dir_max_files", 40))
    dir_max_kb = float(mg.get("dir_max_kb", 150))
    block_kb = float(mg.get("file_block_kb", 12))
    warnings, relocated = [], []
    try:
        agent_dirs = [e for e in os.scandir(canon) if e.is_dir()]
    except OSError:
        return warnings
    for ad in agent_dirs:
        count, total_kb = 0, 0.0
        try:
            entries = [e for e in os.scandir(ad.path) if e.is_file()]
        except OSError:
            continue
        for e in entries:
            count += 1
            try:
                kb = e.stat().st_size / 1024.0
            except OSError:
                kb = 0.0
            total_kb += kb
            # relpath (the costly call) is deferred to the rare warn cases only — hot loop stays stat-only
            if e.name.endswith(".relocated.md"):
                relocated.append(os.path.relpath(e.path, ROOT).replace("\\", "/"))
            if kb > block_kb:
                rel = os.path.relpath(e.path, ROOT).replace("\\", "/")
                warnings.append(
                    f"OVERSIZE: {rel} is {kb:.1f}KB > block ceiling {block_kb:.0f}KB — slipped in "
                    f"outside Write/Edit (e.g. a bash append); distill or split.")
        if count > dir_max_files or total_kb > dir_max_kb:
            breach = []
            if count > dir_max_files:
                breach.append(f"{count} files > {dir_max_files}")
            if total_kb > dir_max_kb:
                breach.append(f"{total_kb:.0f}KB > {dir_max_kb:.0f}KB")
            warnings.append(
                f"CURATION DUE: {ad.name}/ ({'; '.join(breach)}) — curation is event-driven, not calendar.")
    if relocated:
        warnings.append(
            "UNRECONCILED RELOCATION TWIN(S): " + ", ".join(sorted(relocated)) +
            " — reconcile into the canonical file now.")
    return warnings


def main():
    if not os.path.isdir(CANON):
        os.makedirs(CANON, exist_ok=True)
    strays = find_strays(ROOT)
    if strays:
        print("=== memory-home-guard: relocating stray memory home(s) into root SSOT ===")
        for stray in strays:
            rel = os.path.relpath(stray, ROOT)
            moved = relocate(stray)
            print(f"  relocated {rel} -> .claude/agent-memory ({len(moved)} file(s))")
            for m in moved:
                print(f"    - {m}")
        print("  SSOT restored. If any '.relocated.md' or 'Auto-relocated' index block was written, reconcile it.")
    # hygiene pass — runs every boundary regardless of strays; silent when clean
    try:
        warnings = hygiene_report(CANON, load(ROOT))
    except Exception:
        warnings = []
    if warnings:
        print("=== memory-home-guard: hygiene (WARN — memory is a distillate, not a log) ===")
        for w in warnings:
            print("  " + w)
    sys.exit(0)


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"[memory-home-guard] non-fatal: {e}")
        sys.exit(0)
