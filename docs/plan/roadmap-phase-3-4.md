# Roadmap — Phase 3: Phase-2 Readiness · Phase 4: Type Tightening

> Operating rules: [IMPLEMENTATION-ROADMAP.md](IMPLEMENTATION-ROADMAP.md)

---

## Phase 3 — Phase-2 Readiness (JSON-first datasources)

Make datasources first-class JSON: a named spec referenced by id, authored and resolved without code. This is the gate to the Constructor. Split by dependency: **define the JSON shape → reference by id → remove functions → tighten refs.**

---

### Layer 3.1 — Add `SiteManifest.datasources` as a first-class JSON spec

**Goal:** A datasource is describable as plain JSON — a named, addressable spec — before anything consumes it.

**Scope:**
- `src/data/site-manifest.ts:34-45` — `SiteManifest` has no `datasources` field, contradicting `identity.md`'s Phase-2 checklist and the file's own header comment. Add `datasources: DatasourceInstanceConfig[]` (JSON-serializable: id, kind, params — no functions).
- Define `DatasourceInstanceConfig` + a `buildStoreManifest(datasources) → Record<string, DataStore>` factory in the engine/react boundary, so `stores` is derived from JSON, not built imperatively in `fetchApi`/`fetchStatic` (site-manifest.ts:82-124).
- Round-trip fixture for the new spec.

**Definition of Done:**
- [ ] `SiteManifest.datasources` exists and is JSON-serializable; round-trip test passes.
- [ ] `buildStoreManifest()` produces the same `stores` map both phases build today.
- [ ] No consumer behavior changes yet (the field lands first, wired in 3.2).
- [ ] `npx tsc --noEmit` = 0 errors.

**Dependencies:** none
**Touches:** engine/core · engine/react · src/data
**Estimated size:** M (half-day)
**Risk:** MED — defines the Phase-2 contract; get the spec shape right (Grafana datasource provisioning model).

**Closes:** gap #18

---

### Layer 3.2 — Page configs resolve years at runtime, not module-load

**Goal:** No page config reaches into imported classifiers at import time — years come from the datasource at render, so Phase-2 API-sourced classifiers work.

**Scope:**
- `src/pages/{gdp,accounts,regional}.{config,filters,kpis}.ts` — every file computes `FIRST`/`LAST` via `codesOf(CLASSIFIERS.time)` at module-load (e.g. `gdp.config.ts:14`). This breaks when classifiers arrive from an API.
- Badge/range text (`gdp.config.ts:30` `${FIRST}–${LAST}`) becomes a template resolved at render against a datasource-provided year range, or a `years: { $cl: 'time' }` reference (already supported for filter options — `gdp.filters.ts:28`).
- Filter `default` values that depend on `LAST` adopt the **`DefaultSpec` three-tier model** (harvested from `docs/architecture/subsystems/23-defaults-system.md` + `examples/defaults.md` — fully designed, never implemented; current code is flat `default: string`):
  ```ts
  type DefaultSpec =
    | DimVal                                              // Tier 1 literal (today's behavior — backward-compatible)
    | ExprVal                                             // Tier 2 expression, e.g. { op:'subtract', left:{$ctx:'year'}, right:4 }
    | { from: 'options'; pick: 'first' | 'last'; field?: string }  // Tier 3 from options data
  ```
  Resolution: two-pass (`resolveDefaults` before effects, second pass for keys effects set to `null`) · topological sort for Tier-2 `{ $ctx }` refs · `validateCascadeValues` clears stale cascade values structurally (no `{ op:'changed' }` needed). `LAST`-dependent year defaults become `{ from:'options', pick:'last' }`.

**Why this matters beyond gap #5:** it also closes the cascade-reset and computed-default cases the current flat `default: string` cannot express (parent change → child resets to first valid option) — a Constructor-grade defaults system, all plain JSON.

