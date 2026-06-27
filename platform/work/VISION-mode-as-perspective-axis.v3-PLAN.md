# VISION #3 — IMPLEMENTATION / MIGRATION PLAN (time-mode → `perspective` axis) — FINAL

> Sibling of `VISION-mode-as-perspective-axis.v3.md` (analysis + minimal design). Design-only — **zero code changed.**
> This doc: the **Strangler-Fig phase plan** (line-precise files/seams, capstone-corrected expand-contract ordering), the **fitness suite**, the **SSR-walker optimization**, the **exact P0 + P-opt starting specs**, and the **READY verdict**.
> Contract (built in P0): `PerspectiveAxis = { param, perspectives: PerspectiveDef[] }` (`perspectives[0]` = default) · `PerspectiveDef = { id, label, when?, scope:{ timeBinding, metric? } }`.
> Naming is final: `perspective` wholesale (collision-free with `node.view`, OLAP-correct). No `view`/`mode` in new identifiers.

---

## 1. Fitness-function suite (the invariants the migration locks)

| FF | Asserts | Fails today on |
|---|---|---|
| **FF-ONE-VIEW-NO-MACHINERY** | a 0/1-perspective page touches no perspective code path (no scoping step, no `perspective-is` eval, no axis-registry lookup) | — (new property) |
| **FF-PERSPECTIVE-IS-PURE-FUNCTION** | switching the perspective param mutates/clears **no** filter key (Harel orthogonal-regions: no cross-region mutation); `(config,state)` ⇒ deterministic render | the mode-clearing `effects` (`applyEffects`) |
| **FF-NO-PER-VIEW-DUPLICATION** | no filter/section declared >once across perspectives; **and** no node both inherits `scope.metric` AND re-declares the same measurement via `value.type` (LOW-2 dual-encoding guard) | the two-bar config (dup `mode`/`measure`); per-item `mode:` partition |
| **FF-VIEW-AXIS-GENERIC (Law 1)** | no code adds a privileged `timeMode`/named-perspective field to `SectionContext`; active id is registry-resolved + generic (`perspectiveState`) | `ctx.timeMode` field |
| **FF-VIEW-SCOPE-DECLARATIVE (Law 2)** | `PerspectiveDef.scope`/`when` are pure JSON (no fn/fetch/if) | — |
| **FF-NO-BYMODE-REMNANT** | the `by-mode` discriminant, resolver, schema const, catalog/manifest entries, and the `ByModeEditor` are **absent** (grep-zero) | the whole by-mode surface (§4 analysis) |
| **FF-VIEW-ROUNDTRIP** | `PerspectiveAxis` survives `JSON.parse(JSON.stringify())` + Constructor round-trip | — (new) |
| **FF-SNAPSHOT-VIEW-EQUIV** | reframed page's `renderPageToJSON` per perspective = legacy snapshot in that mode (the P6 gate) | — (migration gate) |
| **FF-SSR-WALKER-VIEW-AWARE** | the static walkers warm only the active perspective by default; `snapshot:'all-perspectives'` unions all | the eager double-warm walkers |
| **FF-PERMALINK-FROM-REGISTRY** | the canonical URL for any `perspectiveState` is reproducible from the `PerspectiveAxis` registry alone; default perspective (`perspectives[0]`) elides its param; round-trips losslessly | — (Law-9 hole, new property) |

---

## 2. Strangler-Fig phase plan (ordered, additive, line-precise)

Each phase: additive, behind a green bar, non-breaking (Postel + expand-contract). System A (`timeMode` / `{op:eq,param:mode}` / `by-mode` / `effects`) tolerated until P6. **No phase may leave the tree un-typecheckable** — the expand-contract ordering below guarantees it.

### The expand-contract ordering (HIGH-2 — the load-bearing correction)

`ContextMapping.timeMode` is **mandatory** (`filter-params.ts:293`). You cannot migrate configs while the field is required and you cannot delete it while configs still set it. The only safe order is **relax-contract → migrate-configs → delete**:

1. **P1 RELAX** every required legacy mode-contract surface to optional + add a Postel-derive, so both old and new configs typecheck and render:
   - `ContextMapping.timeMode` → `timeMode?` (optional); derive `perspectiveState[param]` from a legacy `timeMode` binding when no `perspectiveAxis` is present.
   - `BarDef.timeToggle` / `timeModes` / `TimeModeItem` (`filter-params.ts:248-250,338`) → already optional; mark deprecated, keep reading.
   - `SiteRenderer`'s `timeModeKey` (`SiteRenderer.tsx:93`) → derive from `perspectiveAxis.param` when present, else legacy.
2. **P5 MIGRATE** the three provisioning pages to `perspectiveAxis` (they stop setting `timeMode`).
3. **P6 DELETE** the now-unused fields (`ContextMapping.timeMode`, `SectionContext.timeMode`, `timeToggle`/`timeModes`, the effects, the gate). Every removal guarded by a green suite.

No intermediate phase removes a field a sibling phase still requires → the tree typechecks at every commit.

### The phases

- **P0 — Name + ADR + registry alias + empty types (two-way door).** Ratify `perspective`/`PerspectiveDef`/`PerspectiveAxis`/`perspectiveState`. Alias `modeRegistry` → `perspectiveRegistry` (no behaviour). Land empty-shell contract types.
  *Files:* `packages/core/src/config/perspective-axis.ts` (new) · `packages/core/src/mode/registry.ts` (alias export). **Exact spec → §5.**

- **P-opt — Perspective-aware SSR walkers (two-way door, parallel after P2).** Thread active perspective id into `StaticRenderContext`; apply `evalVisibility` in both walkers before resolving; add `snapshot:'active'|'all-perspectives'`. Land **FF-SSR-WALKER-VIEW-AWARE**. **Exact spec → §6.** *Independent; lands any time after P2.*

- **P1 — `perspectiveState` slot + ctx-scoping step + RELAX (additive).** Add `ctx.perspectiveState: Record<string,string>` to `SectionContext` (`core/context.ts:57`), default empty. Keep `ctx.timeMode` as a **Postel-read alias** derived from `perspectiveState[param]` (both readable; `timeMode` not yet removed). RELAX the legacy contract surfaces per the ordering above. Add the **scope-ctx-by-active-perspective** step (apply `scope.timeBinding` + optional `metric` to `ctx.dims` before `interpretSpec`/`interpretKpi`). No `perspectiveAxis` declared ⇒ scoping is identity ⇒ **byte-identical**. Land **FF-ONE-VIEW-NO-MACHINERY** + **FF-PERSPECTIVE-IS-PURE-FUNCTION**.
  *Files:* `core/context.ts` · `data/spec.ts` (scoping hook) · `data/kpi.ts` (scoping hook) · `config/filter-params.ts` (relax `timeMode?`).

- **P2 — `perspective-is`/`perspective-in`/`perspective-not` ops + SSOT wiring + Postel alias (HIGH-3).** Add the ops to `config/visibility.ts` reading **`ctx.perspectiveState[param]`** — the ONE source. Migrate `evalVisibility`'s positional `mode?` arg to read `ctx.perspectiveState`. Postel-alias legacy `{op:'eq',param:'<param>'}` and `mode-is`/`mode-in`/`mode-not` to the new ops (kept as aliases until P6). Rewire **every** mode-reading callsite to the SSOT:
   - `renderNode.ts:229` — read `ctx.perspectiveState[param]`, not `ctx.mode.current`.
   - `targets/warm.ts` + `targets/api.ts` walkers — thread the active id, call `evalVisibility` (arrow-safe; engine-pure). *(Folds into P-opt.)*
   - `navUtils.ts:52` `getNavMode` — parse `perspective-is`/`{op:eq,param:<param>}` (the 6th site).
  *Files:* `config/visibility.ts` · `config/visibility-schemas.ts` · `react/src/engine/renderNode.ts` · `react/src/engine/navUtils.ts`.

