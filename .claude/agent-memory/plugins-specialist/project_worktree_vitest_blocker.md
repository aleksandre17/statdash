---
name: worktree-vitest-blocker
description: Isolated agent worktrees have no node_modules — vitest/tsc/eslint can't run in-place; node-replica pure logic is the sanctioned fallback
metadata:
  type: project
---

When working in an isolated agent worktree under `.claude/worktrees/agent-*/`, the worktree has **no `node_modules`**. Consequences for gates:

- `npx vitest` run with cwd = worktree fails: the per-package `vitest.config.ts` does `import 'vitest/config'`, unresolvable without node_modules (`ERR_MODULE_NOT_FOUND: Cannot find package 'vitest'`).
- Running the MAIN repo's vitest (`national-accounts/platform` has node_modules) does NOT cover worktree files: the main `vitest.config.ts` `test.projects` are per-package `src/**` globs; a worktree path under `.claude/worktrees/**` matches no project (and `.git/**` is excluded).
- Pointing main vitest at a worktree config via `--config <wt>/vitest.config.ts` still fails — the config file is loaded from the worktree location and can't resolve `vitest/config`.
- Writing a temp bridge config INTO the main checkout is **blocked by the harness** ("Edit the worktree copy instead") — you can only write inside the worktree, which reintroduces the node_modules problem.

**Fallback (validated):** node-replica the pure transform(s) in the scratchpad and `node` it (main node works). Faithfully copy the exact algorithm from the edited source and assert the target outcome. ALSO commit the real vitest fitness test — it runs green in a normal checkout / the owner's env. `tsc -b` and eslint have the same node_modules blocker; state clearly in the report that they must be run post-merge and that logic was replica-validated.

**Why:** matches the standing "if worktree blocks vitest, node-replica the logic + report" guidance. Don't burn cycles trying to bridge — go straight to replica + report.
