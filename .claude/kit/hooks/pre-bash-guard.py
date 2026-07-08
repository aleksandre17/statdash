#!/usr/bin/env python3
"""PreToolUse (Bash) — Tier B of the working-tree loss guard. Non-blocking. Detects whole-tree
CATASTROPHIC shell commands (recursive-force rm, git reset --hard, checkout/restore/clean of '.',
worktree remove/prune) whose damage is NOT recoverable from HEAD (uncommitted work is gone), and
injects a non-blocking reminder to confirm blast radius / commit-or-stash first.

Matches whole-tree forms ONLY — never plain `rm <file>` or `git checkout <branch>`. Patterns come
from the manifest (worktree_guard.destructive_bash) when present, else a built-in generic default.
git/rm verbs are generic tooling, not domain literals. Always exits 0 (Tier B never blocks).

Optional hardening: `git stash create` is side-effect-free (writes only a dangling commit object,
never touches worktree/index/refs — the ONE write a hook may make). When it yields a SHA we log it
and name it in the reminder, giving a concrete recovery point BEFORE the destructive command runs.
Any doubt/failure -> reminder-only.
"""
import sys, json, re, os, subprocess, datetime

try:
    sys.stdout.reconfigure(encoding="utf-8")
except (AttributeError, ValueError):
    pass
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _manifest import load

# Generic default: whole-tree catastrophic forms only. Kept in sync with project.json
# worktree_guard.destructive_bash (manifest wins when present).
DEFAULT_DESTRUCTIVE = [
    r"\brm\b[^|;&\n]*\s-[a-zA-Z]*r[a-zA-Z]*f",
    r"\brm\b[^|;&\n]*\s-[a-zA-Z]*f[a-zA-Z]*r",
    r"\bgit\s+reset\s+--hard\b",
    r"\bgit\s+checkout\s+(--\s+)?\.(\s|$)",
    r"\bgit\s+clean\s+-[a-zA-Z]*[dfx]",
    r"\bgit\s+worktree\s+(remove|prune)\b",
    r"\bgit\s+restore\s+(--[a-z]+\s+)*(--\s+)?\.(\s|$)",
]


def _try_snapshot(root):
    """Side-effect-free `git stash create`: writes a dangling commit only. Returns a short SHA
    (recovery point) or None. Never raises. Logs the SHA so it survives past this turn."""
    try:
        r = subprocess.run(
            ["git", "-C", root, "stash", "create"],
            capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=10,
        )
        sha = (r.stdout or "").strip()
        if not sha:
            return None
        logp = os.path.join(root, ".claude", "session", "worktree-snapshots.log")
        os.makedirs(os.path.dirname(logp), exist_ok=True)
        ts = datetime.datetime.now().isoformat(timespec="seconds")
        with open(logp, "a", encoding="utf-8") as f:
            f.write(f"[{ts}] pre-bash-guard stash-create snapshot {sha}\n")
        return sha[:12]
    except Exception:
        return None


def main():
    try:
        data = json.load(sys.stdin)
    except Exception:
        sys.exit(0)
    cmd = (data.get("tool_input") or {}).get("command", "")
    if not cmd:
        sys.exit(0)

    mf = load()
    patterns = (mf.get("worktree_guard", {}) or {}).get("destructive_bash") or DEFAULT_DESTRUCTIVE
    hit = False
    for pat in patterns:
        try:
            if re.search(pat, cmd):
                hit = True
                break
        except re.error:
            continue
    if not hit:
        sys.exit(0)

    root = os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd()
    sha = _try_snapshot(root)
    msg = (
        "DESTRUCTIVE whole-tree command detected. Uncommitted work is NOT in HEAD and cannot be "
        "restored after this runs. Confirm blast radius; commit/stash first if unsure."
    )
    if sha:
        msg += (
            f" A side-effect-free snapshot was taken: recover with `git stash apply {sha}` "
            f"(logged in .claude/session/worktree-snapshots.log)."
        )
    print(json.dumps({"hookSpecificOutput": {
        "hookEventName": "PreToolUse", "additionalContext": msg}}))
    sys.exit(0)


if __name__ == "__main__":
    try:
        main()
    except Exception:
        sys.exit(0)
