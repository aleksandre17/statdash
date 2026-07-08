# VISION #3 — time-mode → generic `perspective` axis (the analysis) — FINAL

> Status: VISION #3 — **FINAL, implementable. This is the plan we build from.** One-way-door decision, capstone-reviewed, ground-truth-verified 2026-06-27.
> Author: architect (Opus). Design-only — **zero code changed.**
> Supersedes VISION #2 (`view` naming retired) and the design intent of `VISION-mode-as-view-axis.md` (#1, the original audit/research record).
> Implementation/migration plan is the sibling doc: **`VISION-mode-as-perspective-axis.v3-PLAN.md`** (Strangler phases, fitness suite, SSR optimization, exact P0/P-opt specs).
> What #3 adds over #2: (a) the confirmed **`perspective`** naming wholesale (collision-free with the live `node.view`, OLAP-correct), (b) the capstone MUST-FIX set baked in — relaxed-contract-first expand-contract ordering (HIGH-2), the `perspectiveState ↔ evalVisibility` single SSOT with every callsite (HIGH-3), full `modeOrder` retirement (MEDIUM-2), the complete `by-mode` deletion set incl. Constructor (MEDIUM-3), corrected file paths (MEDIUM-1), one-default SSOT (LOW-1), the `scope.metric` vs `value.type` dual-encoding rule (LOW-2), (c) corrected research lineage (OLAP perspectives, not Power BI bookmarks) + the Harel orthogonal-regions invariant, (d) the **permalink-from-registry** innovation (Law-9 as a generated guarantee).

---

## 0. Executive summary

1. **The reframe is confirmed, named `perspective`, and is the IDEAL end-state — not a compromise.** A page's `mode` (year vs range) is not a privileged data dimension and not a captured snapshot. It is a **named query-perspective over the cube** — exactly an OLAP *perspective* (SSAS: a named, user-facing view over a cube subset). We model it as a first-class declarative axis: `PerspectiveAxis` + `PerspectiveDef`, with the active perspective id held in a **new generic `ctx.perspectiveState: Record<string,string>`** slot (Harel orthogonal-regions container — one axis now, multi-axis free later). Time-mode is the **first concrete instance** of a generic mechanism, never a privileged field.

2. **Ground-truth verified (2026-06-27).** Every capstone path was re-checked against the live tree; **the capstone's package locations were themselves partly wrong** and are corrected here (MEDIUM-1): the renderer/walkers/nav live in `packages/react/src/engine/**`, NOT `packages/plugins`. Corrected map in §6. Two additional System-A surfaces the capstone count missed are folded in: `data/scopeOverride.ts:31` (`ScopeOverride.timeMode` per-panel override) and `data/metric-store.ts:55` (the `by-mode` ref-union). The complete mode surface is **8 engine sites + 6 React/SiteRenderer sites + the Constructor editor + 3 schema page-defs + the provisioning JSON**.

3. **The live page is ALREADY lazy; the double-warm is SSR-walker-only.** `renderNode.ts:228-231` evaluates `migrated.view?.visibleWhen` via `evalVisibility(…, ctx.mode.current)` **before** row resolution — an inactive node never warms on the interactive page. The eager ~2× warm lives **only** in the two static SSR walkers (`engine/targets/warm.ts collectRequirements`, `engine/targets/api.ts walkNode`), which walk every node and ignore visibility entirely. `evalVisibility` is engine-pure (`packages/core`) → the React walkers may call it with the arrow. The optimization (P-opt) is a contained, additive change to two walkers.

4. **The `(d)` privileged data-branch residue is EMPTY.** Every real mode occurrence maps to (a) `scope.timeBinding` (year-pin vs from/to window), (b) a `scope.metric` swap (point ↔ CAGR/derived), or (c) `when: perspective-is` visibility. **No surviving privileged data branch** — elimination is total, not relocation.

5. **`by-mode` is DEAD relative to the real config** (0 matches in `geostat.provisioning.json`) but **alive as a whole capability surface across 8 engine + Constructor sites** (§4). Confirmed decision: **DELETE everywhere** (no shim, no half-state) — engine member + resolver + schema + validation + spec-catalog + discriminant-manifest + metric-store union + mode/types `dataKey` doc + the round-trip fitness case + the Constructor `ByModeEditor` (+ test) and its registrations. A surviving palette entry that authors an unresolvable spec is a capability-discovery violation (Law 8) and surviving legacy debt.

