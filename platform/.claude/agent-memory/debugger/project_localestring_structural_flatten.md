---
name: localestring-structural-flatten
description: resolveRowLocales flattened ANY plain object as a LocaleString, collapsing DataRow.provenance + seriesFormat to a scalar and killing the preliminary/methodology badges (Law 9 regression)
metadata:
  type: project
---

`resolveRowLocales`/`isLocaleObject` in `packages/react/src/engine/resolveNodeRows.ts` discriminated a LocaleString by STRUCTURE only (`typeof === object && !null && !Array`). But `LocaleString {en,ka}`, `ProvenanceRecord` (DataRow.provenance), and `seriesFormat` (Record<string,string>) are ALL plain objects — structurally indistinguishable. So the resolver flattened `provenance` to `resolveLocaleString(v) = Object.values(v)[0]` (a random scalar like 'p'), so `r.provenance?.status` became undefined → `resolvePreliminary.rowIsPreliminary` never fired → preliminary/last-updated/methodology badges silently stopped (Law 9 data-integrity regression).

Fix: discriminate by FIELD IDENTITY, not shape. `NON_LOCALE_ROW_FIELDS = {'provenance','seriesFormat'}` — known carriers of non-LocaleString objects — are skipped; a genuine display LocaleString only ever enters via a `$d` join under a display attr key (label/series/…), never under a reserved key. Regression: resolveNodeRows.test.ts "provenance / seriesFormat survive (Law 9)".

**Why / How to apply:** "make illegal states unrepresentable" — when two object-typed values must be distinguished and structure can't tell them apart, discriminate by a known key/tag, never by `typeof object`. NOTE: `packages/react` is app-agnostic (no /geostat/i token) — a fitness test (`no-tenant-content.fitness.test.ts`) blocks tenant strings even in test fixtures; use a neutral name like 'StatsOffice', not 'Geostat'.
