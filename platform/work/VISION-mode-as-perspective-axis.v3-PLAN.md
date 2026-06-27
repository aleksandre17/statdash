# VISION #3 — IMPLEMENTATION / MIGRATION PLAN (time-mode → `perspective` axis) — FINAL

> Sibling of `VISION-mode-as-perspective-axis.v3.md` (analysis + minimal design). Design-only — **zero code changed.**
> This doc: the **Strangler-Fig phase plan** (line-precise files/seams, capstone-corrected expand-contract ordering), the **fitness suite**, the **SSR-walker optimization**, the **exact P0 + P-opt starting specs**, and the **READY verdict**.
> Contract (built in P0): `PerspectiveAxis = { param, perspectives: PerspectiveDef[] }` (`perspectives[0]` = default) · `PerspectiveDef = { id, label, when?, scope:{ timeBinding, metric? } }`.
> Naming is final: `perspective` wholesale (collision-free with `node.view`, OLAP-correct). No `view`/`mode` in new identifiers.

---

## 0. DECISION — P4 byte-identical sequencing blocker (the engine-specialist escalation)

**Verdict: (A) — authorize an additive engine-binding phase (P4.5) BEFORE the config collapse.** Ground-truth-verified against source (the three reasons in P4.5's preamble: bar-scoped default gate `useFilterState.ts:104-112`; window writes `timeFrom`/`timeTo` but geostat reads `{$ctx:"fromYear"}`/`{$ctx:"toYear"}` at provisioning `:142-148`/`:1214`; no ctx-ref single-period pin at `perspective-axis-parser.ts:143-149`).

**Why (A) over (B)/(C):**
- **(A) is Strangler-Fig-canonical.** Each step is additive, byte-identical, fitness-locked, with no broken intermediate: the binding mechanism lands *alongside* the still-live legacy bars (P4.5), is proven byte-identical against them (FF-BINDING-* using a test config), THEN the config switches to it + collapses (P5), THEN P6 deletes the now-dead System A. The mechanism change and the config change are in **separate, independently-green phases**.
- **(B) rejected — it makes P6 a large atomic multi-concern change.** (B) defers the full bar-collapse + binding-transfer + System-A-delete into one P6 step: three coupled concerns (collapse the bars, transfer the binding to the engine, delete the gate/effects) land together, so there is no green intermediate where the engine binding is proven byte-identical *before* the config depends on it. That is precisely the "big atomic migration" Strangler-Fig exists to avoid (higher change-failure risk, harder bisection).
- **(C) re-scope rejected** — the blocker is real and contained; the binding is the genuine P6 end-state mechanism. Pulling it earlier (additively) is the right scope, not a reduction of it.

**Cost of (A):** one inserted engine-only phase (P4.5, three additive optional capabilities + one inert React gate branch). All three capabilities are pure expand (new optional fields / a new gate branch that is `false` for every existing config) — no contract break, fully reversible. The byte-identical guarantee holds at every commit.

**Parity behaviors preserved (structurally, asserted by FF-SNAPSHOT-VIEW-EQUIV per perspective in P4.5/P5):** full-span dynamics timeseries in `range` (via the perspective-default-gate leaving `time` unset, not a hidden bar); CAGR KPIs (read `{$ctx:"fromYear"}`/`{$ctx:"toYear"}` driven by the window `targetKeys`); single-period KPIs (read `{$ctx:"toYear"}`); regional map/sectors and accounts SNA bars (unchanged data specs; only the binding source moves bar→engine); both `ka`/`en` locales (the binding writes the same character-identical dim values the bars wrote).

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
| **FF-BINDING-PIN-CTX-REF** (P4.5) | a `timeBinding.pin:{$ctx:"<param>"}` writes `ctx.dims[dim]` = the value the legacy `pick:last` year default resolved (character-identical, both locales) | — (new engine capability) |
| **FF-BINDING-TARGET-KEYS** (P4.5) | a window with `targetKeys:{from,to}` writes those keys = legacy range-bar bounds; absent `targetKeys` writes `${dim}From`/`${dim}To` byte-for-byte | — (new engine capability) |
| **FF-PERSPECTIVE-DEFAULT-GATE** (P4.5) | in a collapsed single-bar 2-perspective page the non-active perspective's owned param does NOT resolve (range ⇒ `time` unset ⇒ full span); a no-binding page reduces to the legacy `barShowWhen` gate exactly | the bar-scoped gate (`useFilterState.ts:104-112`) |
| **FF-BINDING-ADDITIVE-IDENTITY** (P4.5) | every config with no `timeBinding` renders byte-identically through P4.5 (the engine binding is inert until opted into) | — (additivity guard) |

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

---

### ⟦P4.5 — ENGINE OWNS THE TIME BINDING (additive, byte-identical) — the inserted phase⟧

> **Why it exists (the P4 blocker the engine-specialist escalated, ground-truth-verified):** the geostat config CANNOT collapse the two filter bars into one + drop `effects` and stay byte-identical until `scope.timeBinding` can *actually own* the time binding. Today it cannot — for three independent reasons (each verified against source):
>
> 1. **The default-resolution gate is BAR-scoped** (`useFilterState.ts:104-112`): it gates default resolution on `barShowWhen` only. The two-bar split IS the byte-identical mechanism — in `range` the `year-bar` (`showWhen:{mode:{neq:range}}`, line 1201-1204) is hidden, so its `year` default (`pick:last`=2025, line 1184-1189) is **not** resolved, `ctx.dims.time` stays unset, and the dynamics timeseries renders the FULL SPAN (the parity fix). Collapse to one bar ⇒ the `year` default resolves in BOTH perspectives ⇒ `time` pinned ⇒ timeseries collapses to one year (regression). Drop `effects` ⇒ a stale `year`/`time` pin survives a switch into `range` (regression).
> 2. **The window writes the WRONG keys.** `scopeCtxByPerspective` (`perspective-axis-parser.ts:155-158`) writes `${dim}From`/`${dim}To` = `timeFrom`/`timeTo`. But the geostat range KPIs read `{$ctx:"fromYear"}`/`{$ctx:"toYear"}` (provisioning `:142-148`, the `cagr` from/to), and `context` maps `toYear→toYear` (`:1214`). A declared window would write `timeFrom`/`timeTo` — **keys nobody reads** — so the legacy `fromYear`/`toYear` bar params still do the real binding.
> 3. **No ctx-ref single-period pin.** `scopeCtxByPerspective` (`:143-149`) fires the year PIN only for a literal one-element number list; a pin whose value is a `{$ctx:"<param>"}` ref (the user-tracked `year`/`toYear` param) is unsupported. So the `year` perspective cannot declaratively pin `ctx.dims.time = <the user's tracked year>`.
>
> **Conclusion:** `scope.timeBinding` is the **P6 end-state mechanism**, but the P4 config collapse needs it byte-identical **before** P5/P6. The Strangler-Fig answer is to **land the engine binding additively, alongside the still-live legacy bars, prove it byte-identical, THEN switch the config to it (P5) and delete System A (P6).** This is **decision (A)** (see §0 below). P4.5 changes engine code ONLY; it touches no config and alters no render until a config opts in.

**The three engine capabilities (each additive, each byte-identical, each fitness-locked):**

**(a) Ctx-ref single-period PIN** — `scopeCtxByPerspective` must support a year-pin whose `range` resolves to a single period from a `{$ctx:"<param>"}` ref, writing `ctx.dims[dim]` = the resolved period.
- *Mechanism:* extend the `isYearsSpec` PIN branch (`:143-149`). Today it pins only `range.length === 1` literals. Add: when `range` is a single ctx-ref form (or `tb` carries an explicit `pin: TimeBound`), resolve it through `resolveTimeBound(bound, ctx, /*missing*/ NaN)` — the SAME ref dispatcher the legacy `{$ctx}` read used (`time-dimension.ts:57-65`). A resolved value writes `dims[dim]`; an unset/NaN resolution writes **nothing** (leaves `time` unset — the all-years path, `isUnsetTime` SSOT `:188`).
- *Byte-identity:* the `year` perspective today resolves `ctx.dims.time` from the `year` param's `pick:last` default (=2025). The pin must produce the **same** value. Because the ctx-ref reads the same param the bar populated, the pinned value === the bar value while both coexist. FF asserts the resolved `dims[dim]` is character-identical to the legacy bar-resolved value across both locales.
- *Additivity:* a `tb` with no pin form hits `continue` (`:141`/`:146` else) — identity, untouched. No config without `timeBinding.pin` is affected.

**(b) Configurable window-TARGET keys** — the window binding must write the keys the resolvers actually read (`fromYear`/`toYear`), not the hardcoded `${dim}From`/`${dim}To`.
- *Mechanism:* add an optional `targetKeys?: { from?: string; to?: string }` to the `timeBinding` (the `TimeDimensionSpec`-carrying `PerspectiveScope.timeBinding`, `perspective-axis.ts:50`). In `scopeCtxByPerspective` (`:157-158`), write `dims[tb.targetKeys?.from ?? \`${dim}From\`]` / `dims[tb.targetKeys?.to ?? \`${dim}To\`]`. Default preserves today's `${dim}From`/`${dim}To` exactly (no existing caller changes); geostat declares `targetKeys:{from:"fromYear", to:"toYear"}` so the window drives the existing `fromYear`/`toYear` resolvers.
- *Byte-identity:* the window's `[from,to]` is resolved through `effectiveBounds` (`:155`) exactly as today; only the destination key names become declarable. With `targetKeys` set to the geostat keys, the values written are character-identical to what the `fromYear`/`toYear` bar params write (both read the same `{$ctx}` source while coexisting). FF asserts `dims.fromYear`/`dims.toYear` equal the legacy bar-resolved bounds.
- *Additivity:* `targetKeys` absent ⇒ `${dim}From`/`${dim}To` ⇒ pre-P4.5 behaviour byte-for-byte. Pure expand (new optional field), no contract break.

**(c) Perspective-aware default-resolution gate** — default resolution must respect the ACTIVE perspective (a param bound only in one perspective must not resolve its default in another) WITHOUT relying on two separate bars.
- *Mechanism (Protected Variations — move the seam from bar-visibility to perspective-scope):* extend the `defaultParams` filter (`useFilterState.ts:104-112`). Today: `isAlwaysResolve(def) || !barShowWhen || evalWhen(barShowWhen, state)`. Add a **perspective-scope gate**: a param that the ACTIVE perspective's `scope.timeBinding` **owns** (the pin's source param, or a `targetKeys` destination) must resolve; a param owned by a *non-active* perspective's binding (and by no other live default) must **not** resolve its default. Concretely: thread the active `PerspectiveDef.scope.timeBinding` into `useFilterState` (it already receives the schema; add the resolved active binding), derive the set of perspective-OWNED param keys, and gate: `isAlwaysResolve(def) || perspectiveOwnsThisPerspective(key) || (!ownedByAnyPerspective(key) && (!barShowWhen || evalWhen(barShowWhen, state)))`. The bar-`showWhen` branch is preserved untouched for legacy (un-collapsed) configs; the perspective branch only governs params an active `timeBinding` references.
- *Byte-identity — the parity fix preserved STRUCTURALLY:* in the collapsed single-bar `range` perspective, the `year`/`time` param is owned by the `year` perspective's pin (not the active one) and by no live default ⇒ its default is **NOT** resolved ⇒ `ctx.dims.time` stays unset ⇒ the dynamics timeseries renders the FULL SPAN — the exact same outcome the hidden `year-bar` produces today, but driven by perspective ownership instead of bar visibility. The `range` perspective's `fromYear`/`toYear` ARE owned (via `targetKeys`) ⇒ they resolve ⇒ identical to today's range-bar. FF asserts: collapsed-bar `range` leaves `time` unset (full span) and `year` pins `time` (single year), matching the two-bar snapshots per perspective.
- *Additivity:* a config with **no** `perspectiveAxis`/`timeBinding` exercises zero perspective-owned keys ⇒ the filter reduces to today's `isAlwaysResolve || !barShowWhen || evalWhen` exactly (the perspective branches are all `false`/skipped) ⇒ byte-identical. The gate is additive and inert until a config declares a binding.

