#!/usr/bin/env python3
"""Shared SSOT: working-tree loss detection (P2 Tier A). ONE algorithm, imported by both
stop-check.py and session-start.py — no duplication (DRY). Read-only git only (diff/ls-tree);
NEVER mutates the worktree, index, or refs. Degrades to silent (returns None) on no-repo,
git-absent, or any exception — a safety net must never crash a turn.

Thresholds and module roots come from the manifest (worktree_guard + modules); the kit holds
ZERO domain literals — git verbs are generic tooling defaults (allowed).

OUT OF SCOPE (YAGNI): the committed-wipe case (HEAD vs HEAD~1 — a deletion already committed)
is intentionally NOT detected here; this guard targets the uncommitted phantom-worktree wipe,
where HEAD still holds every file and `restore` fully recovers. Do not add a HEAD~1 detector.
"""
import subprocess


def _git(root, *args):
    """Read-only git. Returns stdout, or None on any failure (git absent / not a repo / timeout)."""
    try:
        return subprocess.run(
            ["git", "-C", root, *args],
            capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=10,
        ).stdout
    except Exception:
        return None


def deletion_report(root, mf):
    """Return a WARN string if the working tree shows a bulk / module-emptying deletion vs HEAD,
    else None. Two tiers of alarm: (a) total deletions >= bulk_delete_threshold, or
    (b) any module root >= module_root_empty_ratio of its HEAD files gone."""
    g = mf.get("worktree_guard", {}) or {}
    threshold = g.get("bulk_delete_threshold", 25)
    ratio = g.get("module_root_empty_ratio", 0.9)
    modules = mf.get("modules", []) or []

    out = _git(root, "diff", "--name-status", "HEAD")
    if out is None:
        return None
    deleted = []
    for line in out.splitlines():
        if line.startswith("D"):
            parts = line.split("\t")
            if len(parts) >= 2:
                deleted.append(parts[-1].replace("\\", "/"))
    if not deleted:
        return None

    emptied = []  # (module_root, deleted_count, head_total)
    for m in modules:
        m = m.replace("\\", "/").rstrip("/")
        din = [f for f in deleted if f == m or f.startswith(m + "/")]
        if not din:
            continue
        tree = _git(root, "ls-tree", "-r", "--name-only", "HEAD", "--", m)
        if tree is None:
            continue
        total = len([ln for ln in tree.splitlines() if ln.strip()])
        if total and len(din) / total >= ratio:
            emptied.append((m, len(din), total))

    if len(deleted) < threshold and not emptied:
        return None

    lines = [
        f"WORKING-TREE LOSS: {len(deleted)} tracked file(s) deleted vs HEAD (alarm threshold {threshold})."
    ]
    for m, d, t in emptied:
        lines.append(f"  module root '{m}' EMPTIED — {d}/{t} tracked files gone.")
    lines.append("Content is still safe in HEAD — DO NOT commit this deletion.")
    if emptied:
        for m, _d, _t in emptied:
            lines.append(f"  recover: git -C . restore --source=HEAD --staged --worktree -- {m}")
    else:
        lines.append(
            "  review then restore: git -C . status --short  ->  "
            "git -C . restore --source=HEAD --staged --worktree -- <paths>"
        )
    lines.append(
        "If unintended: restore now, then investigate the phantom worktree/checkout "
        "(git worktree list; git reflog)."
    )
    return "\n".join(lines)
