---
name: localestring-compose-boundary
description: "[object Object]" leaks — LocaleString String()-flattened OUTSIDE the row-cell resolve boundary (template/concat pipeline ops, resolveOptions, hardcoded-en table headers); fix = compose-preserving-tag in core + resolve at React shells
metadata:
  type: project
---

Follow-up to [[localestring-structural-flatten]]. After display labels became real bilingual
LocaleStrings carried end-to-end, `[object Object]` rendered on the LIVE site at every render
point OUTSIDE `resolveNodeRows`/`resolveRowLocales` (which only resolves TAGGED row cells):

ROOT CAUSES (all the same class — `String(LocaleString)` in the locale-agnostic engine):
1. **`applyTemplate` / `applyConcat`** (`core/data/transform/steps.ts`): `{label} ({measure})`
   did `String(row[f])` → baked `"[object Object]"` into the label DURING the pipeline, BEFORE
   the React boundary, AND destroyed the tag so resolveRowLocales had nothing to resolve. This fed
   BOTH the chart category-axis labels (`uniqueLabels`→`r.label`) AND the table row `<th>` on
   `/accounts` (the worst leak: 318 hits). The accounts query spec's pipe ends in a `template` op.
2. **`resolveOptions` / `resolveChips`** (`core/data/resolve.ts`): `String(o[labelField])` flattened
   the bilingual `$d`-classifier label → filter dropdown `<option>[object Object]` on accounts
   (`account` select) + regional (`sector` select).
3. **`SimpleTable`/`PivotTable`** col headers used hardcoded `resolveLocaleString(col.label,'en','en')`
   — not a flatten but a locale-correctness bug (English in ka). Same anti-pattern (engine picks a locale).

CANONICAL FIX (core stays locale-AGNOSTIC but locale-CORRECT; React resolves — Law 1):
- New `composeLocale(operands, render)` + `localeKeysOf` in `core/i18n/types.ts`: when any operand
  is a tagged LocaleString, compose the result PER LOCALE and re-tag (`{en:'GDP (B1)',ka:'მშპ (B1)'}`)
  so it flows through resolveRowLocales like any `$d` label; all-scalar → plain string (byte-identical).
  `applyTemplate`/`applyConcat` rewritten to use it.
- `resolveOptions`/`resolveChips` now carry the label as `LocaleString` (typed; `optionLabel()` keeps a
  tagged object intact, coerces scalars). `SelectOption.label`/`ChipOption.label` retyped `LocaleString`.
- React shells resolve at the boundary via `useResolveLocaleSafe()`: `SelectShell`, `MultiSelectShell`,
  `CascadeSelect` (react), and `DataTable` (resolves `colLabel`+`col.label` once, passes strings to
  Simple/PivotTable → removed the hardcoded 'en'). `RowListResolver` now tags instead of flattening.

VERIFY: extended probe `/tmp/objobj-probe.js` on geostat-deploy walks every text node/attr/svg, opens
filter dropdowns, both modes — run via `docker run --network statdash-net mcr.microsoft.com/playwright`
(BASE=http://statdash-geostat). Post-fix: total=0 in BOTH ka+en across landing/gdp/accounts/regional.
Regression: `core/src/i18n/compose-locale.test.ts` (8 tests). 1077 core+react+charts+plugins green.

FLAGGED (same-class, lower-priority, NOT yet fixed): `sort`/comparison ops `String(LocaleString)`
.localeCompare → a bilingual `by:'label'` sort compares all as "[object Object]" (no real ordering,
not a visible leak). Fix later by sorting on a resolved/scalar key.

**Why/how to apply:** the i18n boundary is POSITIONAL — any place that `String()`s or COMBINES a cell
into text must either (a) be at/after the React resolve boundary, or (b) preserve+re-tag the LocaleString
(composeLocale). Never let the engine pick a locale (Law 1) and never flatten before React. When adding a
new pipeline op or a new label-bearing render surface, route it through composeLocale (compose) or
useResolveLocaleSafe (render).
