---
name: windows-worktree-maxpath-pnpm-fix
description: Vitest/tsc fail with ERR_PACKAGE_IMPORT_NOT_DEFINED "#module-evaluator" in deep .claude/worktrees/agent-* paths — fix via a short pnpm virtual-store-dir, not subst/junction
metadata:
  type: project
---

Running from a deep worktree path (`.claude/worktrees/agent-<hash>/platform`) pushes
pnpm's hashed `.pnpm/<pkg>@<ver>_<peer-hashes>/node_modules/...` paths past Windows'
260-char legacy MAX_PATH. Symptom: `node -e "import('vitest/node')"` (and any
`vitest run`) throws `TypeError [ERR_PACKAGE_IMPORT_NOT_DEFINED]: Package import
specifier "#module-evaluator" is not defined` from a `dist/chunks/cli-api.*.js`
deep inside `.pnpm/vitest@.../node_modules/vitest/...` — even though the package's
own `package.json` DOES declare that `imports` key (verified: valid JSON, correct
`imports` field). It's a silent long-path failure inside Node's ESM resolver, not
a real missing-export bug.

**Fix that does NOT work:** `subst W: <path>` then `cd /w`. Node's ESM loader
resolves the DOS-substituted drive back to the real (long) path via
`GetFinalPathNameByHandle`-style realpath resolution before doing package-boundary
lookup, so the long path re-appears and the failure persists identically.

**Fix that works:** relocate pnpm's virtual store to a short path OUTSIDE the deep
worktree tree for this one install, via `--config.virtual-store-dir` (must be a
forward-slash absolute path — `C:/pvs-<short-id>`, NOT `C:\pvs-<id>` which pnpm
parses as relative and mkdir's a `C:pvs-<id>` folder INSIDE the project):

```
rm -rf node_modules
pnpm install --frozen-lockfile --config.virtual-store-dir=C:/pvs-<short-id>
```

After this, `vitest`/`tsc` resolve fine from the SAME deep cwd — only the actual
physical file locations moved, not the invoking path. Also then run `pnpm
build:engine` before `vitest run` in any package that imports `@statdash/expr`
etc. from source (packages/core does) — first fresh install has no built `dist/`
yet, and `packages/core/src/core/evalNodeDerive.ts` imports `@statdash/expr` by
package name, not source path.

Related: [[project_green_gate_stale_buildinfo]] (a DIFFERENT phantom-error class —
stale buildinfo/d.ts, not path-length) — don't conflate the two when triaging a
red gate in this repo.
