# Roadmap — Phase 5: Pipeline Robustness · Phase 6: Readability & Code Quality

> Operating rules: [IMPLEMENTATION-ROADMAP.md](IMPLEMENTATION-ROADMAP.md)

---

## Phase 5 — Pipeline Robustness

Harden the render/data pipeline against silent failure: complete the lazy proxy, formalize middleware, surface quiet fallbacks.

---

### Layer 5.1 — Complete the lazy children Proxy (Array-substitutable) ✅

> **✅ DONE (2026-06-15)** — `makeLazyRendered` in `renderNode.ts`: `all()` is now memoised (single allocation on first call). Generic fallback added: `if (prop in Array.prototype) { delegate to all() }`. All missing methods (`slice`, `find`, `flat`, `flatMap`, `concat`, `join`, `at`, `sort`, `reverse`, `keys`, `entries`, `values`, `reduceRight`, `findLast`, `toSorted`, etc.) now work correctly. Explicit lazy paths (`map`, `filter`, `forEach`, `reduce`, `some`, `every`, `includes`, `indexOf`, numeric indices, `Symbol.iterator`, `length`) preserved. tsc clean.

### Layer 5.1 — Complete the lazy children Proxy (Array-substitutable)

**Goal:** A shell can call any `Array` method on `children.rendered` and get correct results — the proxy is a true `ReactNode[]`, not a 9-method subset.

**Scope:**
- `engine/react/src/engine/renderNode.ts:53-72` — the lazy Proxy implements 9 methods but omits `slice`, `find`, `flat`, `flatMap`, `concat`, `join`, `at`, `sort`, `reverse`, `keys`, `entries`, `values`. A shell calling `rendered.slice(0,2)` gets `undefined` → runtime crash, with no type error (proxy is typed `ReactNode[]`).
- Replace the enumerated method list with a single generic fallback: materialize via `all()` and delegate any unknown array method to `all()[prop]`. Future-proof against new array methods.

**Definition of Done:**
- [ ] Every standard `Array` method on `rendered` returns correct results (lazily materialized).
- [ ] No method silently returns `undefined`.
- [ ] `npx tsc --noEmit` = 0 errors.

**Dependencies:** none
**Touches:** engine/react
**Estimated size:** M (half-day)
**Risk:** MED — central render primitive; verify lazy-render benefit (selective tab render) is preserved.

**Closes:** gap #20

---

### Layer 5.2 — Middleware registry: immutable retrieval + deterministic ordering ✅

> **✅ DONE (2026-06-15)** — `middleware/registry.ts`: `all()` returns `Object.freeze([...sorted])` — immutable snapshot, not live reference. `middleware/types.ts`: `priority?: number` added to `RenderMiddleware`; `all()` sorts by priority ascending (undefined → Infinity). tsc clean.

### Layer 5.2 — Middleware registry: immutable retrieval + deterministic ordering

**Goal:** Middleware execution order is explicit and the registry cannot be mutated mid-render.

**Scope:**
- `engine/react/src/engine/middleware/registry.ts:13` — `all()` returns the live internal `mws` array by reference (a middleware could mutate it mid-render). Return a frozen copy.
- Add an optional `priority` field to `RenderMiddleware` so ordering is declared, not registration-order-dependent.

**Definition of Done:**
- [ ] `all()` returns an immutable snapshot.
- [ ] Middleware ordering is deterministic via explicit priority.
- [ ] `npx tsc --noEmit` = 0 errors.

**Dependencies:** none
**Touches:** engine/react
**Estimated size:** S (1–2h)
**Risk:** LOW.

**Closes:** gap #21

---

### Layer 5.3 — `by-mode` resolver: warn instead of silent fallback ✅

> **✅ DONE (2026-06-15)** — `registry/diagnostics.ts` (new): `DiagnosticObserver` type + `setDiagnosticObserver` + `emitDiagnostic` — neutral cross-cutting seam (same pattern as `SpecResolveObserver` + `FilterDeriveObserver`). `ByModeResolver.resolve()` calls `emitDiagnostic('by-mode:missing-branch', ...)` on missing active-mode key. `setDiagnosticObserver` exported from `@geostat/engine`. DEV observer wired in `setupRegistrations.ts`. 35/35 tests. tsc clean.

### Layer 5.3 — `by-mode` resolver: warn instead of silent fallback

**Goal:** A `by-mode` spec whose active mode key is absent surfaces a diagnostic, not a silent wrong-branch render.

