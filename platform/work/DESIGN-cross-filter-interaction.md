# DESIGN — Cross-Filter / Linked Interaction ("Grammar of Interaction")

> Status: PROPOSED (converge before build). Owner-core, not future.
> Author: platform-architect (Opus). Scope: declarative selection→ctx→all-panel cross-filtering.
> Canon: Config = SSOT · declarative-over-imperative · no privileged dims · OCP via registry/union · reuse existing seams (params + `$ctx` + CommandBus + perspective/effects). **No parallel state system.**

---

## 0. TL;DR

The read side of cross-filter is **already correct and live**. Panels that bind `{$ctx:"<dim>"}` re-query whenever `ctx.dims` changes, and the store already splits a CSV `$ctx` value into an OR-set (`= ANY`), so a 2-region multi-select is matched correctly at the data layer. What is missing is the **write side as a general capability**: today only the `geograph` shell has bespoke click→filter wiring. Charts drop the filter branch, tables have none, the declarative `on[]` / `FilterDataLink` seam is typed-but-unwired dead code, and KPIs are authored with literal `geo:"_T"` pins instead of `$ctx` refs. The fix is to promote the dead declarative seam to a **first-class, shell-agnostic interaction dispatch** in the render layer, lift the geograph's multi-select accumulator into a reusable reducer, and migrate KPI/panel bindings to `$ctx`. One write point, one read contract, every data node opts in with JSON.

---

## 1. Diagnosis (end-to-end trace, with evidence)

### The pipeline that must close
```
selection gesture (map click / chart point / table row / dropdown)
   → write dim-param to shared FilterContext (URL = permalink SSOT)
   → useFilterState derives ctx.dims  (context.dims maps dimKey → paramKey)
   → every panel + KPI referencing {$ctx: dimKey} re-queries
   → store matches value (scalar OR CSV → = ANY)
```

### Q1 — Does a SELECTION write to shared state?

| Gesture | Writes shared state? | Evidence |
|---|---|---|
| **Map click (geograph)** | ✅ YES (bespoke) | `GeographShell.tsx:44-68` `handleSelect` → `ctx.bus.dispatch({type:'filter:set', key:def.paramKey, …})`; multi-select accumulate/cap logic inline (L45-56). `GeoMap.tsx:175-178` click → `onSelect(geoId)`. |
| **Chart point click** | ❌ NO | `useChartInteractions.ts:45-60` `onDataClick` resolves links but dispatches **only** `link.action === 'navigate'` → `nav:drill`. The `action === 'filter'` branch is **never handled** — the resolved `FilterDataLink` is silently dropped. |
| **Table row click** | ❌ NO | `TableShell.tsx` / `DataTable.tsx` contain **zero** `on` / `dataLinks` / `filter:set` / `useFilter` / row-click wiring (grep clean). No selection concept at all. |
| **Sector dropdown (filter bar)** | ✅ YES | Standard `SelectShell.tsx:8` `useFilter().set` → writes `sector` param. This is a filter, not a *selection gesture* — it already works. |

The command→state write point is solid and generic: `SiteRenderer.tsx:235-242` wires `filter:set`/`filter:setMany`/`filter:clear` → `FilterContext` (`filterSet`/`setMany`), which updates React state **and** the URL (`FilterContext.tsx` set/setMany). **The bus is the ONE write point; only the geograph uses it for selection.**

### Q2 — Do OTHER panels + KPIs reference the selected dim via `$ctx`?