6. **Minimal final contract (YAGNI-bounded, OCP-additive later):**
   ```ts
   PerspectiveAxis = { param: string; perspectives: PerspectiveDef[] }   // perspectives[0] = default (one SSOT)
   PerspectiveDef  = { id: string; label: LocaleString; when?: VisibilityExpr;
                       scope: { timeBinding: TimeBindingSpec; metric?: string } }
   ```
   `store`/`dims`/`filters[]`/`blend`/`facet`/multi-axis are **documented DEFERRED additive keys — NOT built now** (§3.2). Law 1 holds (`timeBinding.dim` = generic `TIME_DIM` SSOT, no privileged field); Law 2 holds (pure JSON, no fns).

---

## 1. The reframe, grounded (research lineage — corrected)

| Source | What it contributes | Why it is the RIGHT lineage |
|---|---|---|
| **OLAP perspective / named cube query (SSAS)** | The *name* and the *concept*: a perspective is a named, user-facing view over a subset of a cube — exactly "year view" / "range view" over the same `time` dimension. | **The accurate source.** A perspective is *defined declaratively* and *re-derived from state*, not captured. This is what we are building. |
| **Vega-Lite / Elm `view = f(state)`** | The *mechanism*: the rendered artifact is a pure function of (config, active state). No imperative enter/exit. | Justifies deleting the mode-clearing `effects` — switching perspective is a state write, not a mutation cascade. |
| **Grafana `variableAdapters`** | The *registry pattern*: a perspective kind registers once; the renderer is unchanged (`modeRegistry` → `perspectiveRegistry`, OCP). | A new perspective kind = a `register()` call, zero engine edits (Law 8). |
| **Strangler-Fig** | The *migration discipline*: System A (privileged `timeMode`) and System B (generic perspective) run in parallel behind Postel aliases until A is provably dead, then A is deleted. | Every phase additive + fitness-locked + non-breaking. |
| ~~Power BI bookmarks~~ | **REJECTED as lineage.** A bookmark is a *captured snapshot* of UI state (selections, filters, visibility frozen at capture time). A perspective is the opposite: *derived from current state*, nothing captured. Citing bookmarks would mis-frame the model. |

**Named invariant (Harel statechart — orthogonal regions):** *Switching one region's state must NOT mutate another region's state.* The `perspectiveState: Record<string,string>` is the orthogonal-regions container; each key is one independent region. This is the precise reason the mode-clearing `effects` are **deleted, not refactored** — they are a cross-region mutation that violates orthogonality (clearing `year` when entering `range`). Encoded as **FF-PERSPECTIVE-IS-PURE-FUNCTION** (no cross-region mutation): switching the perspective param mutates/clears no filter key; render is a deterministic function of `(config, state)`.

---

## 2. THE CONFIG-TANGLE ANALYSIS (re-confirmed, ground-truth 2026-06-27)

> Source: `platform/apps/api/provisioning/geostat.provisioning.json` (4214 lines, 3 pages).
> Page blocks: **accounts** = L1–1240 · **gdp** = L1241–2302 · **regional** = L2303–3876.

### 2.1 The seven tangle sites (named)

**T1 — KPI strip split (`KpiSpec.mode`).** `KpiSpec.mode: 'year' | 'range' | 'both'` (`kpi.ts:62` — a **closed union**, a Law-1 violation in its own right, separate from `by-mode`). `interpretKpis` (`kpi.ts:221`) and `extractKpiRequirements` (`kpi.ts:309`) filter `s.mode === 'both' || s.mode === ctx.timeMode`. One list = two strips. accounts L31–267: 4 year + 6 range; gdp: 3+5; regional: 4+6.

**T2 — Two near-identical filter bars.** `range-bar` (`showWhen:{mode:'range'}`) + `year-bar` (`showWhen:{mode:{neq:'range'}}`) — same shell, differing only in the time control + a re-declared `mode` hidden param (gdp L2142–2230). `mode` declared twice/page; regional re-declares `region`/`sector` carriers + `spanFrom`/`spanTo` (T6/T7).

