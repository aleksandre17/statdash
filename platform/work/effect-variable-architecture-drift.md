# Effect / Variable Architecture — Drift Investigation (engine/data-core domain)

Author: engine-specialist · READ-ONLY audit · scope: `platform/packages/{expr,core,react}`

---

## TL;DR verdict

The owner remembers **three distinct mechanisms fused in memory as one "effect/variable" system**. Two are alive and
*expanded*; only one was retired — and the retired one was **never a rendering mechanism** and was already a caller-less
no-op before deletion. **Conditional / logic-driven rendering is fully intact and heavily used.** The genuine loss is a
narrow, orphaned *filter-side-effect* capability with zero user-visible footprint. Net verdict: **the conditional-render
pipeline did NOT diverge; it was renamed (mode→perspective, effect→visibleWhen). No visual symptom in the screenshots is
attributable to a lost effect/variable capability.**

---

## (a) What the effect/variable architecture actually was

Three separate engine subsystems, easily conflated:

1. **Variables ("derived state")** — page/node-level derived values.
   - `VarMap` (`PageConfig.vars` / node `vars`) = `Record<key, FilterDerive | ExprVal>` — `core/config/filter-derive.ts`.
   - `FilterDerive` ops: `lookup · find · tree-field · if-else · breadcrumbs · contains · join-labels` (data-aware),
     plus pure `@statdash/expr` `ExprVal` (`if/eq/in/and/or/template/concat/math/coalesce/collection`).
   - `evalNodeDerive` (`core/core/evalNodeDerive.ts`) + `NodeDeriveMap` with data-lookup ops (`tree-field`, `map-field`)
     that hit `interpretSpec`. Each entry is visible to later entries via `{$derived:key}`. Accessible in every renderer as
     `ctx.vars`. **This IS the "variables" the owner recalls. It is alive and used** (geostat: 3 `vars`, 7 `derive`).
   - Commercial lineage documented in-source: Grafana template variables · Retool computed state · Power BI measures.

2. **Conditional rendering ("show X when Y")** — the boolean visibility engine.
   - `VisibilityExpr` (`core/config/visibility.ts`): `eq · neq · in · isset · and · or · not` + the canonical
     perspective-axis ops `perspective-is · perspective-in · perspective-not`.
   - Evaluated by `evalVisibility(expr, filterParams, perspectiveState)`.
   - Consumed at `renderNode.ts` step 0.5 (`node.view.visibleWhen`), at the SSR/warm walkers
     (`targets/visibilityGate.ts` — the single replicated gate), and at the KPI layer (`KpiSpec.when` → shared
     `kpiVisible` in `core/data/kpi.ts`).
   - Filter-control conditionals: `ParamDef.showWhen / enableWhen` via `WhenMap`/`evalWhen` (`filter-condition.ts`,
     `filter-eval.ts`). Authoring-form field conditionals: `PropField.showWhen` via `evalShowWhen` (`prop-visibility.ts`).
   - **This IS the "things change based on conditions" the owner recalls. Alive and heavily used** (geostat: 21
     `visibleWhen`, 41 `perspective-is`, 3 `perspective-bar`).

3. **Effects ("reactive filter mutation")** — the ONE thing retired.
   - Was `Effect = { when: WhenMap; set: Record<string,string> }` + `applyEffects(...)` in `filter-validator.ts`.
   - Semantics: when a filter value changed and `when` passed, `set` mutations were written atomically (e.g. change
     `region` → auto-reset `city`). Lineage: Grafana chained variables · AppSmith/Retool onChange handlers.
   - Threaded through `FilterSchemaInput.effects`, `FiltersCtx.effects`, `RenderContext.effects`, `useFilterState`.
   - **This was a filter-STATE-mutation mechanism, not a rendering mechanism.** It changed *values*, never decided
     *what renders*.

---

## (b) Retirement / refactor history

- **Commit `4ccd042`, 2026-06-27** — `refactor(perspective): retire orphaned effects subsystem…` (audit item MED-1).
- **Why:** perspective-axis work item P6 (`5e281e4`) deleted System A, whose mode-clearing was the *only* caller of
  `applyEffects`. That left a generic mechanism with **zero consumers** — a declared `filterSchema.effects` did nothing
  (silent no-op footgun). Same judgment that earlier removed `ScopeOverride.compare`.
- **What was removed at root:** `Effect` type, `applyEffects`, `FilterSchemaInput.effects?`, `FiltersCtx.effects`,
  `RenderContext`/`StaticRenderContext.effects`, `useFilterState` return + `NO_EFFECTS`, all barrels, 13 test contexts.
