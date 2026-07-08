---
name: project-restructure-paths
description: Post-restructure layout — engine/* is now platform/packages/*; dependency arrow and npm scope details
metadata:
  type: project
---

The repo was restructured: the old `engine/*` tree is now `platform/packages/*`.

**Why:** platform rearchitecture (see architect ADR adr_platform_structure_rearchitecture). The `@statdash/*` npm-scope rename has NOW LANDED (de-tenanted from the old first-tenant `@geostat/*`, ADR platform-structure-rearchitecture Phase 5) — confirmed in packages/CLAUDE.md + source imports as of 2026-06-23.

**How to apply:**
- Engine core = `platform/packages/core` (pkg `@statdash/engine`). React adapter = `platform/packages/react` (`@statdash/react`; deep subpaths `@statdash/react/engine`, `@statdash/react/engine/NodeRegistry`, `@statdash/react/engine/slice-meta`, `@statdash/react/engine/types`, `@statdash/react/engine/registerSlice`). Plugins = `platform/packages/plugins` (`@statdash/plugins`, faces: `/registry` runtime, `/catalog` META-only palette). Also: `contracts`, `expr`, `charts`, `styles`.
- Dependency arrow: `contracts ← expr ← core ← charts ← react ← plugins ← apps/*`. `contracts ← apps/api`. Enforced by eslint `no-restricted-imports` in `platform/eslint.config.js`. Lint = `pnpm -C platform lint` (pre-existing react-refresh warnings only, 0 errors).
- Build: `pnpm -C platform build` (root build script is `tsc -b && vite build` per app). Tests: `pnpm -C platform test` (vitest projects declared in `platform/vitest.config.ts`, NOT vitest.workspace.ts — Vitest 4 ignores workspace files).
- The `@geostat/*` scope is FULLY RETIRED — only a guard test (`tests/no-geostat-scope.fitness.test.ts`) still references the string, to catch regressions. Deep subpath imports resolve via the current `@statdash/*` package.json `exports` maps directly.
- Pre-existing TS debt (do not treat as regressions without re-verifying): `erasableSyntaxOnly` TS1294 errors in core/react under `tsc -b` strict invocation; `leaflet` missing types in plugins georgraph; `process` in expr/derive. Logged in [[project_debt]] — check that file for current status.
