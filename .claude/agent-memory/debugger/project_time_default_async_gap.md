---
name: time-default-async-gap
description: Root cause of geostat from=0/to=0 obs-query bug — empty year-select coerces to 0 via autoParse, and async time-options return [] not null so isLoading never gates the render
metadata:
  type: project
---

The geostat `from=0&to=0` HTTP 400 bug (and "განახლდა: 0" render) is an async time-default gap, NOT a config or engine-omit issue.

**Chain (all file:line in platform/):**
1. `year-select` default is Tier 3 `{from:'options',pick:'last'}` sourced from `{$cl:'time'}`. Time classifier loads ASYNC on the live CachedStore.
2. `useFilterState.getOptions` (react/src/filters/useFilterState.ts:93-96) calls `resolveYears`, which returns `[]` (empty array) when the `time` classifier isn't loaded yet — `resolve.ts:resolveRaw` `$cl` ref → empty.
3. `resolveDefaults` Pass A (core/src/config/filter-eval.ts:167-177): `rows=[]` is NOT `null`, so the key is NOT pushed to `pendingKeys` → `dims['year']=''` and `isLoading=false`. The render is NOT gated.
4. `autoParse('year-select','')` (filter-eval.ts:19) = `Number('') || Number(def.default) || 0` → `0` (def.default is the OptionsDefault OBJECT → NaN). Returns literal number `0`.
5. useFilterState.ts:168 `.filter(([,v]) => v !== '')` does NOT drop it — `0 !== ''` is true. So `ctx.dims['time'] = 0`.
6. `ApiStore.toObsParams` (core/src/data/store-api.ts:204-205) guard `timeDim !== undefined && timeDim !== ''` does NOT catch `0` → `from='0'`, `to='0'`.

**Two seams both contributed:** the async-empty-vs-loading hole (getOptions returns `[]` not `null` when data is still loading) AND `autoParse` coercing empty year-select to `0` instead of a no-value sentinel.

**Why:** mirror of the store async gap — a default that depends on not-yet-loaded cube data falls back to 0.
**How to apply:** when debugging "0 where a value should be" in filter defaults, check whether the options source is async and whether getOptions distinguishes loading (null) from empty ([]).
