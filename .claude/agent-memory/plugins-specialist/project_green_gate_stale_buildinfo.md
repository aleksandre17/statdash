---
name: green-gate-stale-buildinfo
description: The platform green gates (typecheck / build:engine) can show PHANTOM errors from stale incremental caches — clear caches / rebuild the engine chain before trusting red
metadata:
  type: project
---

When verifying green on `packages/plugins/**` edits, the shared gates can report errors that are NOT real and NOT yours:

1. **`pnpm typecheck`** (`tsc -b apps/geostat/tsconfig.app.json --noEmit`) writes incremental buildinfo to `apps/geostat/node_modules/.tmp/tsconfig.app.tsbuildinfo`. A stale cache surfaces PHANTOM `TS6133 'X declared but never read'` errors against symbols the source actually DOES use (e.g. `accentStyle` in panels/table/SimpleTable.tsx, `merged` in TableShell) — and the reported error file even CHANGES between consecutive runs. Fix: `rm -f apps/geostat/node_modules/.tmp/tsconfig.app.tsbuildinfo apps/geostat/node_modules/.tmp/tsconfig.node.tsbuildinfo` then re-run → clean.

2. **`pnpm build:engine`** (`pnpm -r --filter "./packages/*..."`) can fail the `@statdash/react` dts build with `TS7016: Could not find a declaration file for module '@statdash/engine'` when `packages/core/dist/index.d.ts` is STALE (smaller than current source). Recursive order doesn't always rebuild upstream d.ts. Fix: build the chain explicitly first — `pnpm --filter "@statdash/expr" build` then `pnpm --filter "@statdash/engine" build` — then `build:engine` is green.

**Why:** wasted a verification cycle chasing "errors" in panels/table that were pure cache artifacts; the source was already correct.
**How to apply:** before concluding a gate is RED (especially for files you never touched), clear the relevant buildinfo / rebuild upstream packages and re-run. Only trust red after a clean cache.

Also (2026-07-22): the full plugins vitest run is RED ON MAIN via `nodes/__tests__/token-cohesion.fitness.test.ts` — its color-literal scan reaches `packages/core/src/data/desugar.ts` (`#00A896, #E76F51`, introduced by committed core work 8243f5b7). Pre-existing, orthogonal to plugins edits; report it as main-red, don't chase it as your regression.

Also: `apps/geostat/src/data/site-manifest.test.ts > "boots without throwing when the API is unreachable"` is FLAKY under full-suite load — a 5000ms timeout on the API-unreachable fail-soft path. Passes in isolation (`pnpm vitest run src/data/site-manifest.test.ts`). Re-run isolated before treating it as a regression. Baseline total is 1150.
