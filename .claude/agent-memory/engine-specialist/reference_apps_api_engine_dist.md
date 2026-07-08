---
name: apps-api-engine-dist
description: apps/api consumes @statdash/engine via its built DIST, not source — a core export change is invisible to apps/api until pnpm build:engine runs; customConditions source-resolution was tried and rejected
metadata:
  type: reference
---

`apps/api` is the one apps-tier consumer that imports `@statdash/engine` at RUNTIME (not just
`import type`). It resolves the package through the **built `dist/` output** (`import`/`types`
export conditions → `dist/index.js` + `dist/index.d.ts`), because `apps/api` uses NodeNext
module resolution.

**Recurring gotcha:** after editing any `packages/core` export (new type, new function, a
changed seam), `apps/api` tests/typecheck will NOT see the change until you run
`pnpm --filter @statdash/engine run build` (or `pnpm build:engine`). This has bitten multiple
sessions (perspective-axis P5, P5.1; schema-versioning). If an apps/api fitness test fails with
a stale-looking type error or a missing export right after a core edit, rebuild first before
debugging further.

**Why DIST and not source:** `customConditions: ["source"]` was tried and REJECTED —
`packages/core/src` uses extensionless relative imports (compiled under root `bundler`
resolution), which throws TS2835 under NodeNext, and it would pull apps/api into the engine's
whole internal type graph instead of just its public barrel. Consuming dist keeps apps/api
decoupled (it only ever sees the public API surface) — this mirrors how `packages/react` already
consumes `packages/core`.

**Consequence:** `packages/core/dist` (and other package dists) are gitignored — a fresh clone
or CI run MUST `pnpm build:engine` before apps/api typechecks, tests, or runs (even `tsx` dev
resolves dist, not src, for this package).

Unrelated ambient shim: `scripts/types/geostat-engine.d.ts` (or its renamed successor) is for
standalone ETL scripts only (`import type`, separate tsconfig) — not part of this consumption
path.
