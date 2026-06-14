# Roadmap — Phase 1: Engine Purity · Phase 2: Loose Coupling & DRY

> ✅ Phase 1 COMPLETE (2026-06-13) — 1.1 SpecResolveObserver seam · 1.2 locale-agnostic engine (filter.ts split + Georgian strings removed). 34/34 tests green.
> Operating rules: [IMPLEMENTATION-ROADMAP.md](IMPLEMENTATION-ROADMAP.md)

---

## Phase 1 — Engine Purity

Make `engine/core` truly agnostic: no Vite, no console coupling on the hot path, no locale-specific content. This is what lets a second agency (ENstat, ArmStat) reuse the engine unchanged.

---

### Layer 1.1 — Extract DEV logging out of `interpretSpec` into an observability seam ✅

> **✅ DONE (2026-06-13)** — `SpecResolveObserver` seam in `data/spec.ts`; `import.meta` removed; `setSpecResolveObserver` exported from `index.ts`; observer wired in `apps/geostat/src/setupRegistrations.ts` via async IIFE (zero prod cost). 34/34 tests.

**Goal:** `interpretSpec` does one thing — resolve a spec to rows. Logging is an opt-in observer the app layer wires; the engine never reads `import.meta`.

**Scope:**
- Remove the `import.meta.env?.DEV` block in `engine/core/src/data/spec.ts:34-42` (Vite API + console coupling in a zero-dep core; also an SRP breach — resolution + logging in one function).
- Introduce a tiny observer hook: `interpretSpec` calls an optional `onResolve?(tag, ctx, rows)` debug callback, registered once by the app (`src/setupRegistrations.ts`) only in dev. Engine ships callback-free.
- The `_specTag` helper (spec.ts:46) moves with the observer (it is a logging concern, not a resolution concern).

**Definition of Done:**
- [ ] No `import.meta` anywhere in `engine/core`.
- [ ] `interpretSpec` is pure resolution; logging is injected, not embedded.
- [ ] Dev console output still appears when the app registers the observer.
- [ ] `npx tsc --noEmit` = 0 errors.

**Dependencies:** none
**Touches:** engine/core · src
**Estimated size:** S (1–2h)
**Risk:** LOW — additive seam; behavior preserved behind an opt-in.

**Closes:** gap #1, #34

---

### Layer 1.2 — Locale-agnostic engine: validators, mode labels, currency

> **✅ DONE (2026-06-13)** — `filter.ts` (631 lines) split into 5 focused sub-modules + thin barrel; all Georgian validator defaults replaced with English fallbacks (`'required'`, `'allowed: …'`, `'min: N'`). `check-laws.sh` passes clean. 34/34 tests.

**Goal:** `engine/core` carries zero Georgian strings — all user-facing text originates at the app/plugin boundary.

**Scope:**
- `engine/core/src/config/filter.ts:90-98` — `validators` factories have Georgian defaults (`'სავალდებულო ველი'`, `` `მინიმუმ ${min}` ``). Make `message` a required argument (no Georgian default); Geostat messages move to `src/`. Same for `validateField` fallback (filter.ts:587).
- `engine/core/src/mode/types.ts` — `ModeDef.label` becomes `LocaleString`; Georgian labels move out of the engine. `src/setupRegistrations.ts:11-13` supplies `{ ka, en }`.
- `engine/core/src/i18n/format.ts:23` — currency fallback hardcodes 2-decimal + space separator and ignores `decimals`; use `Intl.NumberFormat` (or at minimum honor the `decimals` param) so it is genuinely locale-agnostic.

**Definition of Done:**
- [ ] No Georgian (or any locale) string literal in `engine/core`.
- [ ] Validator messages and mode labels are supplied by the app layer.
- [ ] Currency formatting respects locale + decimals.
- [ ] `npx tsc --noEmit` = 0 errors.

**Dependencies:** Phase 2 Layer 2.x not required; can land independently.
**Touches:** engine/core · src
**Estimated size:** M (half-day)
**Risk:** MED — `validators` are called from configs; ensure every call site passes a message.