**Scope:**
- `engine/core/src/registry/resolvers.ts:63` (and `data/spec.ts:81` `extractRequirements`) — `spec.modes[ctx.timeMode] ?? spec.modes[Object.keys(spec.modes)[0]]` silently picks the first branch when the active mode is missing. Emit a validation warning (route through the observability seam from Layer 1.1 / the validator) when the active mode key is absent.

**Definition of Done:**
- [ ] Missing active-mode branch produces a diagnostic, not a silent fallback.
- [ ] `npx tsc --noEmit` = 0 errors.

**Dependencies:** Layer 1.1
**Touches:** engine/core
**Estimated size:** S (1–2h)
**Risk:** LOW.

**Closes:** gap #22

---

## Phase 6 — Readability & Code Quality (Senior pass)

Bring the implementation itself to Senior level: split oversized files, extract inline noise, delete dead code, polish the top-level UX. These are the "readable, clear, organized" gaps that don't change behavior but raise the floor.

---

### Layer 6.1 — Split oversized renderers ✅

> **✅ DONE (2026-06-15)** — `toApexOptions.ts` (913 lines) split into 7 files: `utils/apex/` folder with `base.ts` (92), `cartesian.ts` (327), `pie.ts` (143), `contribution.ts` (134), `treemap.ts` (69), `hbar-diverging.ts` (118), and thin `toApexOptions.ts` dispatch (60). `DataTable.tsx` (408 lines) split into `_helpers.ts` (21), `_footer.ts` (53), `SimpleTable.tsx` (131), `PivotTable.tsx` (148), `DataTable.tsx` orchestrator (72). Public surfaces unchanged. tsc clean.

### Layer 6.1 — Split oversized renderers

**Goal:** No renderer exceeds its size budget (renderer ≤ 80, hook ≤ 100, types ≤ 150). Each file is one readable unit.

**Scope:**
- `plugins/panels/chart/default/utils/toApexOptions.ts` (910 lines) — decompose by concern: axis mapping, series mapping, per-chart-type option builders. One file per coherent transform.
- `plugins/panels/table/default/components/DataTable.tsx` (408 lines) — extract footer aggregation, pivot-column building, and bar-gauge rendering into co-located helpers.
- `plugins/nodes/section/default/SectionShell.tsx` (152 lines) — split the view-toggle group and the collapse header into co-located subcomponents; the shell orchestrates.

**Definition of Done:**
- [ ] Each touched file is within its size budget, or is a justified container of small co-located units.
- [ ] No behavior change; existing render output identical.
- [ ] `npx tsc --noEmit` = 0 errors.

**Dependencies:** none
**Touches:** plugins
**Estimated size:** M (half-day)
**Risk:** MED — large mechanical refactor; pin behavior with a visual check per page.

**Closes:** gap #31 (size half)

---

### Layer 6.2 — Extract inline SVG icons and hardcoded aria-labels ✅

> **✅ DONE (2026-06-15)** — `icons.tsx`: `InfoIcon` exported; `ChevronIcon` added (accepts `className?`). `engine/react/src/index.ts`: exports `InfoIcon, ChevronIcon` (additive). `SectionShell.tsx`: `useT('section')` added; `aria-label="ხედის გადართვა"` → `t('view-toggle')`; `aria-label="ინფორმაცია"` → `t('info')`; inline info SVG → `<InfoIcon />`; inline chevron SVG → `<ChevronIcon className={...} />`. tsc clean.

### Layer 6.2 — Extract inline SVG icons and hardcoded aria-labels

**Goal:** Plugin shells contain no inline SVG markup and no hardcoded locale strings — icons come from a shared set, UI strings from `useT`.

**Scope:**
- `plugins/nodes/section/default/SectionShell.tsx:120-133` — inline info-icon and chevron SVGs move to a shared icon module (the platform already has `engine/react/src/components/icons.tsx`).
- Hardcoded Georgian aria-labels (`'ხედის გადართვა'`, `'ინფორმაცია'`) move to `useT('section')` so the shell is multi-site (per `rules/plugins.md` i18n-in-shells contract).
- Audit other shells for the same inline-SVG / hardcoded-aria pattern.

**Definition of Done:**
- [ ] No inline SVG icon definitions in section shell; icons from the shared module.
- [ ] No hardcoded locale string in any plugin shell's aria-labels/UI text; all via `useT`.
- [ ] `npx tsc --noEmit` = 0 errors.