- **Sibling panels: ✅ YES.** Regional sector-donut query filter (`geostat.provisioning.json:3519-3533`) = `{ geo:{$ctx:"geo"}, sector:{$ne:"_T"}, time:{$ctx:"time"} }`. `context.dims` (L4467-4478) maps `geo → region` (the map's `paramKey`), `sector → sector`, `time → year`. So when the map writes `region=…`, `ctx.dims.geo` changes and the donut re-queries. **This half works.**
- **KPIs: ❌ NO — hard-pinned to national totals.** Regional KPI specs (`geostat.provisioning.json:3174-3236`) bind literal `filter:{ geo:"_T", measure:"GVA", sector:"_T" }` — **never** `{$ctx:"geo"}` / `{$ctx:"sector"}`. Time is `{$ctx:...}` but geo/sector are literals. The KPI input therefore never varies with the selection.

### Q3 — Is filter state page-global? Is there a "selection" concept?

- **Page-global: ✅.** `FilterProvider` is page-scoped; all panels read one `ctx.dims`. Correct.
- **No distinct "selection" concept — and that is correct doctrine.** Selection is overloaded onto a filter param (`region`), which IS SSOT-clean (selection = a dim value in the shared context). The gap is not a missing selection store; it is the **missing general gesture→param seam**. Each node reinvents it (only the map has one).

### Q4 — Why don't KPIs re-compute on filter change?

**Not a reactivity bug.** `useKpiRows.ts:96-102` memoizes `interpretKpis(specs, sectionCtx, store, filterParams)` on `[specs, sectionCtx, store, filterParams]`; `sectionCtx` gets a new identity whenever `ctxKey` changes (`useFilterState.ts:176-200`). KPIs **do** recompute when `ctx.dims` changes. They appear static because their spec `filter` binds **literal** `geo:"_T"`/`sector:"_T"` (Q2) — the recompute runs but reads the same national cell every time. Root cause = **authoring binds literals, not `$ctx`**, plus no gesture ever mutates a KPI-relevant param on non-map pages.

### Multi-select `= ANY` — already handled at the store

`store-filter.ts` `resolveFilter` (L126-129) and `matchedValues` (L164-166): a `$ctx` string containing `,` is split into parts and expanded to a leaf-set (OR-set); `buildObsFilterParam` (L76-79) keeps arrays as multi-value wire params. So `region="R1,R2"` → `ctx.dims.geo="R1,R2"` → matched as `geo ∈ {R1,R2}`. **No store change needed.**

### Root cause (one sentence)

> The declarative cross-filter capability exists as **types + a core resolver but no runtime adapter** (`NodeBase.on` / `FilterDataLink` target:`'filter'` / `NodeEventHandler` / `FilterAction` are defined in `node-events.ts`, `links/types.ts`, exercised only by `crossFilter.test.ts` pure-logic tests, and consumed by **no shell**), while the one working path (geograph) is a hardcoded one-off — so selection propagates nowhere except the map, and KPIs are additionally authored against literal pins.

This is a Hexagonal **port with no adapter** + a **first-tenant one-off** (the geograph) that should have been the first consumer of a shared capability (M-5 / Law 8).

---

## 2. Design — cross-filter as a first-class, declarative, Constructor-authorable capability

### 2.1 Doctrine (the invariants)

1. **Selection IS a filter param.** No parallel "selection" store. A gesture writes a dim-param to `FilterContext` (URL = permalink SSOT). `perspective = f(state)` and `panels = f(ctx.dims)` are unchanged — cross-filter is just *another writer* of the same params. (SSOT, Law 1: the param name is data.)
2. **One write point.** All gesture writes go through `ctx.bus` (`filter:set` / `filter:setMany` / `filter:clear`) — the same CommandBus `SiteRenderer` already wires. No shell calls `FilterContext` directly.
3. **One read contract.** Consumers bind `{$ctx:"<dim>"}`; the store resolves scalar or CSV → `= ANY`. Opt-in = add a `$ctx` ref; opt-out = omit it (a literal or `$ne` pin). No node is force-coupled.
4. **Declarative only.** The gesture→action mapping is JSON (`on[]` / `dataLinks`), no functions in config (Law 2). Behavior lives in the renderer.

### 2.2 The seam: `NodeBase.on[]` — promote from dead type to live capability

Reuse the **existing** `node-events.ts` grammar, extended minimally:

```jsonc
// on a chart / table / geograph / any data node
"on": [
  { "event": "point:click",       // NEW trigger (chart); + existing row:click, selection:change
    "actions": [
      { "type": "filter",
        "key": "region",           // the dim-param to write (data, not privileged)
        "fromField": "geo",        // row field supplying the value (default: key)
        "mode": "toggle",          // NEW: replace (default) | toggle | clear
        "max": 2 }                 // NEW: cap for toggle-accumulation (multi-select)
    ] }
]
```

- `mode:"replace"` (default) — set the param to the clicked value (single-select).
- `mode:"toggle"` — accumulate into a CSV set: add if absent, remove if present, evict-oldest past `max`. **This is the geograph's `handleSelect` logic, lifted to a reusable reducer.** CSV → store `= ANY` (already works).
- `mode:"clear"` — clear the param (deselect-all).

`FilterAction` gains `mode?` + `max?`; `NodeEventTrigger` gains `'point:click'`. `NodeAction` stays an open union (OCP: a future `navigate`/`highlight` action = a new discriminant, dispatcher unchanged).

### 2.3 The adapter: one engine-side dispatcher (`useNodeInteractions`)

A single React hook in `packages/react/src/engine/` (sibling to `useKpiRows`), consumed by every data shell — the **missing adapter** for the port:

```
useNodeInteractions(def, ctx) → { emit(trigger, row) }
  // reads def.on[]  → for each handler whose event === trigger:
  //   for each FilterAction:
  //     value = row[action.fromField ?? action.key]
  //     next  = applySelection(mode, ctx.filterParams[action.key], value, max)   // pure reducer
  //     ctx.bus.dispatch(next === '' ? filter:clear : filter:set{key, value:next})
  //   (batch multiple actions → filter:setMany, atomic — one URL write)
  // ALSO folds in FilterDataLink: resolveLinks(def.dataLinks) entries with
  //   action==='filter' dispatch the same way (kills the dropped branch in useChartInteractions).
```

- `applySelection(mode, current, value, max)` = the **pure, tested** selection reducer (extracted from `GeographShell.handleSelect`), lives in core/engine (deterministic, no React). Reused by geograph + the hook.
- Shells call `emit('point:click', row)` / `emit('row:click', row)` from their existing click handlers. Chart: `useChartInteractions` already has `ctx.rows[dataIndex]` — route its click through `emit`. Table: add an `onRowClick` in `DataTable`/`TableShell` → `emit('row:click', row)` (gated: only when `def.on` present, else inert — no a11y/UX regression). Geograph: `handleSelect` becomes `emit('selection:change', {[paramKey]:geoId})` — the bespoke path retired to the shared seam (Strangler-Fig).

### 2.4 How each flow composes

- **2 regions (multi):** `on:[{event:'selection:change',actions:[{type:'filter',key:'region',mode:'toggle',max:2}]}]` → param `region="R1,R2"` → `ctx.dims.geo` → every `{$ctx:"geo"}` panel/KPI queries `geo ∈ {R1,R2}`.
- **Sector select (from a chart):** donut/bar declares `on:[{event:'point:click',actions:[{type:'filter',key:'sector',fromField:'sector',mode:'replace'}]}]` → `ctx.dims.sector` → all `{$ctx:"sector"}` consumers rescope. (The dropdown remains a second writer of the same param — both valid, SSOT preserved.)
- **Compose with perspective/time:** untouched. `time` is written by the perspective axis (`scope.binding` + `onEnter`/`onExit` effects). Cross-filter writes *other* dims; the two are orthogonal writers of the shared param bag. `filter:setMany` keeps a multi-action gesture atomic so the URL and perspective stay consistent.
- **Opt a panel in/out:** in = bind `{$ctx:dim}`; out = literal / `$ne` / omit. Per-panel `view.scope` (`ScopeOverride`) can still override a dim locally (e.g. a "national context" panel pinned to `_T` while siblings follow the selection).
- **KPIs join the loop (read consumers):** migrate KPI spec filters from `geo:"_T"` → `{$ctx:"geo"}` (and sector) where scoping is intended. The KPI filter resolver already resolves `$ctx` (time uses it today via the same `resolveRef` path), and `useKpiRows` already recomputes on `sectionCtx` change — **zero machinery change; a binding/authoring migration.** A "national baseline" KPI stays literal `_T` by choice.

### 2.5 Constructor / capability-discovery surface

- `FilterAction` gets a `PropSchema` (like other node props) so the Constructor renders an "On click → set filter" authoring panel: pick trigger (introspected `NodeEventTrigger` union), pick target param (from the page's declared filter params — capability discovery), pick `fromField` (from the node's resolved row fields), pick `mode`/`max`. Ships as a **capability, not a one-off** (Law 8).
- A fitness function asserts every registered data-node shell routes clicks through `emit` (no shell re-implements gesture→bus) — prevents a second geograph-style fork.

### 2.6 Where the architecture must ADAPT (Law 7)

1. **Promote the port's adapter.** `NodeBase.on` / `FilterDataLink` are currently dead. The vision leads: build the `useNodeInteractions` adapter + route all data shells through it. The code (geograph one-off, chart's navigate-only branch, table's silence) migrates to the pattern — the pattern is not bent to the one-off.
2. **Retire the geograph's bespoke `handleSelect`.** It becomes the first consumer of the shared reducer + `emit` seam (its accumulate/cap logic is the reducer's spec). No behavior change; one less fork.
3. **Extend `FilterAction` grammar** with `mode`/`max` — the only genuinely new vocabulary (multi-select accumulation was previously encodable only inside the geograph). Additive, backward-compatible (absent `mode` = `replace`).
4. **KPI authoring migration** `_T` → `$ctx` on scoping dims (config-side, expand-contract: both render; migrate provisioning).