**Closes:** gap #8, #9, #24

---

## Phase 2 — Loose Coupling & DRY (one structure)

Eliminate duplicated seams so the same concern has exactly one home. This is the direct answer to "the platform is not in one structure" and "layers don't understand each other" — they drift because the same logic lives twice.

---

### Layer 2.1 — Unify `EngineRow` and `RawRow` into one canonical row type

**Goal:** One name for "untyped data row" across the engine — the `as unknown as` bridges in the render pipeline disappear.

**Scope:**
- `EngineRow` (`engine/core/src/data/encoding.ts:31`) and `RawRow` (`engine/core/src/data/transform.ts:30`) are both `Record<string, DimVal>` — byte-identical, two names, two files. Collapse to one canonical type (keep one name, re-export as an alias only if a migration window needs it, then delete the alias).
- Define the relationship to `DataRow` explicitly: `DataRow` is the *structured* post-encoding row; the canonical raw row is the pre-encoding one. Document the seam in `encoding.ts`.
- Remove the `as unknown as DataRow[]` / `as unknown as RawRow[]` casts in `engine/react/src/engine/resolveNodeRows.ts:38,50` now that the types align.

**Definition of Done:**
- [ ] One canonical raw-row type; no second identical declaration.
- [ ] No `as unknown as` cast between row types in `resolveNodeRows.ts`.
- [ ] `npx tsc --noEmit` = 0 errors.

**Dependencies:** none
**Touches:** engine/core · engine/react
**Estimated size:** S (1–2h)
**Risk:** LOW — type unification; tsc guards every site.

**Closes:** gap #11, #28

---

### Layer 2.2 — `SiteRenderer` consumes `evalVarMap` (delete the duplicated loop)

**Goal:** Page-level and node-level variable evaluation use the same code — they cannot drift.

**Scope:**
- `engine/react/src/engine/SiteRenderer.tsx:118-135` hand-rolls an `ExprScope` + var-eval loop that duplicates `engine/react/src/engine/evalVarMap.ts` (whose own header says it was "extracted so both page-level and node-level can share"). The page-level caller was never migrated.
- Replace the inline loop with a call to `evalVarMap`, passing the page store + filter params. Verify the `_pageColor` / `_pageCrumbs` convention keys still resolve identically.

**Definition of Done:**
- [ ] `SiteRenderer` calls `evalVarMap`; no inline duplicate of the scope/loop.
- [ ] Page vars (`_pageColor`, `_pageCrumbs`, regional `regionObj`) resolve identically to before.
- [ ] `npx tsc --noEmit` = 0 errors.

**Dependencies:** none
**Touches:** engine/react
**Estimated size:** S (1–2h)
**Risk:** MED — central page render path; verify regional page (heaviest VarMap) renders unchanged.

**Closes:** gap #26

---

### Layer 2.3 — Honest `FilterControlSlice` codec contract

**Goal:** The codec type tells the truth — a control that clears a URL param returns `null`, and the type says so.

**Scope:**
- `engine/react/src/engine/filterControlRegistry.ts:15` — `FilterCodec.toUrl: (v: T) => string`. Every implementation (`plugins/controls/{select,cascade,hidden,multi-select}/default/index.ts`) returns `null as unknown as string` to signal "remove". Change the contract to `toUrl: (v: T) => string | null` and delete the casts.
- Audit the consumer of `toUrl` (URL-sync path) to handle `null` = delete-param explicitly.

**Definition of Done:**
- [ ] `toUrl` return type is `string | null`; no `null as unknown as string` casts in any control.
- [ ] URL sync treats `null` as param deletion explicitly.
- [ ] `npx tsc --noEmit` = 0 errors.

**Dependencies:** none
**Touches:** engine/react · plugins/controls
**Estimated size:** S (1–2h)
**Risk:** LOW — contract honesty; behavior unchanged, casts removed.

**Closes:** gap #30