**Files (engine + the one React filter hook — no config):**
`packages/core/src/config/perspective-axis-parser.ts` (pin ctx-ref branch + `targetKeys` write) · `packages/core/src/config/perspective-axis.ts` (`targetKeys?`, optional `pin?` on the timeBinding-carrying scope) · `packages/core/src/core/time-dimension.ts` (reuse `resolveTimeBound` for the pin; possibly a thin `resolveTimePin` helper) · `packages/react/src/filters/useFilterState.ts:104-112` (perspective-scope gate — the only React touch; engine-pure `evalVisibility`/scope data threaded in).

**Fitness (P4.5 locks these — all green WITH the legacy bars AND once a config switches):**
- **FF-BINDING-PIN-CTX-REF** — a `timeBinding.pin:{$ctx:"<param>"}` writes `ctx.dims[dim]` = the same value the legacy `pick:last` year default resolved (character-identical, both locales).
- **FF-BINDING-TARGET-KEYS** — a window with `targetKeys:{from:"fromYear",to:"toYear"}` writes `dims.fromYear`/`dims.toYear` equal to the legacy range-bar bounds; absent `targetKeys` still writes `${dim}From`/`${dim}To` byte-for-byte.
- **FF-PERSPECTIVE-DEFAULT-GATE** — in a collapsed single-bar 2-perspective page, the non-active perspective's owned param does NOT resolve its default (range ⇒ `time` unset ⇒ full span); the active perspective's owned params DO. A page with no binding reduces to the legacy `barShowWhen` gate exactly.
- **FF-BINDING-ADDITIVE-IDENTITY** — every existing config (no `timeBinding`) renders byte-identically through P4.5 (the engine binding is inert until opted into).
- **FF-SNAPSHOT-VIEW-EQUIV** (carried) — stays green for the legacy two-bar config now (System A still live), AND green for the collapsed config once P5 switches to the binding.

