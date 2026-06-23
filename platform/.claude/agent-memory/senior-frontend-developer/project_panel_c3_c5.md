---
name: project-panel-c3-c5
description: Constructor C3 (cube capability-discovery) + C5 (save guard / i18n shift-left) — the seams built in apps/panel and their contracts
metadata:
  type: project
---

C3 + C5 completed the Constructor MVP in `apps/panel` (scope is `@statdash/*`, engine in `platform/packages/*`).

**C3 — capability discovery (`apps/panel/src/discovery/`)**
- `lib/cubeApi.ts` is the cube discovery client — a SIBLING of `lib/api.ts` (config CRUD). It reuses `api.ts`'s exported `requestAt(prefix, …)` transport but hits `/api/cube/*` (an UNGUARDED delivery scope, NOT under `/api/config`). Wire types MIRROR the api route shapes exactly (the consumed contract; do not reach into apps/api). Split out because api.ts hit the 400-line hard ceiling.
- The "active dataset" is derived from `DataSource.config.datasetCode` (`pickActiveDatasetCode` / `datasetCodeOf` in `cubeProfile.store.ts`) — there was NO dataset concept in the panel before this. `useActiveProfile()` is the one hook every data-bound control/gate calls; it returns `none|loading|ready|error` and NEVER throws (graceful degradation is a first-class state).
- Pure cores (each fitness-tested): `suggestPanels(profile)` (geo-ROLE→map, isTime→timeseries — Law 1: read conceptRole, never dim code), `cubeEnumOptions` (measure/dimension/member resolvers), `capabilityGate` (gate OPEN unless a ready profile proves a data-bound entry unsupported).
- `EnumRefField` now resolves `cube.measures|cube.dimensions|cube.members` from the active profile; `cube.members` is dimension-scoped via a `sourceDim` descriptor + the new `siblingValues` on `FieldControlProps` (Inspector passes `node.props`). `MeasureSelector`/`ChipInput` gained `options` from the profile (freeSolo kept → degrades to free text).

**C5 — save guard (`apps/panel/src/save/saveGuard.ts`)**
- `validatePageForSave(page, {activeLocales})` runs FOUR checks and returns ALL issues: migrate-identity (engine `migratePageConfig`+`isCurrentSchema`, compared ignoring the schemaVersion stamp), serialize-round-trip (JSON-serializable + no functions + `fromNodePageConfig(toNodePageConfig)≡` via `stableStringify`), per-node-valid (PropSchema `validateField` + slice `getValidate`), locale-complete (every `coverage:'localized'`/`LocaleString` field covers all active locales; OPTIONAL absent fields are skipped — only present-but-incomplete or required-missing block).
- Wired as a REAL consumer: `api-actions.ts` `createPage`/`savePage` call `assertSaveable` which throws `SaveGuardError{issues}` BEFORE the API write (not swallowed like the network catch).

**Why:** completes the MVP fitness — author + publish a single-panel page the runner renders identically; failures shift LEFT to authoring time (mirrors V13/V14 gold completeness).

**How to apply:** Two `migratePageConfig` exist — engine `@statdash/engine` (version-blob, what the guard uses) vs `@statdash/react/engine` per-node (NOT exported from the barrel). The panel build pulls `packages/*` SOURCE via project refs, so `pnpm build` shows pre-existing erasableSyntaxOnly/leaflet errors in packages — NOT panel-owned; filter to `apps/panel/src` to see the panel is clean. See [[project-panel-dataspec-editor]].