**Definition of Done:**
- [ ] No `codesOf(...)` call at module top-level in any page config.
- [ ] Year range in badges/defaults resolves at render from the datasource.
- [ ] All pages boot and render identical content.
- [ ] `npx tsc --noEmit` = 0 errors.

**Dependencies:** Layer 3.1
**Touches:** src/pages · engine/core (if a runtime year-range helper is needed)
**Estimated size:** M (half-day)
**Risk:** MED — touches all live pages; verify badge text and default-year selection per page.

**Closes:** gap #5

---

### Layer 3.3 — Remove functions from config (DataSpec.custom + filter validators)

**Goal:** No config type can carry a function — every config is pure JSON, Constructor-authorable.

**Scope:**
- `engine/core/src/config/section.ts:109` — delete `DataSpec.custom { fn }`. Its resolver (`registry/resolvers.ts:282 CustomResolver`) and the `DEPRECATED_CUSTOM_FN` validator warning go with it. Escape-hatch becomes a registered `SpecResolver` (a named, registered unit — not an inline fn).
- `engine/core/src/config/filter.ts` — `Validator.test` (line 84), `CrossValidator.test`/function-`message` (line 109), `Effect.set` function variant (line 129) carry raw functions. Replace with declarative predicates reusing the existing `Condition`/`WhenMap` vocabulary; `Effect.set` values become string templates only.
- Confirm zero call sites rely on the function forms (grep first; migrate any that do).

**Definition of Done:**
- [ ] No function-valued field in any `DataSpec` or filter config type.
- [ ] Escape-hatch specs go through `registerSpec`, not inline `fn`.
- [ ] Serialization invariant holds for every filter schema and data spec.
- [ ] `npx tsc --noEmit` = 0 errors.

**Dependencies:** Layer 0.2 (registry-driven spec validation)
**Touches:** engine/core · src
**Estimated size:** M (half-day)
**Risk:** MED — `Validator`/`Effect` functions may have live call sites; declarative replacements must cover them. Split further if any single replacement is non-trivial.

**Closes:** gap #3, #4

---

### Layer 3.4 — `FilterDerive` source: refs only, inline arrays flagged

**Goal:** Derive sources reference data by `{ $cl }` / `{ $d }` — they never embed imported JS arrays that couple config to compiled data.

**Scope:**
- `engine/core/src/config/filter.ts:417,427,436` — `FilterDerive.source: DimRef | readonly Record[]`. The inline-array branch (the file admits "Phase 1: source/tree are JS object references") couples config to imported data. Keep inline arrays working for Phase 1, but add a validator warning when an inline array is present, and document the Constructor path as ref-only.

**Definition of Done:**
- [ ] Inline-array `source` produces a Constructor-visible warning (Phase-2-incompatible).
- [ ] Ref-based sources (`{ $cl }` / `{ $d }`) are the documented canonical form.
- [ ] `npx tsc --noEmit` = 0 errors.

**Dependencies:** Layer 0.4 (validation reaches the live tree)
**Touches:** engine/core
**Estimated size:** S (1–2h)
**Risk:** LOW — additive warning; no behavior removed.

**Closes:** gap #25

---

## Phase 4 — Type Tightening

Close the remaining type holes and remove unsafe casts. With the architecture JSON-first and pure, these are focused, low-risk hardening passes.

---

### Layer 4.1 — `LocaleString` sweep across user-visible label fields

**Goal:** Every user-visible label field accepts `LocaleString`, so the Constructor can author bilingual content and multi-site deployments translate cleanly.

**Scope:**
- Widen `string` → `LocaleString` on: `ColumnDef.label`, `RowSpec.label`, `SectionView.subtitle` (`config/section.ts`); `PageHeaderDef.title`/`badge`; `ParamMeta.label`/`suffix`/`hint`, `Validator.message`, `CrossValidator.message` (`config/filter.ts`).
- Resolve at the render boundary via `useResolveLocale()` (already exists, `SiteContext.tsx:197`). `string ∈ LocaleString` keeps existing single-locale configs valid (backward-compatible).

