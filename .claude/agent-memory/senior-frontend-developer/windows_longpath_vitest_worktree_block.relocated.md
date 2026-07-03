---
name: windows-longpath-vitest-worktree-block
description: vitest in deeply-nested worktree paths (.claude/worktrees/agent-<id>/platform) on Windows — TWO cases. If the worktree HAS node_modules installed, its vitest can hit the 260-char Node-ESM #module-evaluator block. If the worktree has NO node_modules (common — agent worktrees ship un-installed), JUNCTION main's node_modules in and vitest runs FULLY (validated 910 tests) because files then resolve at main's shorter path. See UPDATE.
metadata:
  type: project
---

Found 2026-07 while gating a CSS/token fix in a `.claude/worktrees/agent-ad029fd316f7d3999/` worktree.

**Symptom:** every `vitest run` invocation (`pnpm test`, `pnpm --filter <pkg> test`, `pnpm exec vitest`, `npx vitest`) fails at STARTUP, before any test file loads:
```
TypeError [ERR_PACKAGE_IMPORT_NOT_DEFINED]: Package import specifier "#module-evaluator" is not defined
  imported from …\node_modules\.pnpm\vitest@4.1.8_...\node_modules\vitest\dist\chunks\cli-api.BfdDOPPI.js
```
The referenced `package.json` genuinely HAS a correct `imports` map for `#module-evaluator` (verified by reading it directly) — this is Node's own ESM package-boundary resolver failing to find it, not a broken install.

**Root cause (confirmed):** the resolved path length is 280 chars — over Windows' classic 260-char `MAX_PATH`. The `.claude/worktrees/agent-<40-hex-id>/platform/node_modules/.pnpm/vitest@4.1.8_<long-peer-hash>/node_modules/vitest/dist/chunks/…` chain is long enough on its own; the extra `.claude/worktrees/agent-<id>/` nesting (vs. a normal checkout) tips it over. Reproduced with plain `node` doing `import(pathToFileURL(thatExactFile).href)` directly — same error, confirming it's not vitest-CLI-specific.

**Ruled out (don't re-try these, confirmed ineffective):**
- `pnpm install --force` (full relink) — no change.
- `NODE_OPTIONS=--preserve-symlinks` — no change (the file isn't even a symlink; it's a hardlink/junction with matching realpath).
- `subst X: <worktree-root>` + running from `X:\platform` — no change; Node's resolver reports the ORIGINAL long path in the error even when invoked from the substituted drive (Windows transparently resolves subst back to the real path somewhere in Node's/MSYS's path handling).

**Verified NOT my-code-caused:** ran the identical failure against an UNMODIFIED pre-existing test file (`packages/styles/src/scrollbar.fitness.test.ts`) — same startup crash. This is a pre-existing, universal, environment-level block in this specific worktree location, not something a code fix resolves.

**Workaround used (original session):** hand-replicate the exact parsing/assertion logic of the fitness test(s) in a plain throwaway `.mjs` script and run it directly. Still valid for PURE-LOGIC fitness tests when the block below can't be cleared.

---

**UPDATE 2026-07-03 (agent-af0688a7d93c83b48) — junctioning WORKS; vitest ran fully (910 tests).**

Different starting condition: this worktree had **NO node_modules at all** (agent worktrees ship un-installed — `ls node_modules` = absent; `npx vitest` → `Cannot find package 'vitest'`). Fix that made the FULL vitest CLI run green in the worktree:

1. Junction the ROOT: from `<worktree>/platform`, `cmd //c "mklink /J node_modules C:\...\national-accounts\platform\node_modules"`.
2. pnpm also puts a **per-package** node_modules (bare `import 'react'` from `packages/react/src` resolves there, NOT the root). Junction each one that exists in main: `packages/{react,plugins,core,charts,styles,contracts}/node_modules` and `apps/{geostat,panel}/node_modules`. (`packages/expr` has none.)
3. `@statdash/expr` resolves to `packages/expr/dist/index.js` (its package.json main), which isn't built in the worktree → junction `packages/expr/dist` from main too. Symptom before this: `Cannot find module '.../packages/expr/dist/index.js' imported from core/src/core/evalNodeDerive.ts`.

Result: `npx vitest run packages/plugins packages/react` → **113 files / 910 tests PASS**; `tsc -b apps/geostat/tsconfig.app.json` + `apps/panel/tsconfig.json` clean; eslint clean.

**Why this beats subst:** a JUNCTION at `node_modules` means the actual `.pnpm/...` package files physically live at MAIN's short path (`national-accounts\platform\node_modules\...`), so Node resolves them at ~<260 chars — it never walks the long worktree path for the package internals. subst failed because Node resolved subst back to the long real path; a junction points at a genuinely-short real path.

**Gotchas making the junctions:**
- Build the mklink target as a FULLY pre-expanded bash var; `\\$var` inside `cmd //c "..."` often fails to expand (`apps$a` literal) → dangling junction. Safest: `cd` into each parent dir and `cmd //c "mklink /J node_modules <ABS_TARGET>"` with a plain link name.
- **Remove junctions with `cmd //c "rmdir <name>"` ONLY — NEVER `rm -rf`** (rm follows the junction and would delete MAIN's node_modules contents). rmdir deletes only the reparse point.
- Junctions live under gitignored `node_modules`/`dist`, so they don't pollute `git status` / the commit. Still, `rmdir` them after gating to leave the worktree as found.

**For a future session:** prefer the junction approach first (real CLI gate, no logic re-implementation). Fall back to the `.mjs` replica only if a genuinely-installed worktree still hits the 260-char #module-evaluator block above.
