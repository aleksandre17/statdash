---
name: worktree-base-hazard
description: Agent worktrees may be cut at a STALE merge-base; verify against the real feature-branch tip and distinguish committed vs uncommitted-WIP ground truth before building
metadata:
  type: feedback
---

Before building in an isolated agent worktree, VERIFY its base is the real ground truth — do not trust the brief's "current state" describes a commit you actually have.

**Why:** On the ADR-038 task (2026-07-11) my worktree was cut at `27ff8cb` (the merge-base = stale local `main`), while the actual ground truth was `feat/ar49-m0-metric-first-authoring` @ 6f7e913 — many AR-49/AR-50/ADR-038 commits ahead. Worse, the specific artifacts the brief described (nodeProjection.ts, the "kpi-card object activation") were UNCOMMITTED WIP living only in the MAIN checkout's dirty working tree (and other agents' worktrees), not in ANY commit. I initially audited files by reading the MAIN checkout path (`...\national-accounts\platform\...`) — a DIFFERENT working tree than my worktree — and nearly built on a false picture.

**How to apply:** At task start in a worktree: (1) `git rev-parse --show-toplevel` to confirm you're in the worktree, not the main checkout; (2) `git log --oneline -1` + compare vs the feature-branch tip and `git merge-base HEAD <branch>`; (3) if stale with no local commits, `git reset --hard <feature-tip>` to move your branch ref onto the real base (can't `checkout` a branch already checked out elsewhere — reset the ref); (4) check whether brief-named files are committed (`git cat-file -e <ref>:<path>`) vs uncommitted WIP — never recreate/complete another agent's uncommitted WIP. Read from YOUR worktree path before editing. See [[project-adr038-trunk-state]].
</content>
