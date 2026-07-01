---
name: reference-defaults-guard-contract
description: The defaults-vs-saveGuard locale-completeness contract — how getDefaults must seed localized fields so a fresh element passes save
metadata:
  type: reference
---

The Constructor saveGuard (`apps/panel/src/save/saveGuard.ts`, check 4 "locale-complete")
rejects a page where any `coverage:'localized'`/`type:'LocaleString'` field is PRESENT but
not non-empty for every active locale. An OPTIONAL localized field that is entirely ABSENT
is skipped; a REQUIRED one must be complete. `validateField` (check 3) owns "required but
empty" — note its `isEmpty` treats `{ka:'',en:''}` as NON-empty (has keys), so an empty
LocaleString record slips past check 3 and is caught by check 4.

**Defaults contract (locked by fitness):** `nodeRegistry.getDefaults(type)` (= `meta.defaults`)
must produce a save-guard-VALID element with zero author edits:
- OPTIONAL localized field → OMIT from defaults (absent = guard skips it). Never seed `{ka:'',en:''}`.
- REQUIRED localized field → seed a COMPLETE LocaleString (non-empty placeholder for every active locale, e.g. `{ka:'სათაური',en:'Title'}`).

**Where defaults live:** node/panel metas carry `defaults` on `NodeSliceMeta`/`PanelSliceMeta`
(seeded via a `*Defaults` const in the sibling `*Node.ts`, wired into `meta.ts`). `ChromeSliceMeta`
has NO `defaults` field — chrome per-instance config is injected via `ChromeSlotConfig.config`,
so chrome localized fields are always absent at drop time (trivially guard-compatible).

**Fitness:** `packages/plugins/nodes/__tests__/defaults-guard.fitness.test.ts` (@vitest-environment
node, imports pure `meta.ts`). Replicates the guard's `missingLocales` predicate (guard is above
the arrow, can't be imported) and asserts every meta's defaults pass + has probes that fire on an
empty-present optional default and an incomplete required default. See sibling
[[reference-panel-registration-barrels]] and schema-completeness fitness in the same dir.

**Active locales baseline:** `ka` + `en` (the pair every meta's `label`/`i18n` carries).

Only `hero` was empty-present (title required + subtitle optional, both `{ka:'',en:''}`); `text`
required `content` had no default at all. Both fixed 2026-06-23.
