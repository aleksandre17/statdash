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

**Shared-BRANCH-name + HEAD churn (AR-36 pivot commit, 2026-07-02):** concurrent agents also move refs on the shared `.git`. Mid-task, HEAD jumped from my `feat/ar36-pivot-regional` (which I'd ff-merged to P0 `ba52404`) back to `main`, and the branch ref itself was advanced to a concurrent GDP commit (`d7bc225`, whose parent was still my P0). Symptoms: `git branch --show-current` = `main`, `git rev-parse <mybranch>` = an unexpected commit, and P0 files showing as uncommitted vs HEAD.
- Diagnose with `git rev-parse HEAD` + `git rev-parse <branch>` + `git merge-base --is-ancestor <base> HEAD` BEFORE any commit — never assume you're still where you left off.
- To get back onto the branch carrying uncommitted work when a plain `git checkout` refuses (dirty tree, untracked overlaps): `git checkout -m <branch>` (3-way merges local changes onto target). It may leave a conflict on files the target ALSO changed (e.g. the P0 import line) — resolve by keeping your superset. An identical untracked file blocking the switch (P0 test on main) is safe to `rm` (the target restores it — verify identity with `diff <(git show <branch>:path) path`).
- **CRLF trap:** the Edit/Write tools (or the `-m` merge) can flip a file LF→CRLF on Windows, making `git diff --cached --stat` show the WHOLE file changed. Verify with `git diff --cached --ignore-cr-at-eol --stat`; if only your real lines remain, normalize with `sed -i 's/\r$//' <file>` and re-add. Check each staged file's EOL against `git show HEAD:path | file -` (some files are legitimately CRLF at HEAD — only fix the ones where HEAD is LF).
- Commit ONLY your files by explicit `git add <paths>` (never `git add -A`/`-am`), then confirm with `git diff --cached --name-only` — the shared index carries other agents' staged changes.