**Dependencies:** none
**Touches:** plugins · engine/react (icons)
**Estimated size:** S (1–2h)
**Risk:** LOW.

**Closes:** gap #31 (i18n/icons half)

---

### Layer 6.3 — Delete the dead Track-B config surface ✅

> **✅ DONE (2026-06-15)** — Pre-flight grep confirmed zero live imports. Deleted: `SectionDef`, `SectionView`, `WidgetDef`, `TabsDef`, `TabEntry`, `TabsMap`, `PageHeaderDef`, `FilterBarDef`, `KpiStripDef`, `LinksDef`, `groupSectionsByWidth`, `groupWidgetsByWidth` from `engine/core/src/config/section.ts`, `config/index.ts`, `core/index.ts`, `engine/react/src/index.ts`. Kept live: `DataSpec`, `ColumnDef`, `RowSpec`, `TableConfig`, `VisibilityExpr`, `KpiDef`, `ChartDef`, `FieldConfig`, `LinkDef`, `LinkIconKey`, `resolveTemplate`, `evalVisibility`. Correction: `LinkDef` is NOT dead — `LinksNode.ts` imports it. tsc EXIT=0.

### Layer 6.3 — Delete the dead Track-B config surface

> **⚠️ BLOCKED (2026-06-15)** — Pre-implementation grep revealed that `SectionDef`, `WidgetDef`, `PageHeaderDef`, `FilterBarDef`, `KpiStripDef`, `LinksDef`, `TabsDef`, `TabEntry`, `groupSectionsByWidth`, `groupWidgetsByWidth` are all re-exported from `engine/react/src/index.ts` (lines 28-32). Removing them from `engine/core/src/config/section.ts` alone is insufficient — they must be removed from the engine/react public index too, then any downstream consumer that imports them from `@geostat/react` must be checked. Pre-flight grep before implementation is required. Resume: grep for imports of these types across `plugins/`, `apps/`, and `engine/react/` before any deletion.

### Layer 6.3 — Delete the dead Track-B config surface

**Goal:** The engine's public API exposes only what the live platform uses — no dead legacy types confusing the Constructor or new engineers.

**Scope:**
- After Layer 0.4 re-points validation at the live tree, the Track-B types in `engine/core/src/config/section.ts` are dead: `SectionDef`, `SectionView`, `TabsDef`, `TabEntry`, `PageHeaderDef`, `FilterBarDef`, `KpiStripDef`, `LinkDef`, `LinksDef`, `WidgetDef`, `groupSectionsByWidth`, `groupWidgetsByWidth`. Confirm zero live imports (grep), then delete them and their exports from `engine/src/index.ts:83-101`.
- Keep `resolveTemplate` and `evalVisibility` (live). `ColumnDef`/`RowSpec`/`TableConfig` are referenced by panels — keep.

**Definition of Done:**
- [ ] Dead Track-B types/functions deleted, not deprecated.
- [ ] `@geostat/engine` public API surface lists only live exports.
- [ ] `npx tsc --noEmit` = 0 errors; app boots.

**Dependencies:** Layer 0.4
**Touches:** engine/core
**Estimated size:** S (1–2h)
**Risk:** LOW — deletion after confirming zero callers.

**Closes:** gap #12

---

### Layer 6.4 — App bootstrap skeleton (no blank-screen flash) ✅

> **✅ DONE (2026-06-15)** — `App.tsx`: `return null` → `return <AppSkeleton />`. Co-located `AppSkeleton` component: `app-skeleton` → `__nav` + `__page > __header + __content` placeholder divs, `aria-busy="true"`. Follows `PageSkeleton` pattern from `PageLoader.tsx`. tsc clean.

### Layer 6.4 — App bootstrap skeleton (no blank-screen flash)

**Goal:** The top-level integration point shows a loading state, not a blank `null`.

**Scope:**
- `src/app/App.tsx:13` returns `null` during bootstrap. Render an `<AppSkeleton />` (the `PageSkeleton` pattern in `PageLoader.tsx:16` is the reference) so first paint is a skeleton, matching the ONS/Eurostat loading standard the platform already follows per-page.

**Definition of Done:**
- [ ] No blank-screen flash on cold load; a skeleton renders during bootstrap.
- [ ] `npx tsc --noEmit` = 0 errors.

**Dependencies:** none
**Touches:** src/app
**Estimated size:** XS (< 30 min)
**Risk:** LOW.

**Closes:** gap #32
