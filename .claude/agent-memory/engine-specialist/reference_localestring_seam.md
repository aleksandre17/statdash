---
name: localestring-seam
description: LocaleString handling across the engine — the row-cell brand (positive ID at the $d join) and the display-template funnel (resolveTemplate) that resolves it at every render boundary. CONSOLIDATED from 2 sibling files.
metadata:
  type: reference
---

Two distinct LocaleString concerns; don't conflate.

## 1. Row-cell brand (data-cell path)
LocaleString row-cell resolution uses POSITIVE identification via a non-enumerable Symbol brand (replacing a closed denylist, which was a Protected-Variations leak).
- SSOT: `packages/core/src/i18n/types.ts` — `LOCALE_BRAND` (unique symbol), `tagLocaleString(s)` (brands an OBJECT-valued LocaleString as a fresh non-enumerable-branded shallow copy; no-op on plain strings + idempotent), `isTaggedLocaleString(v)`.
- ORIGIN of tagging: `resolveDisplayRef.buildEntry` in `data/codelist.ts` — the `$d` display-attr join, the ONE place the engine produces a display LocaleString as a row-cell candidate.
- CONSUMER: `packages/react/src/engine/resolveNodeRows.ts` `resolveRowLocales` checks `isTaggedLocaleString(v)`. Untagged objects (provenance/seriesFormat/any future metadata key) pass through structurally intact.
- Brand is non-enumerable (invisible to Object.keys/JSON/charts), survives the `applyLookup` join (value assigned by reference). Core TAGS; react RESOLVES at the boundary. Inline-built LocaleString test fixtures MUST use `tagLocaleString(...)` or they won't resolve.

## 2. Display-template funnel (boundary path)
DISPLAY-side resolution (title/label/unit/crumbs — distinct from the row-cell path above).
- SSOT funnel: `resolveTemplate` (`packages/core/src/config/template.ts`). Two declarative steps: (1) collapse the **carrier** to one string — `string` passthrough, `{year,range}` perspective union (discriminated by ENGINE keys `'year' in tpl && 'range' in tpl`, never locale literals — Law 1), else a `LocaleString` resolved via `ctx.locale`; (2) expand `{key}` vars — a substituted var value that is itself a LocaleString is `resolveLocaleString`'d, NOT `String()`-flattened to `[object Object]`. Idempotent/passthrough for an already-resolved string.
- React seam: `resolveNodeTemplate`/`useNodeTemplate` accept `LocaleString | {year,range}` and delegate to resolveTemplate.
- PERMANENT GUARD: `apps/geostat/src/data/localeString-render-guard.fitness.test.tsx` renders every page × locale × perspective, fails on (1) console.error "not valid as a React child" or (2) "[object Object]" in textContent. Does NOT key off generic "shell crashed" — a jsdom `Worker is not defined` (geograph map) is a shell crash but NOT a LocaleString defect (false positive).
- geostat render fitnesses resolve workspace pkgs to TS SOURCE (vitest `conditions:['source',...]`) — no rebuild needed to see edits. Mocks of `@statdash/react` in shell unit tests must add `useResolveLocale` when a shell starts importing it.

**How to apply:** a new render boundary that surfaces a LocaleString field (title, label, unit, badge, tooltip) must route through `resolveTemplate`/`useNodeTemplate` — never `String()` or pass the raw bag to a React child. A new row-cell producing an object-valued display attribute must go through `resolveDisplayRef`/`tagLocaleString`, never a hand-rolled locale object.