- **Retirement lock:** two `check_ts "Retired:"` grep guards in `ops/scripts/check-laws.sh` (scanning engine + react
  `src` for `applyEffects\|Effect\[\]\|\.effects\b`) so it cannot silently return.
- **Replacement:** none — deliberately, because it had no consumers. Legacy `effects` JSON survives only in
  `apps/api` migration fixtures (`legacy-filter-schemas.ts`) + `perspective-migration-equiv.fitness.test.ts`, which asserts
  the migration STRIPS effects. The *rendering* concern effects were once (mis)associated with had already migrated to
  `visibleWhen`/`perspective-is` (the `mode:'year'|'range'|'both'` KPI union → `KpiSpec.when` VisibilityExpr).

---

## (c) Present vs lost capability

| Capability | Status | Mechanism today |
|---|---|---|
| Derived page/node variables | **Present, expanded** | `VarMap`, `FilterDerive`, `evalNodeDerive`, `ctx.vars` |
| Conditional node rendering | **Present, richer** | `VisibilityExpr` / `view.visibleWhen` at `renderNode` + SSR walkers |
| Conditional KPI cards | **Present** | `KpiSpec.when` → shared `kpiVisible` (warm===render SSOT) |
| Filter control show/enable | **Present** | `ParamDef.showWhen/enableWhen`, `WhenMap`/`evalWhen` |
| Perspective/mode-driven swaps | **Present** | `perspective-is/-in/-not` against `ctx.perspectiveState` |
| Stale cascade-child reset | **Present** | `ParamCascade` + `validateCascadeValues` (targeted) |
| **Reactive cross-filter mutation** (change A → auto-set arbitrary B) | **LOST** | none (was `Effect`; orphaned before deletion) |

The **only** lost capability is generic declarative reactive filter mutation. It was already dead code at deletion time
(no caller since P6), so nothing that was *working* was removed. The specific real-world use (child value invalidation on
parent change) is still covered by cascade params + `validateCascadeValues`.

---

## (d) Drift verdict

**The owner is partially right about a rename, wrong about a capability loss in the render path.**

- Conditional / logic-driven rendering did **not** drift away — it consolidated onto `VisibilityExpr` +
  `perspectiveState`, which is *more* capable and Constructor-authorable (the panel exposes it via
  `features/visibility/*` and `PerspectiveDefEditor`). If anything the naming drifted: `mode-*` → `perspective-*`,
  `KpiSpec.mode` union → `KpiSpec.when`, ad-hoc effect-clearing → declarative visibility.
- What genuinely disappeared is the *effect* (filter-mutation) axis — but that is orthogonal to rendering and was inert.
- The likely source of the owner's unease: they remember authoring `effects`/`mode` and now find those tokens gone,
  and mentally attach that to any perceived render change. The render capability is intact; the vocabulary moved.

---

## (e) Visual evidence in the screenshots

The screenshots are **positive evidence that conditional rendering works**, not evidence of loss:

- `img.png` (**დინამიკა / dynamics** perspective active): KPI strip shows growth/CAGR cards, a **range** selector
  (2010–2024), region table + growth bar chart + stacked-area historical series.
- `img_1.png` (**წლიური / annual** perspective active): a *different* KPI set (annual level, +15.1%, per-capita, 10.7%
  avg), a **single-year + "all regions"** filter, and a *different* visual set (map + donut + horizontal bar).
- `img_2.png` / `img_3.png` (GDP page, annual vs dynamics): again distinct KPI cards, distinct filter shape (single-year
  vs from/to range), distinct chart panels per perspective.

This is exactly `perspective-is` / `visibleWhen` / `KpiSpec.when` swapping nodes, KPIs and filter bars live. **Nothing
static that ought to be dynamic is visible; no toggle-driven region is frozen.** There is **no visual symptom traceable to
the retired effect/variable code.** Any visual drift the broader audit senses (theme, spacing, table alignment, choropleth
color) lives in the styling/plugin layer, not the conditional-render engine.

---

## (f) Recommendation

**Conditional rendering: already-fine — no restoration needed.** The `visibleWhen`/`VisibilityExpr`/`perspective`
engine is the correct, Constructor-ready home; leave it.

**Effects: do NOT resurrect the old orphaned `Effect` type.** If a *reactive cross-filter cascade* (change filter A →
declaratively reset/derive filter B) is genuinely wanted as a Constructor capability, re-express it forward as a
declarative `ParamDef.onChange` reset/derive rule that reuses `WhenMap` + `FilterDerive` — a net-new, schema-browsable
capability (OCP: new discriminant), **not** a revival of the deleted no-op. That is a DataSpec/filter-schema shape
decision → **escalate to the architect (Opus)** before any engine change.

