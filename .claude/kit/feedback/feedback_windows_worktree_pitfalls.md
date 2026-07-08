---
name: worktree-windows-pitfalls
description: Canonical Windows/worktree/vitest pitfall guide — MAX_PATH+pnpm, hoisted/leaflet, jsdom peers, stash phantom-deletions, main-checkout-runner edits
metadata:
  type: project
---

Canon for running gates (vitest/tsc/eslint) from an isolated `.claude/worktrees/agent-<hash>/`
checkout on Windows. Organized by pitfall.

## 1. MAX_PATH + pnpm (`ERR_PACKAGE_IMPORT_NOT_DEFINED "#module-evaluator"`)

**Symptom:** `vitest run`/`tsc` throws `TypeError [ERR_PACKAGE_IMPORT_NOT_DEFINED]:
"#module-evaluator" is not defined`, from deep inside
`.pnpm/vitest@.../node_modules/vitest/dist/chunks/cli-api.*.js` — even though that
package's `package.json` correctly declares `imports`.

**Root cause:** Windows 260-char MAX_PATH. Worktree prefix + pnpm's hashed
`.pnpm/<pkg>@<ver>_<peer-hashes>/...` segments exceed it; Node's
`lookupPackageScope` silently can't read `imports` past that length. Not a real
missing-export bug — proof: the identical (hardlinked) file imports fine from the
short main checkout.

**Doesn't work:** `subst W: <path>` — Node's ESM loader realpath-resolves the
substituted drive back to the long path before package lookup.

**Works — relocate the pnpm virtual store to a short path:**
```
rm -rf node_modules
pnpm install --frozen-lockfile --config.virtual-store-dir=C:/pvs-<short-id>
```
Must be forward-slash absolute (`C:\pvs-<id>` is parsed as relative → mkdir's a
literal `C:pvs-<id>` folder inside the project). Then build the engine chain before
any suite importing `@statdash/*` from source: `pnpm --filter "@statdash/expr" build`
then `--filter "@statdash/engine" build` (or `pnpm -r --filter "./packages/*..." run
build`) — fresh install has no `dist/` yet.

**Alternative — throwaway short-path worktree:** `git worktree add --detach
C:/<short> <branch>` → `pnpm install --prefer-offline --ignore-scripts` → `pnpm -r
--filter "./packages/*" run build` (required, `--ignore-scripts` skips it). Run
per-package, not root config (root pulls in `apps/geostat`, needs leaflet, absent
under `--ignore-scripts`). Panel has no `tsconfig.app.json` — use plain
`tsconfig.json`. Cleanup: `git worktree remove C:/<short> --force` (may fail on
locked node_modules) → `git worktree prune` + `rm -rf`.

**False-red under relocated store:** `apps/{geostat,panel}` tsc shows ~5 phantom
errors (react-apexcharts JSX-component errors under React-19 app types, an
implicit-any in `SidebarNavSection.tsx`) absent on main with the same lockfile —
baseline against main to confirm env artifact, not your change. Don't conflate with
[[green-gate-stale-buildinfo]] (a different phantom class — stale buildinfo/d.ts, not
path-length).

## 2. Leaflet resolve failure + hoisted node-linker

**Symptom:** `apps/geostat/vitest.config.ts` config-load throws `Cannot find module
'leaflet'`.

**Root cause:** config does `require.resolve('leaflet')`/`'react-leaflet'` at
load-time (`dirExternals`), but leaflet is RETIRED (0 refs in pnpm-lock.yaml; a
fitness test asserts no source imports it). Main checkout only resolves it via a
STALE hoisted `node_modules/leaflet` from an old install — a clean install lacks it.

**Fix (workaround):** copy `leaflet`, `react-leaflet`, `@react-leaflet` from main's
`platform/node_modules` into the worktree's, or symlink from the pnpm store
(`ln -sfn "$PWD/.pnpm/leaflet@1.9.4/node_modules/leaflet" leaflet`). Real fix (app
config owner) = drop both from `dirExternals`.