**T3 — Per-node `visibleWhen` mode gates (11 total).** Nodes carry `view.visibleWhen {op:'eq', param:'mode', is:'year'|'range'}` (gdp L630–634 hero=year; timeseries=range). accounts 3 · gdp 4 · regional 4 = 11. Today read by `renderNode.ts:229` via `ctx.mode.current` (positional), and **separately hand-parsed by `navUtils.getNavMode`** (the sixth mode-reading site).

**T4 — Mode-clearing `effects` (1 block/page, 2 rules).** gdp L2240–2260: on every switch, imperatively clears the other mode's keys — the root of the bar-visibility gate, the re-pin, and `alwaysResolve`. Regional adds `sector:"_T"`. **The orthogonality-violating mutation** (§1 invariant). Wired via `applyEffects` (`SiteRenderer.tsx:125,175`).

**T5 — `ContextMapping.timeMode` + `modeOrder` + `mode-bar`.** Each page's `context` carries `"timeMode":"mode"` (gdp L2238 → privileged `ctx.timeMode`, `filter-params.ts:293` **mandatory**); a top-level `modeOrder:["year","range"]` (gdp L2263); a `mode-bar` node (L24–28). Three declarations to say "this page has a year/range axis."

**T6 — `fromYear`/`toYear`-vs-`year` split + dup `measure`/`mode`.** Time expressed three ways by mode: `year`, `fromYear`/`toYear`, and (regional) `spanFrom`/`spanTo`. Same `time` dim, bound three ways; `fromDim`/`toDim` restated in chart specs.

**T7 — `alwaysResolve` + page-level span hoist (regional only).** `spanFrom`/`spanTo` (L3742–3787) are page-level CAGR-window state mis-located inside `year-bar`; `alwaysResolve:true` (×2) hoists past the bar-visibility gate. A flag papering over mis-located state.

### 2.2 Quantification (verified)

| Construct | accounts | gdp | regional |
|---|---:|---:|---:|
| `KpiSpec.mode:'year'` items | 4 | 3 | 4 |
| `KpiSpec.mode:'range'` items | 6 | 5 | 6 |
| `visibleWhen {param:'mode'}` gates | 3 | 4 | 4 |
| `showWhen {mode:…}` bars | 2 | 2 | 2 |
| `effects` blocks (×2 rules) | 1 | 1 | 1 |
| `mode` hidden re-declarations | 4 | 4 | 4 |
| `timeMode` context binding | 1 | 1 | 1 |
| `fromDim`/`toDim` in chart specs | 4 | 6 | 4 |
| `fromYear`/`toYear` references | 23 | 24 | 24 |
| `alwaysResolve` hoists | 0 | 0 | 2 |
| `span*` references | 0 | 0 | 10 |

**Reading:** Of ~10 KPI items/page the *genuine* difference is only **what each measures** (point-in-year vs CAGR/share-over-window). Everything else is shared and re-stated. `effects`, the `mode` hidden param, `timeMode`, `modeOrder`+`mode-bar` carry **zero** authored info beyond "there is a year/range axis," restated 4–5×/page. Understanding one page = mentally running the mode filter at 5 independent sites. **Cost paid at N=1**: a year-only page still drags T2/T4/T5 + `ctx.timeMode='year'`. Proof the model is mis-factored.

### 2.3 CONCRETE before/after (GDP slice) — `perspective` naming

#### BEFORE (today, condensed)
```jsonc
{ "modes":["year","range"], "type":"mode-bar" },                    // T5
"modeOrder":["year","range"],                                        // T5
{ "type":"kpi-strip", "items":[                                      // T1
  { "id":"b1g-year","mode":"year","label":"…","unit":"მლნ ₾",
    "value":{"type":"point","measure":"B1G","filter":{…}},
    "trend":{"type":"yoy","measure":"B1G","filter":{…}} },
  { "id":"b1g-cagr","mode":"range","label":"… საშ. წლიური ზრდა","unit":"%",
    "value":{"type":"cagr","measure":"B1G","from":{"$ctx":"fromYear"},"to":{"$ctx":"toYear"},"filter":{…}},
    "trend":{"type":"cagr","measure":"B1G","from":{"$ctx":"fromYear"},"to":{"$ctx":"toYear"},"filter":{…}} }
  /* …6 more, each tagged mode:year|range… */ ]},
{ "type":"section","variants":{"emphasis":"hero"},                   // T3
  "view":{"subtitle":"{time} · მლნ ₾",
          "visibleWhen":{"op":"eq","param":"mode","is":"year"}} },
"filterSchema":{
  "bars":{
    "range-bar":{ "showWhen":{"mode":"range"},                        // T2
      "filters":{ "fromYear":{…},"toYear":{…},"mode":{"type":"hidden","default":"year"} } },  // dup #1
    "year-bar":{ "showWhen":{"mode":{"neq":"range"}},
      "filters":{ "year":{…},"mode":{"type":"hidden","default":"year"} } } },                 // dup #2
  "context":{ "dims":{"time":"year","fromYear":"fromYear","toYear":"toYear"}, "timeMode":"mode" },  // T5/T6
  "effects":[                                                          // T4
    {"set":{"year":""},"when":{"mode":"range"}},
    {"set":{"fromYear":"","toYear":""},"when":{"mode":{"neq":"range"}}} ] }
```