- **P3 — DELETE `by-mode` (dead, no shim — MEDIUM-3).** Remove the whole surface: engine member (`data-spec.ts:181,128`), resolver + registration (`resolvers.ts:141-163,385,347-349`), schema const (`page-config.schema.json:69`), validation (`pipeline.ts:125`), catalog (`spec-catalog.ts:102,112`), manifest (`discriminant-manifest.ts:36`), `mode/types.ts:13` `dataKey`, metric-store union (`metric-store.ts:55-57`), the round-trip fitness case (`roundtrip-dataspec.fitness.test.ts:120,131-132,170`), **and the Constructor**: `ByModeEditor.tsx` + `.test.tsx`, `data-layer/index.ts:16`, `DataSpecEditor.tsx:14,47-48,116`, `coverage.fitness.test.ts:52,59,116`, `setupCanvasRegistry.ts:42`. Land **FF-NO-BYMODE-REMNANT** (grep-zero). *Anytime after P0; independent of the perspective spine.*

- **P4 — `perspectiveAxis` parser + legacy desugar + permalink-from-registry.** Engine reads `page.perspectiveAxis`; when absent, **derive** one from legacy `modeOrder`+`ContextMapping.timeMode`+the two `showWhen` bars so un-migrated pages render identically (Strangler). Build the registry-driven permalink (`permalinkParams` + inverse) → land **FF-PERMALINK-FROM-REGISTRY**. `perspectiveAxis.perspectives[]` array order becomes the SSOT for nav-sort (replaces `modeOrder` ranking in `navUtils:124-132`).
  *Files:* `react/src/engine/SiteRenderer.tsx` (axis read, replace `modeOrder` read `:103,145`) · `react/src/engine/navUtils.ts` (sort by perspectives[] order) · `packages/core` parser + permalink util.

- **P5 — MIGRATE the three geostat pages.** Rewrite gdp → accounts → regional to `perspectiveAxis` + one filter set + `when`-gated nodes (analysis §2.3). Delete each page's `effects`, second bar, dup `mode`/`measure`, `mode-bar`, `modeOrder`, `timeMode` binding; move regional `spanFrom`/`spanTo` to page-level `computed`/`vars` (drops `alwaysResolve`). Replace per-item `mode:` with `when: perspective-is` + `scope.metric` (LOW-2). Gate each page on **FF-SNAPSHOT-VIEW-EQUIV** (row-identical per perspective). Update the 3 schema page-defs (`page-config.schema.json:169,253,337`): `modeOrder` → `perspectiveAxis` (MEDIUM-2).
  *Files:* `apps/api/provisioning/geostat.provisioning.json` · `contracts/schema/page-config.schema.json`.

- **P6 — DELETE System A.** With the suite green: delete the bar-visibility gate + `alwaysResolve` (`useFilterState.ts`), `ContextMapping.timeMode` (`filter-params.ts:293`), `BarDef.timeToggle`/`timeModes`/`TimeModeItem`, the `ctx.timeMode` field + `TimeMode` type (`context.ts:13,58`), `ScopeOverride.timeMode` (`scopeOverride.ts:31`), the `KpiSpec.mode` closed union + its filters (`kpi.ts:62,221,309`), the `applyEffects` mode-clearing path (`SiteRenderer.tsx:125,175`), the `mode-bar` node, `modeOrder` handling, the `mode-*` Postel aliases. Each removal guarded green.
  *Files:* `react/.../useFilterState.ts` · `core/config/filter-params.ts` · `core/core/context.ts` · `core/data/kpi.ts` · `core/data/scopeOverride.ts` · `react/engine/SiteRenderer.tsx` · `react/engine/navUtils.ts`.

- **P-final — Constructor "Perspectives" panel.** Author `PerspectiveDef`s visually over the schema (capability-discovery win) — the positive replacement for the deleted `ByModeEditor`.

**Phase dependency:** P0→P1→P2 sequential (types → ctx slot + relax → ops + SSOT). P3 anytime after P0 (independent). P4 needs P1+P2. P5 needs P4. P6 needs P5 + green suite. P-opt parallel after P2. P-final after P5.

---

## 3. Optimization plan — perspective-aware SSR walkers (P-opt)