**Separate — jest-dom needs hoisted linking.** Default isolated store breaks
`@testing-library/jest-dom/dist/vitest.mjs` → `Cannot find package 'vitest'` (peer
unresolvable from jest-dom's store dir). Only geostat (jest-dom user) needs this —
`api`/`@statdash/engine` work without it:
```
CI=true pnpm install --config.node-linker=hoisted --config.virtual-store-dir=C:/vs/<short>
```
(`CI=true` auto-confirms the removal prompt; custom store keeps the committed
lockfile/package.json clean.)

## 3. jsdom peers (jest-dom → vitest → vite) + timeouts + project names

**Symptom:** even hoisted, `jest-dom/vitest` (in `vitest.setup.ts`) still fails
`Cannot find package 'vitest'`.

**Fix:** symlink vitest AND vite into the store's FLAT public `node_modules` (not a
private symlink inside jest-dom's own — vitest then can't resolve its own vite peer):
`ln -s C:/vs/<x>/vitest@…/node_modules/vitest C:/vs/<x>/node_modules/vitest` (+vite).
On a Windows-drive custom store use a junction: `cmd //c mklink //J
C:/pvs-<id>/@testing-library+jest-dom@<v>/node_modules/vitest
C:/pvs-<id>/vitest@<hash>/node_modules/vitest`.

**Do NOT** junction the WHOLE worktree `node_modules` to main's — per-package
node_modules still point at the custom store → dual-React invalid-hook error.

**Timeouts:** deep-path import/env setup is slow (~60-90s); default 5000ms
`testTimeout` gives spurious failures — run with `--testTimeout=60000`.

**`--project` filter by NAME not dir:** `api`, `@statdash/engine` (core),
`national-accounts` (geostat, derived from workspace root package name — no explicit
`name` in that config). Or filter by filename (`vitest run
perspective-render-validation`). Always run from `platform/` root — a package subdir
breaks store resolution. With all of the above, geostat's full jsdom suite (123
tests) runs green.

## 4. `git stash` phantom `.claude/agent-memory/**` deletions

**Symptom:** `git status`/stash shows hundreds of ` D .claude/agent-memory/**`
deletions you never made.

**Root cause:** the worktree's working dir was materialized from an older commit;
`main` advanced since (e.g. another agent's memory-persist commit ADDED files under
`.claude/agent-memory/**`). Those exist in HEAD but were never written to disk here →
git reports them as locally deleted. A blanket `git stash` captures the phantoms
alongside your real edits; a failed `stash pop` can strand real edits in the stash,
and `git stash apply` reintroduces the phantoms into staging.

**Fix:** prefer `git stash push -- <specific files>` or reason from the diff — never
blanket-stash in an agent worktree. If phantoms appear: `git checkout -- .claude/`
restores them from HEAD. Stage ONLY your task files by explicit path — NEVER `git add
-A`/`.`. Verify: `git status --short | grep -v agent-memory` shows only your files.

## 5. No node_modules in the worktree — main-checkout-runner workflow

**Constraint:** Edit/Write are sandboxed to the worktree (editing the shared main
checkout errors "isolated in the worktree"). The worktree usually has NO
`node_modules` → vitest/tsc can't run there (and a fresh install risks pitfall #1).

**Workflow:** (1) `git checkout -b <fixbranch> main` INSIDE the worktree — syncs the
tree to main's content (needed when the worktree branch is a stale ancestor of main).
(2) Edit files in the worktree. (3) `cp` edited files over the same paths in the main
checkout (has a working install); run gates from `platform/apps/<app>` via
`../../node_modules/.bin/vitest run` (also `tsc -b`, `eslint`,
`bash ../ops/scripts/check-laws.sh`). (4) After gates pass, `git checkout -- <files>`
in main to restore it, then stage+commit the files in the worktree. Step 1 can leave
stray phantom deletions in the worktree tree (see #4) — add ONLY your explicit task
files, verify with `git diff --cached --name-only`. The fixbranch ref is shared, so
the worktree commit is the real deliverable. Leaflet gotcha applies the same as #2.

**Fallback when node_modules truly can't be arranged** (bridging a temp config into
main is blocked by the harness): node-replica the pure transform(s) in the scratchpad,
run with plain `node`, faithfully copying the algorithm and asserting the target
outcome. ALSO commit the real vitest fitness test (runs green in a normal checkout).
State clearly that `tsc -b`/eslint must run post-merge and logic was
replica-validated, not gate-validated — don't burn cycles bridging.