#### AFTER (reframed — one axis, one filter set, no effects, no second bar)
```jsonc
"perspectiveAxis":{                                                  // replaces T2/T4/T5
  "param":"perspective",
  "perspectives":[
    { "id":"year", "label":{…}, "scope":{"timeBinding":{"dim":"time","pick":{"$ctx":"year"}}} },   // [0] = default
    { "id":"range","label":{…}, "scope":{"timeBinding":{"dim":"time","from":{"$ctx":"fromYear"},"to":{"$ctx":"toYear"}},
                                          "metric":"b1g-cagr" } }      // perspective-wide measurement swap (LOW-2)
  ] },
"filterSchema":{
  "bars":{ "bar":{ "order":0,"position":"sticky","filters":{          // ONE bar
    "year":    {"type":"year-select","when":{"op":"perspective-is","perspective":"year"},"years":{"$cl":"time"}},
    "fromYear":{"type":"select","when":{"op":"perspective-is","perspective":"range"},"options":{…}},
    "toYear":  {"type":"select","when":{"op":"perspective-is","perspective":"range"},"options":{…}} } } },
  "context":{ "dims":{"time":"year","fromYear":"fromYear","toYear":"toYear"} }
  // NO timeMode · NO effects · NO second bar · NO `mode` hidden param
},
{ "type":"kpi-strip","items":[                                        // T1: `when` + measurement diff only
  { "id":"b1g","when":{"op":"perspective-is","perspective":"year"},"label":"…","unit":"მლნ ₾",
    "value":{"type":"point","measure":"B1G","filter":{…}}, "trend":{"type":"yoy","measure":"B1G","filter":{…}} },
  { "id":"b1g-cagr","when":{"op":"perspective-is","perspective":"range"},"label":"… საშ. წლიური ზრდა","unit":"%",
    // time pins come from the ACTIVE perspective's scope.timeBinding — no per-item $ctx restating
    "value":{"type":"cagr","measure":"B1G","filter":{…}}, "trend":{"type":"cagr","measure":"B1G","filter":{…}} } ]},
{ "type":"section","variants":{"emphasis":"hero"},                    // T3: same `when`, no privileged param
  "when":{"op":"perspective-is","perspective":"year"},
  "view":{"subtitle":"{time} · მლნ ₾"} }
```

**Diff deletes (per page):** `mode-bar`, `modeOrder`, the `timeMode` binding, the second bar, both `mode` hidden re-declarations, the entire `effects` block, and (regional) `alwaysResolve` (span → page-level `computed`/`vars`). **Keeps:** the authored difference only — *which* nodes belong to *which* perspective (one `when`) and *what each measures* (`value`/`trend`, optionally `scope.metric`). The axis is declared **once**, at the top, as data.

> **The CAGR time-pin win:** today every range KPI restates `from:{$ctx:fromYear}, to:{$ctx:toYear}` (the bulk of the 23–24 refs/page). Under the reframe the active perspective's `scope.timeBinding` *is* the window — `resolveTime` (`kpi.ts:84-88`) already reads `$ctx` from `ctx.dims`; it reads the perspective-scoped binding. The per-item restatement disappears.

---

## 3. The minimal final design (YAGNI-bounded)

### 3.1 The contract (only what time-mode needs NOW)