**Problem (precise):** `targets/warm.ts collectRequirements` + `targets/api.ts walkNode` recurse via `nodeWalk.collectChildNodes` and resolve/warm **every** node, ignoring `view.visibleWhen` → ~2× slices/snapshot. The live DOM does **not** have this cost (`renderNode.ts:228` gates first).

**Fix (additive, crosses no arrow):** thread the active perspective id into `StaticRenderContext` (already carries `sectionCtx`/`mode`/`timeModeKey` — see `api.ts:239`); in both walkers **apply `evalVisibility(node.view?.visibleWhen, filterParams, activePerspectiveId)` before resolving/collecting** — the *same* gate `renderNode` applies. `evalVisibility` is in `packages/core` (engine-pure) → React walkers may call it (with the arrow). Add the `snapshot` knob: `'active'` (default — gate by active perspective) vs `'all-perspectives'` (loop each `PerspectiveDef`, scope ctx per perspective, union). Optional `prefetchOtherPerspectives()` warms the inactive perspective's slices on idle (cancellable) so a switch is warm without paying up-front.

**Trade-off named:** active-only trades a one-time switch-fetch for halved warm cost — covered by CachedStore TTL + per-slice 304 + optional prefetch-on-idle. `snapshot:'all-perspectives'` preserves Law-9 completeness for self-contained exports (and shares the permalink-from-registry source — §6 analysis). ISO 25010: performance-efficiency gained, reliability (permalink completeness) preserved via the explicit policy flag.

---

## 4. Exact P0 starting spec (the first two-way-door phase)

**Goal:** land the contract + registry alias with **zero behaviour change** (pure additive; nothing reads the new types yet).

1. **New file `packages/core/src/config/perspective-axis.ts`** — the contract from analysis §3.1 verbatim (`PerspectiveAxis`, `PerspectiveDef`, `TimeBindingSpec`, reusing `LocaleString`, `VisibilityExpr`, `TimeRef`). No `default?` field (LOW-1: `perspectives[0]` is the default). Pure types, no logic.
2. **`packages/core/src/mode/registry.ts`** — add `export const perspectiveRegistry = modeRegistry` (alias the existing singleton; identical instance, zero behaviour change). Keep `modeRegistry` exported until P6.
3. **`packages/core/src/index.ts`** — export the new types + the `perspectiveRegistry` alias.
4. **ADR** — write the decision record (`perspective` naming; `ctx.perspectiveState` slot; `by-mode` deletion; expand-contract ordering; ≥2 rejected alternatives: (a) elevate privileged `timeMode`/`mode` object — rejected, relocates the smells; (b) `view` naming — rejected, collides with `node.view`).
5. **Fitness stub** — `FF-VIEW-SCOPE-DECLARATIVE` (the new types contain no functions) + `FF-VIEW-ROUNDTRIP` (the empty/sample `PerspectiveAxis` survives `JSON` round-trip).

**Exit gate:** project typechecks; new types importable; `perspectiveRegistry === modeRegistry`; the two stub FFs green. Nothing else changes. Fully reversible.

## 4b. Exact P-opt starting spec (the parallel two-way-door phase)

**Goal:** make the two SSR walkers perspective-aware (close the only real double-warm), independent of the spine — lands after P2's `evalVisibility` SSOT, can proceed in parallel with P3/P4.

1. **`StaticRenderContext`** (in `react/src/engine/targets/html.ts`) — confirm it carries the active perspective id (today `mode`/`timeModeKey`); add `snapshot?: 'active' | 'all-perspectives'` (default `'active'`).
2. **`targets/warm.ts collectRequirements`** — before `extractRequirements`, evaluate `node.view?.visibleWhen` via `evalVisibility(expr, ctx.filterParams, activePerspectiveId)`; skip an invisible node's requirements. `'all-perspectives'`: loop each `PerspectiveDef`, scope ctx, union.
3. **`targets/api.ts walkNode`** — same gate before `interpretSpec`; an invisible node yields `status:'empty'` (no resolution), matching the live DOM.
4. **Fitness** — **FF-SSR-WALKER-VIEW-AWARE**: a 2-perspective page snapshot in `'active'` resolves only active-perspective nodes; `'all-perspectives'` resolves the union; both row-identical to the live DOM in the corresponding perspective.