**Exit gate:** the engine binding is available + proven byte-identical against the legacy bars (the three FFs above green using a TEST config that declares `timeBinding` alongside still-live bars), zero production config changed, the whole legacy render byte-identical (FF-BINDING-ADDITIVE-IDENTITY). Fully reversible (additive optional fields + an inert gate branch).

---

- **P5 — MIGRATE the three geostat pages (now the config can switch to the proven binding).** Rewrite gdp → accounts → regional to `perspectiveAxis` + **one collapsed filter set** + `when`-gated nodes (analysis §2.3), authoring the year perspective's `scope.timeBinding.pin:{$ctx:"<year-param>"}` and the range perspective's `scope.timeBinding.range:[{$ctx:"fromYear"},{$ctx:"toYear"}]` with `targetKeys:{from:"fromYear",to:"toYear"}` (the P4.5 capabilities). Delete each page's `effects`, second bar, dup `mode`/`measure`, `mode-bar`, `modeOrder`, `timeMode` binding; move regional `spanFrom`/`spanTo` to page-level `computed`/`vars` (drops `alwaysResolve`). Replace per-item `mode:` with `when: perspective-is` + (where measure codes differ) `scope.metric` (LOW-2; mostly a no-op — RESIDUAL 2). Gate **each page on FF-SNAPSHOT-VIEW-EQUIV** (row-identical per perspective) BEFORE proceeding to the next. Update the 3 schema page-defs (`page-config.schema.json:169,253,337`): `modeOrder` → `perspectiveAxis` (MEDIUM-2).
  *Why now:* the collapse is byte-identical because P4.5 already made the single-bar render produce the two-bar outcome per perspective (the pin === the old `year` default; `targetKeys` drive the old `fromYear`/`toYear` resolvers; the perspective-default-gate keeps `time` unset in range). The collapse is a config swap onto a proven engine seam, not a simultaneous mechanism+config change.
  *Files:* `apps/api/provisioning/geostat.provisioning.json` · `contracts/schema/page-config.schema.json`.

