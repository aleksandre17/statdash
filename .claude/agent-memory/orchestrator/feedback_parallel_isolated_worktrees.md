---
name: parallel-isolated-worktrees
description: Parallel agents on ONE shared working tree/git index entangle commits — use isolation:"worktree" for concurrent lanes, or serialize commits
metadata:
  type: feedback
---
**Rule:** when launching MULTIPLE agents concurrently that all edit the repo, give each an **isolated git worktree** (`Agent(isolation: "worktree")`) OR serialize their commits — NEVER run them on one shared working tree + one shared git index.

**Why (incident, 2026-07-11):** I launched 3 parallel build lanes (Summary-Card Inspector, Data-Flow Spine, chrome/nav) on the SAME working tree. While they ran, I committed a doctrine change (`2915c7d "doctrine(agents)…"`) — and `git add` + commit **swept another lane's STAGED files into my commit**, so Move 1's deliverable landed under the wrong message with entangled boundaries. The agent correctly did NOT rewrite history (parallel agents still active + pushed — an amend/rebase would clobber their work). Content survived, but the history is muddled and it's a work-protection hazard (one agent's `git add -A` or a stray reset could drop another's uncommitted work — cf. the earlier phantom-worktree-wipe).

**How to apply:** (1) for concurrent lanes, launch with `isolation: "worktree"` so each has its own tree + index (auto-cleaned if unchanged) — no cross-lane `git add`/commit collision. (2) If they MUST share a tree, do NOT commit from the lead (or any lane) until all are done + explicitly staged by pathspec; stage/commit each lane by its own explicit file list, never `git add -A`. (3) Brief parallel agents to commit ONLY their own files by pathspec (they did — that's why content survived). Work-protection is the hard floor; entangling parallel work under one index is my failure mode to prevent. Related: [[built-but-buried-audit]] (observe), the work-protection doctrine.