### 2.7 Rejected alternatives (ADR)

- **A. A separate `SelectionContext` / selection store distinct from filters.** REJECTED — violates SSOT + no-privileged-dims; creates a parallel reactive system the owner explicitly warned against; breaks URL-as-permalink (selection would not be shareable); duplicates the store's already-working `= ANY` read path. Selection *is* a dim value.
- **B. Per-shell bespoke click→filter (extend the geograph pattern to each shell).** REJECTED — Shotgun Surgery / first-tenant erosion; N copies of accumulate logic; not Constructor-authorable (behavior in shells, not config); every new node type re-implements it. The whole point of the config-driven platform is one interpreter, many declarations.
- **C. Imperative `onClick` handlers in config (functions / expressions that call `set`).** REJECTED — Law 2: a function in config is not serializable, not Constructor-ready, not sandboxed. The `on[]` action-list is the declarative equivalent (Grafana panel actions / Retool events / Builder.io actions).

---

## 3. Build plan (ordered, Strangler-Fig)

1. **Reducer (pure, core/engine).** Extract `applySelection(mode, current, value, max) → string` from `GeographShell.handleSelect`. Unit + property tests (toggle idempotence, cap eviction, clear). No wiring yet.
2. **Grammar.** Extend `FilterAction` (`mode?`, `max?`) + `NodeEventTrigger` (`'point:click'`). Add `PropSchema` for `FilterAction`. Roundtrip + schema-completeness fitness tests.
3. **Adapter.** `useNodeInteractions(def, ctx)` in `packages/react/src/engine/` — reads `def.on[]` + `def.dataLinks` filter-branch, resolves against the clicked row, dispatches `filter:set`/`setMany`/`clear` via `ctx.bus`. Unit test the dispatch (replaces the mock-loop in `crossFilter.test.ts` with the real hook).
4. **Chart adapter.** Route `useChartInteractions.onDataClick` through `emit('point:click', row)`; keep `navigate` (nav:drill) intact. Fix the dropped `action==='filter'` branch here.
5. **Table adapter.** Add gated `onRowClick` in `DataTable`/`TableShell` → `emit('row:click', row)` (only when `def.on` present; keyboard-accessible, `role`/`aria` correct — WCAG 2.1 AA).
6. **Geograph migration.** Replace `handleSelect` internals with the shared reducer + `emit('selection:change', …)`; delete the bespoke accumulate logic. Behavior-identical.
7. **Config: KPIs + panels.** Migrate regional KPI specs `geo:"_T"`→`{$ctx:"geo"}` (+ sector) where scoping is intended; author `on[]` on the regional donut/bar/table + geograph. Keep national-baseline KPIs literal by design.
8. **Constructor surface.** Wire the `FilterAction` PropSchema into the authoring palette (capability discovery: target params from declared filters, fields from node rows).
9. **Fitness functions (below) + docs/ADR.**

