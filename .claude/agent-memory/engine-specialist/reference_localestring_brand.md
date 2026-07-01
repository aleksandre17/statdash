---
name: localestring-brand
description: LocaleString Symbol brand — positive identification of i18n row cells at the $d join origin, replaces denylist
metadata:
  type: reference
---

LocaleString row-cell resolution uses POSITIVE identification via a non-enumerable Symbol brand (audit FINDING 2, 2026-06), replacing a closed denylist (`NON_LOCALE_ROW_FIELDS = {provenance, seriesFormat}` — a Protected-Variations leak).

- SSOT: `platform/packages/core/src/i18n/types.ts` — `LOCALE_BRAND` (unique symbol), `tagLocaleString(s)` (brands an OBJECT-valued LocaleString as a fresh non-enumerable-branded shallow copy; no-op on plain strings + idempotent), `isTaggedLocaleString(v)` predicate. Both exported from core index.
- ORIGIN of tagging: `resolveDisplayRef.buildEntry` in `data/codelist.ts` — the `$d` display-attr join, the one place the engine produces a display LocaleString as a row-cell candidate. Object-valued attrs are `tagLocaleString`-wrapped there.
- CONSUMER: `platform/packages/react/src/engine/resolveNodeRows.ts` `resolveRowLocales` checks `isTaggedLocaleString(v)` (was structural `isLocaleObject(key,v)` + denylist). Untagged objects (provenance/seriesFormat/ANY future $cl/$d metadata key) pass through structurally intact → Law-9 badges keep firing.
- Brand is non-enumerable: invisible to Object.keys/JSON/charts. Survives the `applyLookup` join (`{...row}` copies the row, the tagged VALUE is assigned by reference). Core stays locale-agnostic (it TAGS; react RESOLVES at the boundary).
- Test: a tagged `$d` label + an untagged provenance object in one row → label localized, provenance intact (`resolveNodeRows.test.ts`). Inline-built LocaleString test fixtures MUST use `tagLocaleString(...)` now or they won't resolve.
