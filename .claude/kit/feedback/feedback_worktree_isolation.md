---
name: worktree-isolation-policy
description: "Serialize on the current branch = cheap default; isolation:'worktree' ONLY for genuine unavoidable parallel repo-editing — and never let concurrent work share one git index. Merges: parallel-isolated-worktrees + worktrees-only-when-truly-parallel."
metadata:
  type: feedback
---
**Rule:** **serialized work directly on the current branch is the cheap default.** Reach for `isolation:"worktree"` ONLY when 2+ agents must edit the repo *genuinely in parallel*. And when work IS concurrent, never let lanes share one working tree + one git index.

**Why (two incidents, opposite over-corrections):**
- *2026-07-11 entanglement:* 3 parallel lanes on ONE shared tree; the lead's own commit swept another lane's STAGED files into the wrong commit — muddled history, work-protection hazard (a stray `git add -A`/reset could drop another lane's uncommitted work).
- *2026-07-11 over-correction:* "always isolate" then burned real time — worktrees cut from stale local `main` (wrong-base hazard), no `node_modules` for gates, merge-back ceremony. Owner: "if it's not necessary, let's avoid these worktrees and branches — we're losing time."

The real lesson was never "always isolate" — it was "don't entangle *concurrent* commits." Serializing (or doing it myself) achieves that with zero overhead.

**How to apply:**
1. Default: work serially on the current branch — myself or one agent at a time; no worktree, no side-branch.
2. TRUE parallelism deliberately chosen → isolate, and brief each agent to base its worktree off the ACTIVE feature branch (not local main), knowing fresh worktrees lack `node_modules` for gates.
3. If lanes MUST share a tree: nobody (lead included) commits until all are done; every stage/commit by explicit pathspec, never `git add -A`; each agent commits ONLY its own files.
   - **LEAD TRIPWIRE (recurred 2026-07-22, BY the lead):** `git add <file> && git commit` is NOT pathspec-safe — `git commit` without `-- <paths>` sweeps EVERYTHING staged, including an in-flight agent's staged files (a P0 fix landed under a docs commit message this way). While ANY build agent is in flight, the lead commits ONLY as `git commit -- <explicit paths>` (or waits). "My add was scoped" is the trap — the COMMIT is what must be scoped. A brief's freshness stamp also goes stale the moment the lead launches MORE agents/commits after it — the collision map is a rolling duty, not a launch-time note.

Related: [[agent-management-discipline]], [[built-but-buried-audit]], the work-protection doctrine.
