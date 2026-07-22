---
name: obs-measure-drop
description: CONFIRMED-LIVE data-integrity defect — obs query drops top-level q.measure in buildObsFilterParam → covering-slice collapse; charts render wrong measure while config+server are correct
metadata:
  type: project
---

`buildObsFilterParam` (platform/packages/core/src/data/store-filter.ts:65) pins the measure for a **val** query (`filterRecord[MEASURE_DIM] = q.code`, :82-84) but for an **obs** query it folds ONLY `q.filter` (:86-118) and NEVER folds the top-level `q.measure` field.

**Consequence:** a `query` DataSpec whose measure rides in `query.measure` (the metric-ref path — `resolveQueryMeasures` returns `{type:'obs', measure:'<code>', filter:{...}}`, measure stays top-level, NOT in filter) fetches + caches a measure-LESS covering slice (`{geo,approach}` → ALL measures). The chart then collapses the covering rows per time coordinate to a single last-wins measure. Live 2026-07-20 `/ka/gdp?mode=range`: charts 1 (gdp.current) & 2 (gdp.perCapita) both rendered the `real-gdp-growth-rates` series (0,7.9,…,-6.3,…,7.5) though page config + server data were CORRECT (browser's own measure-specific response #45 = nominal 22148→104598).

**Diagnostic triad (how to re-confirm):** measure-in-`filter` renders correct (chart 4 noe-share, control) · measure-via-`query.measure` metric-ref collapses (charts 1/2) · `val`/KPI path pins MEASURE_DIM so is correct (KPI card "საბოლოო წელი"=104598 right). Network trace tell: obs reads appear as bare `filter={approach,geo}` with NO measure (79 rows). This is the query-vs-val/KPI arm of [[project_ar38_default_asymmetry]].

**Why gates stayed green (false-green):** warm & read BOTH derive their key from the same `buildObsFilterParam`, so warm-key ≡ read-key (both measure-less) — `warm-read-key`/`warm-covers-render` fitnesses pass on consistency while the slice is measure-WRONG. No fitness asserts two sibling `query` charts with same {geo,approach} + different measure render DISTINCT series.

**Fix — LANDED `a91cd74c` (2026-07-22, engine-specialist):** `measurePin()` helper is now the SSOT for wire measure-pinning; BOTH val and obs branches pin through it (single→scalar, OR-set→array, `'*'`→skip so `$ctx`-into-filter scopes; explicit `filter[MEASURE_DIM]` still overrides). Gates added: FF-OBS-MEASURE-PIN (5 asserts) + FF-QUERY-RENDER-TRUTH (sibling same-dims/diff-measure ⇒ distinct wire filter AND distinct series — the missing truth gate). Class-sweep: `buildObsFilterParam` was the single measure-less obs key builder; no other path. Deployed to dev :3013+:3012 same day; live GDP re-verify by the lead.

**Why:** Violates Law 11 (canvas never lies — a fake series presented as nominal ₾). CONFIRMED live on production portal :3012.
**How to apply:** If asked to "restore mis-bound gdp charts" via config — the config is NOT the defect (byte-identical to `geostat.provisioning.json`); STOP any config PUT and point here. Verify the file still has the val/obs asymmetry before recommending (grep `MEASURE_DIM` in store-filter.ts).
