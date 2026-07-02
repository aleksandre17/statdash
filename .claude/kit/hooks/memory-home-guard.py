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
"""
import os, sys, shutil

try:
    sys.stdout.reconfigure(encoding="utf-8")
except (AttributeError, ValueError):
    pass

ROOT = os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd()
CANON = os.path.normpath(os.path.join(ROOT, ".claude", "agent-memory"))


def find_strays(root):
    strays = []
    for dp, dns, _ in os.walk(root):
        dns[:] = [d for d in dns if d not in ("node_modules", ".git")]
        if os.path.basename(dp) == "agent-memory" and os.path.basename(os.path.dirname(dp)) == ".claude":
            if os.path.normpath(dp) != CANON:
                strays.append(dp)
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


def main():
    if not os.path.isdir(CANON):
        os.makedirs(CANON, exist_ok=True)
    strays = find_strays(ROOT)
    if not strays:
        sys.exit(0)
    print("=== memory-home-guard: relocating stray memory home(s) into root SSOT ===")
    for stray in strays:
        rel = os.path.relpath(stray, ROOT)
        moved = relocate(stray)
        print(f"  relocated {rel} -> .claude/agent-memory ({len(moved)} file(s))")
        for m in moved:
            print(f"    - {m}")
    print("  SSOT restored. If any '.relocated.md' or 'Auto-relocated' index block was written, reconcile it.")
    sys.exit(0)


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"[memory-home-guard] non-fatal: {e}")
        sys.exit(0)