**Exit gate:** walker output for the active perspective is row-identical to today's live DOM render (FF-SNAPSHOT-VIEW-EQUIV precursor); `'all-perspectives'` unions correctly. Reversible (default `'active'` + the gate is purely subtractive on what was over-warming).

---

## 5. Readiness verdict

**READY TO IMPLEMENT — start P0 + P-opt.** Both are pure additive two-way doors and can run in parallel. The empirical+ground-truth pass confirms: the two hardest hypothesised residues (live double-fetch, `by-mode` data branch) are non-problems; the privileged `(d)` residue is empty; the migratable surface is fully enumerated (8 engine + 6 React + Constructor + 3 schema page-defs + provisioning JSON, §4 analysis); the contract is minimal (`timeBinding` always, `metric` per-page, rest deferred-additive), Law-1/Law-2 clean; every phase is additive + fitness-locked + non-breaking; the expand-contract ordering (relax → migrate → delete) keeps the tree typecheckable at every commit; and the permalink-from-registry innovation makes Law-9 a generated guarantee.

**Residual — CLOSED (P0, 2026-06-27). The original wording was wrong; corrected below.**

> ~~1. `scope.metric` SSOT name resolution. P5 maps the year/range KPI measurement difference onto `PerspectiveDef.scope.metric`…~~ **(superseded — see the correction.)**

1. **`scope.metric` is a measure-SWAP seam, NOT the carrier of the year↔range measurement difference (RESIDUAL 2, closed).** Ground-truth inventory of the 3 geostat pages shows year and range read the **SAME measure code** with a different KPI `value.type` (`point` ↔ `cagr`/`share`) — e.g. `gross-domestic-product-at-current-prices` is year-`point` (gdp:1311) AND range-`cagr` (gdp:1384); `GVA` is range-`cagr` AND year-`point` (regional). A `MetricDef` is a **measure** (code + unit + dims), so `scope.metric` **cannot** carry the point↔cagr *computation* difference — that lives in the node-local `value.type` (`KpiValueSpec` union, kpi.ts:38). Therefore:
   - **`scope.metric` = perspective-wide measure SWAP** — used only when year and range read *different measure codes*. In the geostat pages this is mostly a **no-op** (same code both perspectives).
   - **The real year↔range difference = `when`-gated node partition** (year KPIs vs range KPIs) **+ each node's local `value.type`** (the point↔cagr computation). This is the LOW-2 "node-local `value.type` is the single-node override" path — and here it is the **COMMON case**, not the exception.
   - **No `MetricDef` registration is a P5 gate.** Zero MetricDefs are registered in production today (`registerMetric()` is called only in tests); KPI `measure` already flows through `resolveMeasureRef` (Postel: raw code today, metric-id when registered). Registering metrics is an **optional later cleanup**, not a blocker. (RESIDUAL 2, closed read-only.)

2. **`ScopeOverride.compare` is DEAD (write-only) — scheduled for DELETION in P6 (RESIDUAL 1, closed).** `view.scope` is set by **zero** JSON configs; `ctx.compareRows`/`ctx.compareLabel` are written at `renderNode.ts:341` but **never read** by any shell/component; no test exercises `resolveCompareRows`. The provisioning `"id":"compare"` (geostat.provisioning.json:4069) is an unrelated `TimeModeItem`, not `ScopeOverride.compare`. **Do NOT delete now — P6 owns it.** Add to the P6 deletion set: `ScopeOverride.compare`, `resolveCompareRows` (resolveNodeRows.ts), the `renderNode.ts:335-342` block, `RenderContext.compareRows`/`compareLabel` (context.ts:76-78). The D-COMPARE door re-derives from a registered scope-key (SYNTHESIS §4) if ever needed — the half-built "mechanism already ships" is a liability to contain, not an asset.

Everything else is decided and ground-truth-verified. On your nod: **P0** (types + registry alias + ADR) and **P-opt** (perspective-aware walkers) begin in parallel.

*Vision #3 plan — the plan we build from.*
