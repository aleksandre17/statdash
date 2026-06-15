---
name: expr-dist-missing
description: @geostat/expr package has no dist/ directory — resolveNodeRows.test.ts in engine/react fails with ERR_MODULE_NOT_FOUND before any test runs
metadata:
  type: project
---

The `engine/expr` package exports via `./dist/index.js` (package.json exports field) but the `dist/` directory does not exist. This is a pre-existing state.

The vitest alias in `engine/react/vitest.config.ts` resolves `@geostat/expr` to `../expr` (package root), which then tries to load `dist/index.js` via the package exports — and fails.

**Why:** The expr package needs `pnpm build` (tsup) to generate dist. It has not been built.

**How to apply:** When asked to run `engine/react/vitest run` and it fails with `Cannot find module '...expr/dist/index.js'`, this is pre-existing — do not attribute to current changes. Report as pre-existing infra gap. The 35 core tests and tsc pass clean.
