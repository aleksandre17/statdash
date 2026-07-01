---
name: overnight-parity-batch-review
description: Adversarial standards audit of the 6-commit overnight parity batch (aa1c41d..6544d29). Prior 69cdef8 findings CONFIRMED FIXED. One real MEDIUM (dead conditional-GET 304 capability + test adjusted to match dead code) + LOW latents. No tenant/arrow/SOLID degradation.
metadata:
  type: project
---

Reviewed 2026-06-27: overnight commits aa1c41d, 69cdef8, 855a8c6, 242eddf, f380018, 6544d29 (API-arch render-parity batch).

**Why:** user's standards gate — "did ANYTHING degrade overnight?" Adversarial, read-only.

**How to apply:** the MEDIUM below is a real concept-narrowing (a capability silently made dead) and should be fixed or the dead code + ETag mechanism explicitly removed with an ADR. The LOWs are latent. Do NOT re-litigate the SOUND list.

**MEDIUM — conditional-GET / 304 capability is DEAD CODE, and its test was adjusted to match (242eddf).**
`ApiStore.queryAsync` (core/src/data/store-api.ts:119-136): the warm-read early-return (line 120) precedes the If-None-Match guard (line 136 `if (storedETag && this._cache.has(cacheKey))`). A cache HIT already returned; so at line 136 `_cache.has(cacheKey)` is ALWAYS false → `If-None-Match` is NEVER sent → the entire 304 branch (148-156) + the `_eTags` dataset-ETag mechanism are inert. The bug fixed (sending the dataset ETag for a never-fetched slice → 304-to-empty → cold querySync throw) was REAL, but the guard over-corrected and silently removed the conditional-GET bandwidth feature. apiStore.async.test.ts test 4 was rewritten to assert If-None-Match is UNDEFINED for an uncached slice and only assert a cache-hit fast-path for a cached one — it dropped the original positive "If-None-Match IS sent" assertion (so green-by-matching-dead-code). Test 4b "forces a 304" by mocking an UNCONDITIONAL 304 the real route can't emit (a 304 requires the request to have carried If-None-Match). Canonical fix: either (a) drop the ETag/_eTags machinery + dead 304 branch entirely (YAGNI, honest) with an ADR, or (b) make the conditional reachable: send If-None-Match keyed on a SEPARATE per-slice ETag map (not the dataset ETag, not gated on the very cache-presence that short-circuits before fetch). Today it is a Lehman-rot vestige presenting as a working feature.

**LOW — provenance fix uses a closed DENYLIST, not a positive LocaleString tag (855a8c6, resolveNodeRows.ts:237 NON_LOCALE_ROW_FIELDS={provenance,seriesFormat}).** Correctly fixes the prior HIGH (verified). But the discriminant is field-identity-denylist: the NEXT structured non-LocaleString DataRow field, or an object-valued classifier `metadata` lifted via liftClassifierMetadata (stats-classifiers.ts:85 preserves any non-array object as AttrVal) reaching a row through the `$cl` structural join, would be silently flattened unless added to the set. No active bug (all seed metadata is scalar: isClosing bool, account string; `$d` overlay carries only label/color/order, not metadata). Protected-Variations weakness. Canonical fix: tag LocaleString carriers positively (brand or known display-attr keys) instead of denylisting the exceptions.

**LOW — "present in every mode" span param is config DUPLICATION, not an engine concept (6544d29).** spanFrom/spanTo (hidden + {from:'options',pick} over {$d:'time'} sorted asc/desc) are duplicated in BOTH year-bar AND range-bar in geostat.provisioning.json (lines ~3702 & ~3786) so whichever bar is visible resolves them — because defaultParams gating (useFilterState.ts:98-104) denies a default to a hidden-bar param. Works, fully generic, NOT a hardcode (the span follows the cube). But "always-present param" is achieved by config copy-paste, not a first-class engine flag. DRY-at-config smell; a future `alwaysResolve`/bar-independent param seam would remove the duplication. Note for Constructor-readiness.

**SOUND (verified, do not re-review):**
- Prior 69cdef8 HIGH (resolveRowLocales provenance flatten) + MEDIUM (isUnsetTime SSOT dup) BOTH FIXED. isUnsetTime now single in core/time-dimension.ts:188; all call sites import it (grep clean). NON_LOCALE_ROW_FIELDS guard added + _resolveRowLocales test seam.
- V34 migration is EXEMPLARY: append-only (V1-V33 immutable), idempotent (ON CONFLICT DO NOTHING + ord re-converge), fail-fast guard refusing to widen under legacy 3-dim facts, post-condition assert, documented rollback + one-way-door risk gate. Structure→migration, data→canonical workbook ingest (no SSOT fork).
- seed-data.fitness TIER2 → describe.skip is LEGIT retirement (ADR-0032), not hidden failure: both compare sides (R__ gold + bundle files) are off the provisioning path post-V34; replacement coverage NAMED (canonical-ingest.e2e.test.ts + ingest-canonical.sh).
- Treemap `??`→`||` (special.ts:126, TreemapChart.tsx) is a ROOT-cause fix: upstream lookup emits '' (empty string) for unmapped color, which `??` keeps (transparent) but `||` correctly treats falsy. Documented why.
- store-filter.ts extraction is clean SRP (buildObsFilterParam: ctx baseline → val MEASURE_DIM pin → q.filter overrides incl. $ne client-side drop). $ne wire-drop + post-fetch matchesFilter + cache-key fold is the correct ACL (route can't express <>); generic, no dim names.
- Dependency arrow CLEAN across all night diffs (core/charts import nothing against arrow; grep clean).
- LocaleString confined to core/i18n/types.ts; resolveLocaleString invoked ONLY at React boundary (resolveNodeRows), never charts/transform. i18n stays out of locale-agnostic engine.
- No Georgia/geostat tenant leak into packages/* (grep clean). georgia-regions.geojson correctly in apps/geostat. panel-layout.css generic (token-driven aspect-ratio chain; geograph/Leaflet only in explanatory comments).
- Law 1 generic throughout: liftClassifierMetadata/liftObsAttributes no dim names; time via TIME_DIM SSOT; span params via {$d:'time'} convention not hardcoded years.
- transform sideEffects fix (242eddf) is a true root cause: Vite tree-shook registerTransformStep() module-init; adding transform/index.ts to package.json sideEffects is the canonical fix, not a patch.

**Verdict line:** ONE genuine degradation — the conditional-GET 304 capability was narrowed to dead code and its test adjusted to match (MEDIUM). Everything else sound; the two prior findings are fixed.
