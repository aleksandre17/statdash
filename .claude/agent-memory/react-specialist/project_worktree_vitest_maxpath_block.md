---
name: worktree-vitest-maxpath-block
description: vitest CLI cannot start in .claude/worktrees/agent-<id>/platform on Windows (Node ESM >260-char MAX_PATH); independently re-confirmed 2026-07-03 from react-specialist, same root cause as the senior-frontend-developer writeup
metadata:
  type: project
---

Independently re-confirmed 2026-07-03 in `.claude/worktrees/agent-a6d0f2c78946c5854/platform` while
gating AR-37 P0 (locale binding) — same root cause, same fix, already fully written up in
`../senior-frontend-developer/project_windows_longpath_vitest_worktree_block.md` (the canonical
version: root cause, the "it IS workable via node_modules junctions" bootstrap, and the
hand-replicate-in-a-.mjs fallback). See also `../../kit/feedback/feedback_windows_worktree_pitfalls.md`.

Confirmed here against an UNMODIFIED pre-existing test (`localeString-render-guard.fitness.test.tsx`)
— identical crash, ruling out any code-caused explanation for that task too.
