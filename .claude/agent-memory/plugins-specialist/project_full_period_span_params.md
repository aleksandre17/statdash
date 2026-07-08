---
name: full-period-span-params
description: spanFrom/spanTo are the codebase's full-data-span time-ref convention for YEAR-perspective KPIs (alwaysResolve, resolve in every perspective) — distinct from range-only fromYear/toYear
metadata:
  type: project
---

Authoring a KPI that must span the FULL data history (first available year → latest
year) in the geostat provisioning: use the `spanFrom` / `spanTo` params, NOT
`fromYear` / `toYear`.

- `spanFrom` / `spanTo` = `type:hidden`, **`alwaysResolve:true`**, `options.items:{$d:time}`
  sorted `asc`/`desc` with `default:{from:options,pick:first}` → data min / data max.
  `alwaysResolve` makes them resolve in EVERY perspective (the `isAlwaysResolve` gate in
  `packages/react/src/filters/useFilterState.ts` — bar-independent, hoisted out of the
  perspective-ownership default gate). So a `when: perspective-is year` KPI can reference
  `{$ctx:spanFrom}`/`{$ctx:spanTo}` and get the full span even though no range bar is shown.
- `fromYear` / `toYear` = `type:select`, `visibleWhen: perspective-is range`, NOT
  alwaysResolve → the USER-selected window, resolves ONLY in the range perspective.

This IS the answer to "how do I reference first/latest data year without hardcoding
(Law 1)". `TimeRef = number | CtxRef` (`packages/core/src/data/kpi-spec.ts`) — there is no
`$first`/`$min` op; the span-param + `$d:time` pipe is the agnostic convention.

**Empty-store test artifact:** in the jsdom render harness (`stores={{}}`) there are no
`time` dims, so `spanFrom`/`spanTo` resolve to '' and get filtered out of `ctx.dims` → a
label like `({spanFrom}–{spanTo})` renders the LITERAL token and a `cagr` computes 0. This
is EXPECTED (see [[perspective-render-validation]]), not a production bug — live it
interpolates to e.g. `(2010–2024)`. Assert the token-FREE label prefix in the yardstick.

Incident (2026-07-06, fix/regional-kpi-reconcile): regional reg-cagr-year already used
spanFrom/spanTo correctly; the "bug" report mistook the empty-store literal for a prod
defect. Real regression was only the outdated test yardstick (reg-share renamed to "Share
in GDP" per admin C2 + reg-cagr-year added). Also renamed reg-cagr-year label to admin's
"საშუალო ნომინალური ზრდა"/"Average nominal growth" (image6 #4) — which doubles as the
disambiguator from the range KPI reg-avg-growth ("Average annual growth"), killing a
shared-prefix cross-leak in the perspective partition test.
