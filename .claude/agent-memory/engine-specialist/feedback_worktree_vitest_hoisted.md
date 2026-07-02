---
name: worktree-vitest-hoisted
description: In an isolated git worktree, vitest 4 fails (#module-evaluator) under pnpm symlinks; hoisted install fixes it but duplicates React (rendering suites break)
metadata:
  type: feedback
---

# Running the test gate inside an isolated git worktree

**Rule:** A fresh git worktree under `.claude/worktrees/<id>/` has NO `node_modules` — run `pnpm install --prefer-offline` first (store is warm, ~35s). Then:
- `pnpm build:engine`, `tsc -b`, `eslint`, `bash ops/scripts/check-laws.sh` all work under the default pnpm symlinked (`.pnpm`) install.
- **vitest 4.1.x does NOT** — it throws `ERR_PACKAGE_IMPORT_NOT_DEFINED: #module-evaluator` resolving its own dist through the worktree's symlinked store (main checkout with identical version works; it's path/symlink-specific, not a version bug). `--preserve-symlinks` makes it worse (breaks peer resolution).
- **Workaround:** append `node-linker=hoisted` to `platform/.npmrc` and re-`pnpm install`. Vitest then runs. **BUT hoisted un-dedupes react/react-dom → every component-RENDERING suite fails with "Invalid hook call" (duplicate React).** Pure/logic suites (no `@testing-library/react` render) pass fine.

**Why:** pnpm's `.pnpm` symlink layout + Node ESM subpath-imports don't resolve cleanly from the deep `.claude/worktrees/...` path; hoisting flattens node_modules (fixes subpath imports) but loses the single-React-instance guarantee.

**How to apply:** For engine/core work, gate the PURE fitness suites in the worktree under hoisted (reliable). For React-rendering suites, they will show false "Invalid hook call" failures under hoisted — verify those SAME suites in the normal symlinked MAIN checkout (`cd platform && pnpm exec vitest run <file>`) to prove any failure is the harness artifact, not your code. **REVERT the `.npmrc` hoisted line (`git checkout -- .npmrc`) before committing** — it must not enter the diff. Related: [[shared-tree-concurrency]], [[ar36-pivot-p0]].
