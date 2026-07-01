---
name: shared-tree-concurrency
description: The working tree is shared with concurrent specialist agents; do NOT use `git stash -u` to A/B test — it hides their in-flight edits and corrupts your diagnosis
metadata:
  type: feedback
---

When the orchestrator dispatches a batch of audit findings, OTHER specialist agents edit the SAME working tree concurrently. Files I never touched appeared mid-session (e.g. `setupCanvasRegistry.ts` + `perspective-bar/meta.ts` getting `{ka,en}` label-widening — a different agent's LOW-4 task).

**Why it matters:** I used `git stash push -u` to A/B a typecheck error against "clean HEAD". The stash ALSO hid the concurrent agent's uncommitted edits, so "clean HEAD" looked green and falsely implicated MY changes. The real cause was their label-widening (`{ka,en}` assigned to `PerspectiveOption.label: string`) in a file outside my scope.

**How to apply:**
- Before blaming your own changes for a typecheck/test failure, run `git status --short` and `git diff <file>` on the failing file. If it's a file you never edited, it's a concurrent agent's edit — report it as out-of-scope, do NOT fix it (you may collide).
- To isolate whether an error is yours: typecheck the dependency graph that EXCLUDES the suspect file (e.g. `pnpm typecheck` = geostat app, which does NOT compile apps/panel). Prefer that over `git stash`.
- Avoid `git stash -u` in this tree entirely. If you must compare against HEAD, use `git show HEAD:path` for the single file, not a tree-wide stash.
- Stay strictly in your assigned task scope (engine/data/react seam). LOW-4 single-locale-label / `PerspectiveOption.label` widening was NOT mine even though it's an engine type — the orchestrator scoped me to specific tasks.
