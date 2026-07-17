# Worktree/gates playbook — THIS project's specifics (statdash-platform)

> Project-side twin of the agnostic kit guide `kit/feedback/feedback_windows_worktree_pitfalls.md`.
> That file carries the portable pitfalls (MAX_PATH+pnpm, stash phantoms, peers); THIS file carries
> what is true only here.

- **Build order after a fresh install:** `pnpm --filter "@statdash/expr" build` → `--filter "@statdash/engine" build` (or `pnpm -r --filter "./packages/*..." run build`) — suites import `@statdash/*` from dist.
- **Leaflet is RETIRED** (0 refs in pnpm-lock; a fitness asserts no source imports) but `apps/geostat/vitest.config.ts` still `require.resolve`s it at config-load (`dirExternals`) — main only works via a stale hoisted copy. Real fix (app config owner): drop leaflet/react-leaflet from `dirExternals`. Workaround in isolated stores: symlink from the pnpm store.
- **jest-dom hoisted-linking is needed only by geostat** (the jest-dom user); `api`/`@statdash/engine` run without it.
- **vitest `--project` names:** `api` · `@statdash/engine` (core) · `national-accounts` (geostat — derived from workspace root, no explicit name). Panel has NO `tsconfig.app.json` — use plain `tsconfig.json`. Always run from `platform/` root.
- **tsc false-red baseline under relocated stores:** ~5 phantom errors in `apps/{geostat,panel}` (react-apexcharts JSX under React-19 types, one implicit-any in `SidebarNavSection.tsx`) — baseline against main before blaming your change.
