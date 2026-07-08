---
name: effects-retirement
description: The filter-effect subsystem (Effect/applyEffects/schema.effects) is DELETED + locked by a check-laws grep guard; BRE pitfall noted
metadata:
  type: reference
---

The declarative filter-effect subsystem was retired WHOLESALE (post-perspective-axis). P6 deleted its only caller (System A's mode-clearing), leaving a caller-less mechanism where a declared `filterSchema.effects` was a SILENT no-op (footgun). Deleted at root: `Effect` type + `applyEffects` (core/config/filter-validator.ts), `FilterSchemaInput.effects?`, `FiltersCtx.effects` (react FiltersContext), `RenderContext.effects`/`StaticRenderContext.effects` + html.tsx threading, `useFilterState` return + `NO_EFFECTS`, all barrel exports. FilterBarShell only ever read `bars`. `crossValidate` / `context` / `computed` survive on FilterSchemaInput.

**Retirement lock:** `ops/scripts/check-laws.sh` (the bash law gate, twin of the no-tenant-content vitest SSOT) now has two `check_ts` "Retired:" lines greppping `$ENGINE/src` and `$REACT/src` for `applyEffects\|Effect\[\]\|\.effects\b`. This is the canonical retirement-lock mechanism here (same spirit as the perspective grep-zero acceptance — see [[project_perspective_axis]]).

**BRE gotcha (cost me a false-positive):** in GNU grep BRE, `\?` makes the PRECEDING char optional. `effects\?\s*:` matched `effect:` inside `// side-effect: ...` import comments (the `s` became optional). Dropped that alternative — a reintroduced `effects?: Effect[]` field is already caught by `Effect\[\]`. When writing grep guards here, prefer concrete tokens (`applyEffects`, `Effect\[\]`, `\.effects\b`) over `\?`/optional patterns.

Legacy `effects` JSON survives ONLY in apps/api migration fixtures (`legacy-filter-schemas.ts`) + `perspective-migration-equiv.fitness.test.ts` (asserts the migration STRIPS effects) — untyped JSON inputs, unaffected by the type deletion.