```ts
// JSON-serializable, Constructor-authorable, no functions (Law 2). In packages/core/src/config/perspective-axis.ts.
interface PerspectiveAxis {
  param:        string             // URL param name (e.g. 'perspective')
  perspectives: PerspectiveDef[]   // perspectives[0] IS the default (ONE SSOT — LOW-1; matches available[0] fallback)
}
interface PerspectiveDef {
  id:    string                    // 'year' | 'range' | … (open; perspectiveRegistry-resolved like ModeId)
  label: LocaleString
  when?: VisibilityExpr            // OPTIONAL override; default = perspective-is(id). Reuses the EXISTING evaluator.
  scope: {
    timeBinding: TimeBindingSpec   // MANDATORY — year-pin vs [from,to] window (Law 1: dim generic)
    metric?:     string            // THIN OPTIONAL — perspective-wide measurement swap (see LOW-2 below)
  }
}
type TimeBindingSpec =
  | { dim: string; pick: TimeRef }                // single-period (year perspective)
  | { dim: string; from: TimeRef; to: TimeRef }   // window (range perspective)
```

**No `default?` field (LOW-1).** `perspectives[0]` is the canonical default — exactly mirroring the existing `available[0] ?? 'year'` fallback in `useModeContext` (`ModeContext.tsx:39`). Shipping both a `default?` and an array-order default would be two SSOTs for one fact. One SSOT: array order.

### 3.2 `scope.metric` vs per-item `value.type` — the dual-encoding rule (LOW-2)

The genuine per-perspective difference **is the measurement** (point-in-year vs CAGR-over-window). That difference can be expressed at two granularities; the rule fixes which is authoritative so it is never authored twice:

- **Perspective-wide measurement → `PerspectiveDef.scope.metric`** (a `MetricDef` ref, the semantic-layer R1 spine). Use when *every* data node in the perspective measures the same way (e.g. a whole "range" perspective is CAGR-based). The active perspective's `scope.metric` is applied during ctx-scoping; nodes that bind a metric inherit it. **This is the canonical home for the year/range KPI difference** — it replaces the old per-item `mode:'year'|'range'` partition (T1) with one metric ref per perspective.
- **Node-local measurement → the node's own `value.type` / `trend.type`** (e.g. a single KPI that is `point` while its siblings are `cagr`). Use only for a *node that differs from its perspective's default measurement*.

**The invariant (FF-NO-PER-VIEW-DUPLICATION blind-spot guard):** a measurement difference is authored in **exactly one** place — either `scope.metric` (perspective-wide) **or** the node's `value.type` (node-local), **never both independently for the same node**. The two are derivable: `scope.metric` sets the perspective default; a node's explicit `value.type` overrides it for that node only. The fitness function asserts no node both inherits a `scope.metric` AND re-declares the same measurement via `value.type` (redundant dual-encoding = the duplication smell the reframe exists to kill).

### 3.3 DEFERRED keys (documented, NOT built — additive later, OCP)

| Deferred key | Carries | Trigger (real 2nd caller) | Door |
|---|---|---|---|
| `scope.store` | generic store key (multi-store) | a perspective reading a different cube | multistore D1 |
| `scope.dims` | perspective-scoped non-time dim pins | a perspective pinning a non-time dim | — |
| `scope.blend` | a `blend` step (compare perspective) | a compare/benchmark perspective | D3-PLANNER |
| `filters[]` (ref+bind) | explicit per-perspective filter scoping | 3rd+ perspective sharing a filter non-trivially | — |
| `facet` | render across all axis values (trellis) | small-multiples requirement | faceting door |
| 2nd axis (`compare`/`navMode` live) | a real 2nd simultaneous axis | a real 2nd orthogonal axis | §5 Q4 |

**Shape-compatibility confirmed (YAGNI guard):** each deferred key is a new optional field on `PerspectiveDef.scope` (or a sibling axis entry in a future `page.perspectiveAxes` plural), interpreter unchanged = OCP. `compare` already exists half-built on `ScopeOverride.compare` (`scopeOverride.ts:37`) and `navMode` already exists as a peer concern (nav-section filtering) — both stay **deferred peers** the `perspectiveState` Record accommodates; **neither is instantiated as a live axis now.**

### 3.4 `perspective = f(state)` on the EXISTING spine (no new interpreter)