---

## 4. Fitness functions (encode the invariants)

- **FF-XF-SELECT-WRITES** — dispatching a `point:click`/`row:click`/`selection:change` on a node with `on:[{type:'filter',key:K}]` results in `ctx.bus` receiving `filter:set`/`setMany` for `K` with the clicked row's value. (Adapter test.)
- **FF-XF-MULTI-ANY** — select 2 regions (`mode:'toggle',max:2`) ⇒ every data-panel's resolved store query carries `geo ∈ {R1,R2}` AND rendered rows are exactly R1+R2 (integration, real store). Asserts the CSV→`= ANY` path end-to-end.
- **FF-XF-KPI-RECOMPUTE** — a KPI bound `{$ctx:"geo"}` returns a different value after `region` changes from `_T`→`R2` (proves the read+reactivity loop closes for KPIs).
- **FF-XF-ONE-WRITE-POINT** — no data shell imports/calls `useFilter().set` for a selection; all gesture writes go through `ctx.bus` (grep/ArchUnit-style). Prevents a second geograph fork.
- **FF-XF-DECLARATIVE** — `on[]` / `FilterAction` contain no functions; JSON-roundtrip is lossless (config = SSOT).
- **FF-XF-OPT-OUT** — a panel with a literal/`$ne` pin (no `$ctx`) is unaffected by a selection change (proves non-coupling).
- **FF-XF-A11Y** — a table with `on:[row:click]` exposes keyboard-activatable rows with correct `role`/`aria`; a table without `on` renders no interactive affordance (no regression).

---

## 5. Seam-change summary (minimal)

| Layer | Change | New? |
|---|---|---|
| core/engine | `applySelection` reducer (extracted) | extract |
| core `node-events.ts` | `FilterAction.mode`/`.max`; `NodeEventTrigger:'point:click'` | additive |
| core config | `FilterAction` PropSchema | additive |
| react engine | `useNodeInteractions` adapter (the missing port adapter) | new (small) |
| plugins chart | route click through `emit`; fix dropped filter branch | wire |
| plugins table | gated `onRowClick` → `emit` | wire |
| plugins geograph | `handleSelect` → shared reducer + `emit` | migrate |
| store | — | **none** (CSV→ANY already works) |
| useKpiRows | — | **none** (reactivity already live) |
| provisioning config | KPI `_T`→`$ctx`; author `on[]` | authoring |

The heavy lifting is **wiring one adapter and retiring one one-off**, not new machinery — because the read path, the store `= ANY`, the CommandBus write point, and the KPI reactivity are already in place. The capability was designed and typed; it was never plugged in.