- **P6 — DELETE System A.** With the suite green (incl. FF-SNAPSHOT-VIEW-EQUIV on the collapsed configs): delete the **bar-visibility default gate** (`useFilterState.ts:104-112` — the `barShowWhen` branch; the perspective-scope gate from P4.5 is now the sole survivor and the SSOT for default resolution) + `alwaysResolve`, `ContextMapping.timeMode` (`filter-params.ts:293`), `BarDef.timeToggle`/`timeModes`/`TimeModeItem`, the `ctx.timeMode` field + `TimeMode` type (`context.ts:13,58`), `ScopeOverride.timeMode` (`scopeOverride.ts:31`), `ScopeOverride.compare` + `resolveCompareRows` + the `renderNode.ts:335-342` block + `RenderContext.compareRows`/`compareLabel` (RESIDUAL 1), the `KpiSpec.mode` closed union + its filters (`kpi.ts:62,221,309`), the `applyEffects` mode-clearing path (`SiteRenderer.tsx:125,175`), the `mode-bar` node, `modeOrder` handling, the `mode-*` Postel aliases. Each removal guarded green.
  *Note (P4.5 dependency):* deleting the `barShowWhen` default-gate branch is only safe AFTER P5 has migrated every page to a perspective-owned binding (so the perspective-scope gate covers what the bar gate covered). No page may still rely on bar-visibility for default suppression at P6.
  *Files:* `react/.../useFilterState.ts` · `core/config/filter-params.ts` · `core/core/context.ts` · `core/data/kpi.ts` · `core/data/scopeOverride.ts` · `react/engine/renderNode.ts` · `react/engine/SiteRenderer.tsx` · `react/engine/navUtils.ts`.

- **P-final — Constructor "Perspectives" panel.** Author `PerspectiveDef`s visually over the schema (capability-discovery win) — the positive replacement for the deleted `ByModeEditor`.

**Phase dependency:** P0→P1→P2 sequential (types → ctx slot + relax → ops + SSOT). P3 anytime after P0 (independent). P4 needs P1+P2. **P4.5 needs P4** (parser/axis types in place) — engine-only, additive, can land in parallel with P3. **P5 needs P4.5** (the config can only collapse byte-identically once the engine owns the binding). P6 needs P5 + green suite (incl. the collapsed-config FF-SNAPSHOT-VIEW-EQUIV). P-opt parallel after P2. P-final after P5.

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