- **Active perspective id** = read from URL `param` (as `useModeContext` reads `mode` — `ModeContext.tsx:32-47`), stored in the new generic `ctx.perspectiveState` slot.
- **Which nodes/filters show** = existing `evalVisibility` (`visibility.ts`), `when` defaulting to `perspective-is(activeId)`, reading `ctx.perspectiveState[param]` (HIGH-3 SSOT).
- **What a node resolves** = `interpretSpec(spec, ctxScopedByActivePerspective, store)` — the **only** new step is scoping `ctx` by `scope.timeBinding` (+ optional `metric`) **before** resolution. Selectors/resolvers unchanged.
- **Switching** = write the URL param. **No `effects`, no key-clearing** — shared filters reference the same `time` dim, bound differently per perspective; nothing to clear (orthogonality preserved).

### 3.5 The one-perspective property (made structural)

A page with **no `perspectiveAxis`** (or a single-perspective one): no perspective param, `ctx.perspectiveState` empty, every node resolves with its plain spec, `evalVisibility` sees no `perspective-is` gate, no scoping step runs. **Zero machinery.** `f(state)` with a constant state is `f`. Locked by **FF-ONE-VIEW-NO-MACHINERY**. Contrast today (§2.2): a one-mode page still drags `timeMode`/`mode-bar`/`modeOrder`/effects. The reframe is the only design where N=1 is genuinely free.

---

## 4. The complete System-A / `by-mode` surface (ground-truth, the deletion set)

This is the authoritative inventory the migration must cover. **System A = the privileged `timeMode` mechanism** (`ctx.timeMode` beside `dims`, the by-mode resolver, bar-visibility gate, mode-clearing effects, KPI mode-filter). **System B = the generic mechanism** (`modeRegistry`, `ModeContext`, `mode-is`/`mode-in`/`mode-not` ops) — half-migrated, owns visibility + nav only. The reframe **finishes B (as `perspective`) and retires A.**

### 4.1 Engine sites (`packages/core/src`) — 8

| # | Site | Role | Disposition |
|---|---|---|---|
| E1 | `core/context.ts:13` `TimeMode = ModeId`; `:58` `SectionContext.timeMode` | privileged mode field (Law-1 violation) | **delete** the field; add generic `perspectiveState` slot |
| E2 | `config/filter-params.ts:293` `ContextMapping.timeMode` (**mandatory**) | URL-param → `ctx.timeMode` binding | **relax to optional first** (P1), Postel-derive, then delete (P6) |
| E3 | `config/filter-params.ts:248-250,338` `BarDef.timeToggle` / `timeModes` / `TimeModeItem` | mode-toggle bar attachment | relax-optional → migrate → delete |
| E4 | `config/visibility.ts:42` `evalVisibility(…, mode?)` positional + `mode-is`/`mode-in`/`mode-not` (`:26-28,52-54`) | the visibility evaluator | migrate positional `mode?` → `ctx.perspectiveState[param]`; add `perspective-*` ops; Postel-alias `mode-*` + `{op:eq,param:<param>}` |
| E5 | `config/data-spec.ts:181` `{type:'by-mode'; modes}` + `:128` doc | data-level mode branch | **delete** (dead) |
| E6 | `registry/resolvers.ts:141-163` `ByModeResolver` + `:385` registration + `:347-349` doc | by-mode resolver | **delete** |
| E7 | `validation/pipeline.ts:125`; `spec-catalog.ts:102,112`; `discriminant-manifest.ts:36`; `mode/types.ts:13` (`dataKey`) | by-mode schema/catalog/manifest surface | **delete** the by-mode entries |
| E8 | `data/metric-store.ts:55-57` (by-mode ref-union); `data/scopeOverride.ts:31` (`ScopeOverride.timeMode` per-panel override) | by-mode store routing + per-panel mode | metric-store: drop by-mode case; scopeOverride: migrate `timeMode` → perspective-scope override (P6) |
| E+ | `data/kpi.ts:62` `KpiSpec.mode:'year'\|'range'\|'both'` (closed union) + filters `:221,:309` | KPI per-mode partition (T1) | replace with `when: perspective-is` gating + `scope.metric`; delete the closed `mode` field |
| E+ | `mode/registry.ts:34` `modeRegistry` | the open registry singleton | **rename/alias** `perspectiveRegistry` (arrow-safe; engine singleton) |
| E+ | `contracts/schema/page-config.schema.json:69` `"const":"by-mode"`; `:169,253,337` `modeOrder` (3 page-defs) | schema | delete by-mode const; replace `modeOrder` with `perspectiveAxis` (MEDIUM-2) |