**For the broader visual-drift audit:** rule the engine/data-core OUT as a cause. The effect/variable retirement is
clean, locked by `check-laws.sh`, and byte-neutral to rendering. Point the visual investigation at
`packages/styles` + `packages/plugins` (theme tokens, panel CSS), not the interpret/render pipeline.

---

# ADDENDUM — Old static-data / static-render files: what we lost + the real regression

Follow-up: dug the *old git version* for the "static data files + static rendering files" the owner recalls. Found them,
and found the actual regression cluster — which is **NOT** the effect/variable story above. It is the **static → async**
data migration.

## What we had (initial commit `191bc0e`, fully-static geostat)

`apps/geostat/src/data/{gdp,accounts,regional}/` each carried a **static triad**:
- `raw.ts`  — the observations **baked into the app** as a TS module (the "static data files").
- `adapter.ts` — `fromSDMX`-style adapter (raw → `DataRow[]`).
- `store.ts` — a **synchronous in-memory `DataStore`**.

Plus static config modules: `site-config.ts`, `site-manifest.ts`, `store-manifest.ts`, `pages/registry.ts`,
`nav.config.ts`, `chrome-config.ts`. Rendering was **fully synchronous**: `store.querySync` always answered, every panel
had its data at first paint — **no loading state, no Suspense, no warm/SSR pass**.

## What we migrated to

`apps/api` provisioning (page config served as JSON over HTTP) + `ApiStore` (`caps.sync=false`, async) + `CachedStore`
(Cache-Aside) + the **static-render / SSR walkers** in `packages/react/src/engine/targets/`
(`warm.ts`, `api.ts`, `buildStaticContext.ts`, `html.tsx`, `nodeWalk.ts`, `visibilityGate.ts`). **The old
`apps/geostat/src/data/*/` triads are DELETED** — geostat no longer ships baked data; it is API-driven end to end.

## What we lost + what caused the regression (all empirically confirmed on the live deploy)

The lost primitive is the **synchronous, always-available store**. A static in-memory store answers `querySync` cold; the
async `ApiStore` **throws** on cold `querySync`. Every downstream break flows from that one property change:

| Commit | Regression (live symptom) | Cause |
|---|---|---|
| `5881a5b` | **Every** chart/table/KPI rendered **EMPTY** on the live deploy (`ApiStore.querySync called cold` → NodeErrorBoundary) | `CachedStore` hardcoded `caps.sync=true` over an async source + `renderNode` resolved sync-only, never warming |
| `ba9d1a9` | yoy / comparison KPIs blank | warm set omitted the `t-1` comparison year → cold `querySync` crash |
| `aa1c41d` | KPI/panel values wrong/empty | time-pins not scoped on the async `ApiStore` |
| `8d882de` | the **`static` data-source KIND itself was lost** (de-tenanting shipped only `stats`; static fragmented, `href` rotted into a ghost) — had to be **restored** as a registered store kind |

Net: the migration traded *first-paint-complete synchronous rendering* for a **warm/Suspense/Cache-Aside pipeline that had
to be rebuilt piece by piece**, and each missing piece surfaced as empty panels in production. The fixes landed
(Cache-Aside `CachedStore`, `useNodeRows` warm→sync read, `extractKpiRequirements` covering comparison years,
`visibilityGate.ts` keeping warm===render), so the cluster is **resolved today** — but it left a **standing regression
vector**, not a one-time bug.

## Implication for "loading up new features going forward"

The async store makes the render pipeline **contract-bound** in a way the old static store never was. Any NEW
data-reading feature MUST:
1. **Register its reads** in `extractRequirements` (DataSpec) / `extractKpiRequirements` (KPI) — or it **cold-crashes /
   renders empty** on the async `ApiStore` (exactly the `ba9d1a9` failure mode). This is the #1 recurring trap.
2. **Honour the visibility gate** so `warm === render` (only the active perspective's slices warm — `visibilityGate.ts` is
   the single replicated gate; a new node type that bypasses it either over-warms or cold-crashes).
3. Prefer the **restored `static` kind** (`datasources/static-registrations.ts`) for fixtures / Constructor preview /
   offline — it is a zero-network `ExternalStore` and byte-identical to the sync path, giving back the old
   "everything present at first paint" behaviour where data can be baked.

**Verdict on this axis:** the owner is right that a regression happened at the static→async boundary — but it was a
*data-availability / render-timing* regression (empty panels from cold `querySync`), already fixed, distinct from the
effect/variable story. The residual risk is architectural discipline: the async pipeline will re-regress on any new
feature that forgets steps 1–2. Recommend a fitness guard asserting every registered node/KPI spec contributes to the
warm set (make the requirement contract enforced, not conventional) before the next feature wave — escalate that
DataStore/warm-contract shape to the architect.