**Definition of Done:**
- [ ] Listed fields accept `LocaleString`; existing plain-string configs still compile.
- [ ] Shells resolve these via `useResolveLocale()`, not raw string access.
- [ ] `npx tsc --noEmit` = 0 errors.

**Dependencies:** Phase 2 (stable types to widen)
**Touches:** engine/core · plugins · src
**Estimated size:** M (half-day)
**Risk:** MED — wide field list; lean on tsc to find every consumer that reads the field raw.

**Closes:** gap #7

---

### Layer 4.2 — `Unit` open type

**Goal:** A new unit (EUR, THOU_GEL) needs zero `engine/core` change.

**Scope:**
- `engine/core/src/core/context.ts:17` — `Unit = 'MLN_GEL' | 'PCT' | 'USD' | 'GEL'` → `type Unit = string` (open, agnostic). Units are data, not an engine-owned enum.

**Definition of Done:**
- [ ] `Unit` is open; adding a unit requires no engine edit.
- [ ] `npx tsc --noEmit` = 0 errors.

**Dependencies:** none
**Touches:** engine/core
**Estimated size:** XS (< 30 min)
**Risk:** LOW.

**Closes:** gap #6

---

### Layer 4.3 — Remove `as Record<string, any>` classifier casts

**Goal:** Classifier maps flow to `ExternalStore` with their real types — no `any` escape at the adapter boundary.

**Scope:**
- `src/data/gdp/store.ts:16,18` and `src/data/site-manifest.ts:114,119` cast `GDP_CLASSIFIERS as Record<string, any>`. Align `ExternalStoreOptions.classifiers` (`data/store.ts:391`) to accept the actual classifier map type so the cast (and the eslint-disable) disappears.

**Definition of Done:**
- [ ] No `as Record<string, any>` at the store-construction boundary.
- [ ] No `eslint-disable @typescript-eslint/no-explicit-any` for these lines.
- [ ] `npx tsc --noEmit` = 0 errors.

**Dependencies:** none
**Touches:** engine/core · src/data
**Estimated size:** S (1–2h)
**Risk:** LOW — type alignment.

**Closes:** gap #10

---

### Layer 4.4 — Typed `EventBus` default + typed `NodeRegistry` children

**Goal:** No `any` defaults in core registry/bus generics.

**Scope:**
- `engine/react/src/events/EventBus.ts:31` — `EventBus<TMap = Record<string, any>>` → require the generic (or default to `GeostatEventMap`-style typed map), so `new EventBus()` is never fully untyped.
- `engine/react/src/engine/NodeRegistry.ts:31,62` — `AnyRenderer`'s `def: any` / `children: any` → type `children` as `ChildrenArg` and `def` via the generic `T`, restoring the registration-time contract check.

**Definition of Done:**
- [ ] No `any` in `EventBus` default or `NodeRegistry.register` signature.
- [ ] `npx tsc --noEmit` = 0 errors.

**Dependencies:** none
**Touches:** engine/react
**Estimated size:** S (1–2h)
**Risk:** LOW.

**Closes:** gap #13, #14

---

### Layer 4.5 — Clarify the `RenderContext` config-vs-runtime boundary

**Goal:** It is explicit which parts of `RenderContext` are runtime services (functions) and which are serializable — so no one mistakes ctx for config.

**Scope:**
- `engine/react/src/engine/types.ts:181-219` — `RenderContext` carries `set`, `resolveLinks`, `renderNode` functions alongside data. Document (and, if cheap, type-split) the runtime-services subset from the serializable subset, so the ctx/config seam is unambiguous. No runtime behavior change — this is a clarity/contract gap.

**Definition of Done:**
- [ ] The function-carrying members of `RenderContext` are clearly separated/documented from data members.
- [ ] `npx tsc --noEmit` = 0 errors.

**Dependencies:** none
**Touches:** engine/react
**Estimated size:** S (1–2h)
**Risk:** LOW — documentation/typing only.

**Closes:** gap #19