### 4.2 React / SiteRenderer sites (`packages/react/src/engine`) — 6

| # | Site | Role | Disposition |
|---|---|---|---|
| R1 | `renderNode.ts:228-231` `evalVisibility(…, ctx.mode.current)` | the live visibility gate (positional mode) | read `ctx.perspectiveState[param]` instead of `ctx.mode.current` (HIGH-3) |
| R2 | `targets/warm.ts collectRequirements` | SSR warm walker — **no visibility eval** | thread active perspective id; gate by `evalVisibility` (P-opt) |
| R3 | `targets/api.ts walkNode` | SSR JSON walker — **no visibility eval** | thread active perspective id; gate by `evalVisibility` (P-opt) |
| R4 | `navUtils.ts:52` `getNavMode` hand-parses `{op:eq,param:timeModeKey}`; `:124-132` sorts by `modeOrder` | **the 6th mode-reading site** + nav-sort | parse `perspective-is`/`{op:eq,param:<param>}`; sort by `perspectiveAxis.perspectives[]` order (MEDIUM-2) |
| R5 | `SiteRenderer.tsx:93-129` `timeModeKey`/`useModeContext`/`sectionCtx.timeMode` bridge (`:111`)/`applyEffects` (`:125,175`) | mode wiring + **the mode-clearing effects** | write `ctx.perspectiveState`; **delete `applyEffects`** (orthogonality, §1) |
| R6 | `SiteRenderer.tsx:103,145` `page.modeOrder` read + `extractNavSectionsFromChildren(…, page.modeOrder)` | modeOrder consumer | derive from `perspectiveAxis.perspectives[]` order |
| R+ | `context/ModeContext.tsx` `useModeContext`/`ModeProvider`/`useMode` | React mode layer | alias/rename to perspective; reads URL param, writes `perspectiveState` |

### 4.3 Constructor sites (`apps/panel/src`) — the complete by-mode deletion (MEDIUM-3)

| # | Site | Disposition |
|---|---|---|
| C1 | `features/data-layer/editors/ByModeEditor.tsx` + `.test.tsx` | **delete both** |
| C2 | `features/data-layer/index.ts:16` `export { ByModeEditor }` | **delete export** |
| C3 | `features/data-layer/DataSpecEditor.tsx:14,47-48,116` (import, factory default, render case) | **delete the by-mode branch** |
| C4 | `features/data-layer/coverage.fitness.test.ts:52,59,116` | **remove by-mode from the coverage corpus** |
| C5 | `canvas/setupCanvasRegistry.ts:42` (comment referencing by-mode DataSpec) | update comment; remove by-mode discriminant if registered |
| C+ | `config/roundtrip-dataspec.fitness.test.ts:120,131-132,170` (by-mode round-trip case) | **delete the by-mode round-trip case** |

> **Why delete, not shim:** 0 config uses → Chesterton's-fence cleared (no live consumer). A surviving palette entry authors an unresolvable spec → capability-discovery violation (Law 8). Confirmed: DELETE everywhere, no half-state.

---

## 5. Open questions — RESOLVED (confirmed decisions baked in)

**Q1 — Naming. RESOLVED: `perspective`.** Wholesale: `PerspectiveAxis`/`PerspectiveDef`/`perspective-is`/`perspective-in`/`perspective-not`/`ctx.perspectiveState`/URL param `perspective`/`perspectiveRegistry`. **Collision-free** with the live `node.view` field. **OLAP-correct** (§1). The provisional "fall back to `view`/`perspective`" hedge is **DELETED — the door is closed.**

**Q2 — Active id home. RESOLVED: new generic `ctx.perspectiveState: Record<string,string>`** on `SectionContext`, defaulting empty. Retires the Law-1-violating `ctx.timeMode` field with **no replacement named field**. Harel orthogonal-regions container: one axis instantiated now (`perspective`→active id), multi-axis free later (another key). Separate from `dims` so it never leaks into a query — `resolveTime`/`withFilter` keep reading `dims`, scoped by the active perspective.

