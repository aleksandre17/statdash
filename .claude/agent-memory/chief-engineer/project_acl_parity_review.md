---
name: acl-parity-review
description: Standards review of commit 69cdef8 (async-store ACL parity fix) — one HIGH latent bug (resolveRowLocales over-broad object heuristic corrupts provenance), one MEDIUM SSOT duplication (isUnsetTime), rest sound
metadata:
  type: project
---

Commit 69cdef8 "feat(parity): restore full chart/data/dynamics/label render on the API arch (ACL boundary fix)" — engine-specialist's async-store contract fix (GAP 3/4/5/5b). Reviewed 2026-06-26 against project laws + SDMX/Clean-Arch standards.

**Why:** finish-line parity commit; user demanded EXCEED-the-old standards gate before "done".

**How to apply:** the two findings below are real and should be fixed before this is considered fully sound. The rest of the commit is genuinely high-quality — do not re-litigate it.

**HIGH — `resolveRowLocales` over-broad object heuristic (react/src/engine/resolveNodeRows.ts:225-248).** `isLocaleObject(v)` returns true for ANY non-null non-array object, then `resolveLocaleString` flattens it. The final pass (line 222) runs over fully-encoded `DataRow[]` whose `provenance?: ProvenanceRecord` is a structured object with no `en`/locale key → falls through to `Object.values(s)[0]`, replacing the whole provenance object with a random scalar. Breaks `resolvePreliminary.rowIsPreliminary` (reads `r.provenance?.status`) → preliminary/last-updated/methodology badge silently stops firing (Law 9 data-integrity regression). `seriesFormat: Record<string,string>` is also structurally a LocaleString → same risk. Root cause: structural heuristic instead of a tagged discriminant. Canonical fix: make LocaleString carriers explicit (resolve ONLY the known display-label cells the `$d` join injects, or tag locale objects), not "any object". FF-WARM/DISPLAY tests don't catch it.

**MEDIUM — SSOT duplication of the unset-time predicate.** `isUnsetTimeDim` (core/src/data/spec.ts:115-122) is byte-identical copy-paste of `isUnsetTime` (core/src/data/store-api.ts:57-66); same package. This is the EXACT predicate the GAP-4 warm-key≡read-key invariant depends on — if one drifts, the cold-cache-empty-charts bug returns. FF-WARM-READ-KEY-EQ tests resulting keys for fixed inputs, NOT that the two predicates agree. Fix: export one from core/src/core/ (time-dimension.ts), both call sites import it.

**SOUND (verified, do not re-review):**
- Dependency arrow clean: react/plugins import only `@statdash/engine`; queryReadObs + resolveLocaleString properly exported from core index.
- Class-M widening minimal & correct: `AttrVal = DimVal | LocaleString` additive; EngineRow/DataRow kept scalar; widening confined to the attr-bag types (ClassifierEntry index sig, DisplayMap, DimViewResult, resolveDisplayRef). string ∈ LocaleString ⇒ backward compatible.
- ACL confined to ONE seam: obs_value Number coercion (toNumericValue), seq_pos→seqPos lift (liftObsAttributes), label/parent_code mapping all live in stats-api.ts; resolvers untouched. Postel + suppressed≠0 + corrupt→null all correct.
- $cl/$d separation faithful: buildDisplayOverlay projects ONLY label/color/order; FF-DISPLAY-WIRED test asserts parent/isClosing NOT carried into overlay (SDMX structural-vs-display).
- queryReadObs is a real SSOT: warm + read both derive obs identity from resolveQueryMeasures; range mode emits one unbounded req (no spurious time:0 pin).
- Fitness functions genuine (non-vacuous, would catch regressions): FF-WARM-READ-KEY-EQ derives read key from real storeObs path; FF-NO-ROLLUP derives rollup membership from canonical codelists, Law-1-generic (any `_`-prefixed code, any dataset), has explicit non-vacuity assertion; FF-OBS-NUMERIC covers string/null/corrupt/seqPos; FF-DISPLAY-WIRED covers presence + key + $cl/$d.
- Law 1 (no privileged dims): liftObsAttributes generic, no dim names; isUnsetTime generic on TIME_DIM.
