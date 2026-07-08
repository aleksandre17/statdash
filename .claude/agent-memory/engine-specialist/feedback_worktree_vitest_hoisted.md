---
name: worktree-vitest-hoisted
description: Pointer — worktree/vitest Windows pitfalls consolidated under plugins-specialist memory; engine-specific residual noted here
metadata:
  type: feedback
---

In an isolated git worktree, vitest 4.x throws `#module-evaluator` under pnpm's symlinked
install; `node-linker=hoisted` fixes it but duplicates React (breaks every rendering suite) —
must revert `.npmrc` before committing, and verify rendering suites in the main checkout instead.

Full write-up and general Windows/worktree pitfalls now live in plugins-specialist's memory:
see `../../kit/feedback/feedback_windows_worktree_pitfalls.md`. Related:
[[shared-tree-concurrency]].