**Q3 — `by-mode`. RESOLVED: DELETE everywhere** (§4, no shim). Trivially safe (0 uses). FF-BYMODE-DESUGAR-EQUIV is retired in favour of FF-NO-BYMODE-REMNANT (asserts the discriminant and editor are gone).

**Q4 — Multi-axis. Deferred; shape free.** A 2nd axis = another entry in a future `page.perspectiveAxes` (plural) → another key in `ctx.perspectiveState` → its `when` ops read its own param. **Not built now.** `compare`/`navMode` stay deferred peers (not live axes).

**Q5 — Faceting. Deferred door; shape compatible.** A `facet` key on `PerspectiveDef` is purely additive (renderer loops the scoping step over each axis value). Neither built nor precluded.

**Q6 — `navMode`. Keep separate (peer concern, not folded).** Nav filters nav sections (`SiteRenderer.tsx:145`, `navUtils` sort) — a different region. It becomes another generic `perspectiveState` axis *later* — unified mechanism, separate concern (orthogonal regions). **Not instantiated now.**

**Q7 — SSR snapshot. RESOLVED: active-perspective-only DEFAULT + explicit `snapshot:'all-perspectives'` escape.** The live page already lazily renders only the active perspective, and the URL carries the `perspective` param → the permalink *is* perspective-specific, so active-only is both correct and the optimization. `'all-perspectives'` walks each `PerspectiveDef`, scopes ctx per perspective, unions requirements — for self-contained bulletin/PDF exports. See §6 (P-opt) + the permalink-from-registry innovation below.

**Q8 — Migration blast radius.** Before retiring System A (P6): green (i) the round-trip corpus extended with `PerspectiveAxis`/`PerspectiveDef`; (ii) **FF-NO-BYMODE-REMNANT**; (iii) **FF-SNAPSHOT-VIEW-EQUIV** — for each of the 3 pages, in each perspective, the reframed `renderPageToJSON` snapshot is row-identical to the legacy snapshot in that mode. (iii) is the gate that lets P6 delete the gate/`alwaysResolve`/effects/`timeMode` safely.

---

## 6. INNOVATION — permalink from the `PerspectiveAxis` registry (Law-9 as a generated guarantee)

Law 9 says **URL = permalink**: a shared URL renders completely. Today this is *hoped for*, not *generated* — the `mode` param, its default, and the elision rule are scattered (the hidden `mode` param, `available[0]` fallback, ad-hoc URL writes). The reframe makes it a **single generated contract**:

- The `PerspectiveAxis` registry is the **SSOT for the URL surface**: it yields (a) the param name(s), (b) the default (`perspectives[0].id`), and (c) the **default-elision rule** (the default perspective omits its param from the URL → clean canonical permalinks; a non-default perspective always carries it). One function `permalinkParams(axes, perspectiveState) → URLSearchParams` derives the canonical URL; its inverse seeds `perspectiveState` from the URL on load.
- This is also the **natural home for the `snapshot` policy**: `'active'` reads `perspectiveState` from the permalink (the URL fully determines what renders); `'all-perspectives'` ignores it and unions all. The permalink and the snapshot policy share one registry-derived source — no second place to keep in sync.
- **Additive, closes a Law-9 hole, no new machinery on the hot path.** Locked by **FF-PERMALINK-FROM-REGISTRY** (the canonical URL for any `perspectiveState` is reproducible from the registry alone; default perspective elides; round-trips losslessly).

This is the design-in-now innovation: the axis registry doesn't just drive rendering, it **generates the permalink contract** — Law-9 becomes a property of the architecture, not a convention.

> **Path correction (MEDIUM-1) baked into §4 site tables.** The capstone's package locations were partly wrong: `renderNode`/`navUtils`/the SSR walkers/`SiteRenderer` are all in **`packages/react/src/engine/**`**, NOT `packages/plugins`. Verified correct: `modeRegistry` (`packages/core/src/mode/registry.ts`), `evalVisibility` (`packages/core/src/config/visibility.ts`), React `ModeContext` (`packages/react/src/context/ModeContext.tsx`). A P0 implementer uses §4.1/§4.2 paths.

---

*Vision #3 analysis — FINAL. Phases, fitness suite, SSR optimization, exact P0/P-opt specs → `VISION-mode-as-perspective-axis.v3-PLAN.md`.*
