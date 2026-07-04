---
name: worktree-maxpath-vitest
description: vitest fails in deep .claude/worktrees agent paths via Windows MAX_PATH; run gates from a short-path throwaway worktree
metadata:
  type: project
---

Running vitest inside `.claude/worktrees/agent-<hash>/platform` FAILS at startup with
`ERR_PACKAGE_IMPORT_NOT_DEFINED: "#module-evaluator"` (from vitest's own
`dist/chunks/cli-api...js`). Root cause is NOT vitest/pnpm/node — it's **Windows
MAX_PATH (260)**: the agent-worktree prefix (~45 chars) pushes
`node_modules/.pnpm/vitest@4.1.8_.../node_modules/vitest/package.json` over the limit,
so node's `lookupPackageScope` can't read the `imports` field → treats it as undefined.
Proof: the exact same file is a hardlink (identical inode) that imports fine from the
short main checkout `platform/`.

**Why:** deep agent worktrees + pnpm's long `.pnpm/<pkg>@<peer-hash>` dir names exceed 260.

**How to apply:** to run the vitest/tsc gate suite against a worktree branch:
1. Commit your changes on the branch.
2. `git worktree add --detach C:/<short> <branch-or-commit>` (short path like `C:/fro`).
3. `cd C:/<short>/platform && pnpm install --prefer-offline --ignore-scripts` (~40s, shared store).
4. `pnpm -r --filter "./packages/*" run build` — REQUIRED: `--ignore-scripts` skips it, and
   tests resolve `@statdash/*` to `dist/` (else `Cannot find module .../expr/dist/index.js`).
5. Run each scope from its package dir (root `vitest.config.ts` projects pull apps/geostat
   which needs `leaflet`, absent under `--ignore-scripts` → run per-package instead):
   `cd packages/react && pnpm exec vitest run` (also core, plugins; api: `cd apps/api && pnpm exec vitest run src/provisioning`).
6. tsc: `pnpm exec tsc -b apps/geostat/tsconfig.app.json` and `apps/panel/tsconfig.json`
   (panel has NO `tsconfig.app.json` — use `tsconfig.json`).
7. Cleanup: `git worktree remove C:/<short> --force` may fail (locked node_modules);
   follow with `git worktree prune` + `rm -rf C:/<short>`.

Note: `apps/geostat` render harness (`perspective-render-validation.test.tsx`) can't run
under `--ignore-scripts` (missing `leaflet` at config-load) — needs a full install.
