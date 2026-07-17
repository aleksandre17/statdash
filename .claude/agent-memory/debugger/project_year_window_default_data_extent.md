---
name: year-window-default-data-extent
description: Range-perspective year-window (fromYear/toYear) defaults resolve against the time CODELIST/classifier member set, not the bound measure's realised data extent — overshoots when a measure ends before the codelist (regional GVA 2010-2024 vs codelist 2010-2025)
metadata:
  type: project
---

Year-window defaults on the range perspective (fromYear/toYear, spanFrom/spanTo) resolve `{from:'options', pick:'first'/'last'}` against `$d:"<timeDim>"`, which is the store's TIME CLASSIFIER member set — NOT the bound measure's actual observed periods.

**Why it bites:** a shared time codelist that extends one year past a specific measure's data makes the window default overshoot. Proven contrast (geostat seed): GDP_ANNUAL & ACCOUNTS_SEQUENCE = 2010–2025 (match codelist) so they're fine; REGIONAL_GVA = 2010–2024, but codelist has 2025 → `toYear` defaults to 2025 (desc-sort + pick:first = max), so the "final year" reads (subtitle `{fromYear}–{toYear}`, KPI reg-gva-last `Value added — {toYear}`, CAGR endpoints) land on an EMPTY coordinate → honest em-dash / near-zero final bar.

**Code path:** `$d` → `resolveDisplayRef` (core/data/codelist.ts:239) → `store.classifiers['time']` member set. When that classifier is ABSENT it silently falls back to `Object.keys(display['time'])` = full static codelist (codelist.ts:250-252) — the silent-fallback trap. Live, `classifiers['time']` is folded from the cube profile `timeCoverage.periods` (apps/api .../cube/actual-region.ts `loadTimeCoverage`; stats store-builder; FF-TIME-RANGE-LOADS). Window default → `filter-eval.ts:180` (`pick:'last'?rows[last]:rows[0]`) → QueryResolver clamps `[ctx.fromYear, ctx.toYear]` POST-fetch (registry/resolvers.ts:288). effectiveBounds = core/time-dimension.ts:175.

**Root fix:** window-bound defaults must resolve against the bound measure's realised period set (engine already has `resolveYears('all', measure, store)` distinct-time enumeration, resolvers.ts:41), and the `$d`/classifier-time fallback must never seed a default with a period the data lacks (canon: the canvas never lies).

**Two adjacent, independent defects on the regional page:**
1. Regional range KPIs default `sector:{$ctx:'sector', default:'_T'}` and `geo:{...$ne:'_T'}` but the regional cube has NO `_T` member (9 real sectors, 11 real geos, no total row) → those KPI VALUES read an absent coordinate → em-dash even for fromYear=2010 (which has data). The CHART works because it SUMS `$ne:_T` sectors instead of reading a `_T` total.
2. The 2 pre-existing perspective-render-validation.test.tsx failures (regional ka/en) use an EMPTY staticStore → range-KPI TITLES `{toYear}`/`{fromYear}` render as em-dash (honest-absent for unset param) vs the yardstick's literal-token expectation. These are a STALE TEST YARDSTICK, NOT the live window bug — fixing the data-extent bug won't clear them; the yardstick should assert token-free prefixes like the yearKpis already do (test comment L131-132) or assert the em-dash.

See also [[project_async_store_live_render_patterns]] (loading-vs-empty, warm≡read key), [[project_localestring_boundary]].
