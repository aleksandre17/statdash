---
name: runner-chrome-i18n-adr019
description: ADR-019 wires runner-chrome (feedback ns) tenant locales via manifest.i18n.catalog — the i18next deep-flag gotcha, INV3 gate, ancestor leak-fix, ADR-numbering remap
metadata:
  type: project
---

Branch `feat/runner-chrome-i18n` (commits 5d6f2b4/d95b690/806b285). Closes the last i18n leak:
the `feedback` i18next namespace (EmptyState/ExportBar/SharePermalinkButton) was EN-only → English
on /ka. It was the ONE chrome ns NOT registered via `registerSlice` (so no `SliceMeta.i18n`
bilingual source; every other ns rides AR-37 P1). See [[i18n-integrity-ar37-ar39]].

**The wire (ADR-019 = `docs/architecture/decisions/ADR-019-runner-chrome-i18n-catalog.md`):**
extend `I18nConfig` (packages/react SiteContext.tsx) with optional `catalog?: I18nCatalog`
where `I18nCatalog = Record<locale, Record<ns, Record<key,string>>>` — i18next's NATIVE resource
shape (locale-OUTER, NOT a `{ka,en}` LocaleString bag). ADDITIVE: contracts still types manifest
`i18n` as opaque JsonRecord → the bootstrap route passes `site_config.i18n` verbatim → **ZERO api
code change** (the catalog rides inside). `registerManifestI18n(i18n)` (apps/geostat/src/i18n/
manifest-catalog.ts) loads it at boot in App's bootstrap effect (beside registerFormatters). Georgian
is authored in `geostat.provisioning.json` `site_config.i18n.catalog` (tenant artifact — NOT the
de-tenanted runner → zero erosion; Georgian is a tenant LOCALE, not brand). Runner keeps ONLY its en
baseline (feedback.ts) as the offline/emptyManifest fallback.

**i18next deep-flag gotcha (LOAD-BEARING, cost me a red test):** `addResourceBundle(lng,ns,res,
deep,overwrite)` with **deep=false SHALLOW-merges `{...old,...new}` — new ALWAYS wins regardless of
the `overwrite` flag**. `overwrite` only matters when deep=true (it governs deepExtend). So a
"non-clobbering baseline" MUST use **deep=true, overwrite=false** (deepExtend fills only MISSING
keys). The catalog loader uses deep=true, overwrite=true (tenant authoritative). With those two
settings the load order between the lazy renderer chunk (baseline) and the eager boot effect
(catalog) is irrelevant — catalog always wins, baseline never clobbers. Verified all 4 scenarios
against real i18next via a node replica (vitest can't start in this worktree — MAX_PATH block).

**Gate — INV3 catalog completeness** (`apps/api/src/provisioning/authoring-locale-complete.fitness
.test.ts`): the catalog is locale-OUTER, so INV1/INV2 (which walk locale-INNER `{ka,en}` bags) are
STRUCTURALLY BLIND to it (an entirely-absent `ka.feedback` is neither a partial bag nor a mono
display key). INV3: every (ns,key) present in ANY catalog locale must exist in EVERY active locale
non-empty + a non-vacuous floor (unionPairs>0). en-only ns → RED; absent catalog → floor RED
(both verified). Self-maintaining. Note: INV1's `isBag` does NOT false-positive on the catalog root
`{en:{…},ka:{…}}` because its values are OBJECTS not strings (isBag requires ≥1 string value).

**Leak-gate generalization** (`config-no-locale-leak.fitness.test.ts`): `collectLeaks` only checked
the IMMEDIATE parent key for locale-arm-ness → it false-flagged catalog Georgian (under `ka`
GRANDPARENT). Fix: carry a `underLocale` boolean down the ANCESTOR path — tenant script is legit if
ANY ancestor key is a locale key (covers locale-inner bags AND locale-outer catalogs); a bare
Georgian string under NO locale ancestor is still a leak. More-correct, not weaker.

**ADR-numbering remap gotcha:** code comments reference LEGACY 4-digit `ADR-0027`/`ADR-0028`; the
kit-reorg renumbered them (`0027`→`ADR-016-content-constraint`, `0028`→`ADR-017-geostat-detenant-
phase-c`; see `platform/work/kit-reorg/merge-log.md`). Dir mixes 3-digit (001–018) + stray 4-digit
(0023/0025/0026). NEW ADRs take the next 3-digit → ADR-019. Do NOT create an "ADR-0028" file.
