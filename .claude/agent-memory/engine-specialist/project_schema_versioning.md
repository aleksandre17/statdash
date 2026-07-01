---
name: project-schema-versioning
description: Config schema versioning (N19/P3-3) — where the canonical migration runner lives, the duplicate, and the api decoupling boundary that blocks provisioning wiring
metadata:
  type: project
---

Config schema versioning is N19, extended by P3-3.

**Canonical runner:** `engine/core/src/config/migration.ts` — `CURRENT_SCHEMA_VERSION` (=1), `migratePageConfig(Record<string,unknown>)` (version-chain, idempotent, pure, forward-compat throw guard added in P3-3), `isCurrentSchema` (added P3-3), `registerMigration`, `highestMigrationVersion`, type `MigrationFn`. Exported from top-level `engine/core/src/index.ts` (Class-M public barrel). Tests: `engine/core/src/config/migration.test.ts`.

**Beware duplicate:** `engine/react/src/engine/migratePageConfig.ts` is a DIFFERENT, node-TREE-walking runner (per-node `migrate` hooks via nodeRegistry, `PLATFORM_SCHEMA_VERSION`). Same name, different layer/job. The engine/core one is page-blob-level; the react one is node-level. Do not conflate.

**NodePageConfig lives in `engine/react/src/engine/types/node.ts`, NOT engine/core/config.** It already has `schemaVersion?: number` on `PageConfigBase` (pre-existing). The files in `engine/core/src/config/` are DataSpec/filter/kpi/section specs, not the page tree.

**api → engine runtime coupling — RESOLVED 2026-06-22 (architect Option A):**
The api now consumes `@geostat/engine` at RUNTIME (first such coupling). Architect ruled Law 3 is NOT violated: api (apps tier) consuming engine/core (root of the arrow) follows the dependency direction.
**Root cause of the old "can't import" blocker was TWO undeclared deps, not paths:** (1) `engine/core/package.json` imported `@geostat/expr` in its barrel (index.ts line ~198, registerExprOp loop) but never declared it → no node_modules symlink; (2) `apps/api/package.json` never declared `@geostat/engine`. pnpm only symlinks DECLARED workspace deps. Fix: add `"@geostat/expr": "workspace:*"` to engine/core deps + `"@geostat/engine": "workspace:*"` to api deps, then `pnpm install`.
**Consumption model = DIST, not source paths.** api uses NodeNext. `customConditions: ["source"]` was TRIED and REJECTED: it source-resolves into engine/core/src which uses extensionless relative imports (compiled under root `bundler` resolution) → TS2835 errors under NodeNext, and pulls the whole engine internal type graph into api. Correct path: build engine dist (`pnpm --filter @geostat/expr --filter @geostat/engine build`, or `pnpm build:engine`) so api resolves the `import`/`types` export conditions → `dist/index.js` + `dist/index.d.ts`. Clean, decoupled (api sees only the public barrel), tsc EXIT 0.
**Caveat:** `engine/core/dist` is gitignored — a fresh clone / CI MUST run `pnpm build:engine` before api typechecks or runs (tsx dev resolves dist too). This is the existing engine-layer convention (engine/react already consumes engine/core this way).
**Wired in `routes/config/pages.ts` GET /:id:** lazy migration on read — `migratePageConfig(config)` before serving the JSONB blob; catch → 409 `{ code: 'CONFIG_SCHEMA_AHEAD' }` when stored schemaVersion > CURRENT. Test: `apps/api/src/routes/config/pages.test.ts` (fake pg + app.inject; v0→stamped v1, idempotent v1, 999→409, null untouched).
**The scripts-only ambient shim (`scripts/types/geostat-engine.d.ts`) stays untouched** — it is for ETL scripts (`import type` only, tsconfig.scripts.json), separate from api/src runtime consumption.
