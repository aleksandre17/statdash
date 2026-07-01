---
name: project-package-build-resolution
description: Why @statdash/* package dist builds (tsup --dts) expose defects that Vite/Vitest hide — undeclared sibling deps, self-imports, deep-internal imports
metadata:
  type: project
---

`@statdash/*` packages are consumed IN-REPO via Vite source aliases (apps/geostat/vite.config.ts maps `@statdash/x` → `packages/*/src`) and Vitest source resolution. That masks three classes of packaging defect that ONLY surface when building real dist via `tsup --dts` (i.e. `build:engine`, publish, or the api Docker image):

1. **Undeclared sibling deps.** A package imports `@statdash/sibling` in source but omits it from `dependencies`. Node can't resolve it (no symlink in that package's node_modules), but Vite alias resolves it anyway. Audit: compare `grep "from '@statdash/"` against the manifest deps per package. Fixing requires a `pnpm install --lockfile-only` then frozen install to materialize the symlink.

2. **Self-import + import.meta.env in DTS.** `packages/react` source imports its own barrel `@statdash/react` and uses `import.meta.env`. rollup-plugin-dts (tsup's dts pass) resolves an externalized workspace specifier via the package's own `exports` (→ not-yet-built dist) before tsconfig `paths`, → TS7016; and compiles without Vite ambients → TS2339 on import.meta.env. Solved with a per-package `tsup.config.ts` mapping the self-name to source in `dts.compilerOptions.paths` + `types: ['vite/client']`. NOTE: tsup `dts.compilerOptions.paths` REPLACE (not merge) the root tsconfig paths.

3. **Deep-internal subpath imports.** `packages/plugins` imports deep paths not in its deps' `exports` (e.g. `@statdash/react/context/SectionNavContext`, `@statdash/react/engine/NodeRegistry`). These are Law-3/Demeter smells in SOURCE; the in-lane build fix is a plugins `tsup.config.ts` mapping the full `@statdash/*` (incl. deep subpaths) to source for the dts pass.

**Why:** the green test suite + apps build stay green through all this because neither touches dist — they use source aliases. So a red `build:engine`/Docker build can coexist with a fully green `test`/`build`.

**How to apply:** when making any package build or Docker image robust, build dist from a clean `packages/*/dist` (`rm -rf packages/*/dist && pnpm build:engine`) — that is the only real test. The api Docker closure is precisely contracts+expr+core (`pnpm --filter "@statdash/api^..." run build`); it does NOT need charts/react/styles/plugins, so it sidesteps defects 2 and 3 entirely.
