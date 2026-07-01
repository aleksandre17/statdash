---
name: tenant-content-gates
description: Two tenant-content/i18n gates exist (vitest SSOT + bash check-laws twin); authoring-label catalog allowlist must stay synced across both
metadata:
  type: reference
---

Tenant-content / i18n enforcement has TWO separate gates that must stay in sync:

1. **SSOT — vitest** `platform/tests/no-tenant-content.fitness.test.ts`: the `ALLOW` Set is the canonical allowlist. Two tiers: TIER 1 (GEL ₾/code, GeoStat brand საქსტატი, `['ka','en']` literal) forbidden EVERYWHERE incl. catalogs; TIER 2 (Georgian script) forbidden in rendering/logic only, catalogs exempt. `isCatalogClass` also auto-exempts `meta.ts`, `*Node.ts`, and `index.ts` with a `*SliceMeta` annotation.
2. **Twin — bash** `ops/scripts/check-laws.sh`: Law 4 ("No hardcoded Georgian text in engine") scans `platform/packages/core/src` via a Georgian-syllable grep heuristic (`გა|ვე|ება|ის|ობ`). Its `LAW4_CATALOG_ALLOW` regex mirrors the vitest ALLOW for the engine-side catalogs.

**Authoring-label catalog class** (Constructor schema-editor bilingual `{ka,en}` field labels via `bi(ka,en)` helper — NOT tenant content): `spec-catalog.ts`, `op-schemas.ts` (data/transform), `param-schemas.ts` / `visibility-schemas.ts` / `rowspec-schemas.ts` (config/), plus `dataIntegritySchema.ts` (plugins — vitest-only, bash never scans plugins for Law 4).

**Why:** check-laws false-positived on the `-schemas.ts` catalogs (2026-06) because the old bash exemption used a fragile `catalog\.ts:` filename-substring + `en:`-colon heuristic; `bi('ka','en')` has neither. Adding a new authoring-label catalog requires updating BOTH allowlists.

**How to apply:** when adding a Constructor authoring-label catalog under `packages/core` (or `packages/plugins`), add it to the vitest `ALLOW` set AND (if engine-side) to bash `LAW4_CATALOG_ALLOW`. Panel (`apps/panel`) is the authoring tool, deliberately NOT scanned — tool UI, not tenant-rendered output (rationale in check-laws.sh SCOPE header). Related: [[reference_plugin_i18n_layout]].
