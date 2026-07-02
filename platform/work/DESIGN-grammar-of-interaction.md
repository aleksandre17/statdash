# DESIGN — Grammar of Interaction: runtime PIVOT / re-encode as a declarative capability (AR-36)

> Owner vision (verbatim intent): the chart's encoding — `x=sector, series=geo (selected regions, stacked)` ⇄ `x=geo, series=sector` — must be **runtime-swappable via events/filters**, NOT hardcoded as two `visibleWhen` A/B panels. This is the OLAP **pivot / rotate** operation elevated to a first-class **declarative, interactive** capability: encoding channels bind to STATE, and a gesture rotates which dimension sits on which channel.
>
> Status: **DESIGNED** (owner sign-off gates build). Design-only run — no provisioning/core/react/charts code touched this pass.

---

## 0. TL;DR

A pivot is not new plumbing — it is the **Grammar of Graphics golden rule already in `encoding.ts`** ("data is never pivoted; `EncodingSpec` tells the renderer HOW to pivot") **wired to STATE** through the **cross-filter spine the owner already validated** (`on[]` → `emit` → `applySelection` → single CommandBus write point → filter param → URL permalink).

The whole capability reduces to **one small additive seam** plus **reuse of three existing seams**:

| Piece | Mechanism | New or reuse |
|---|---|---|
| Encoding channel ← state | `encoding.label: { $ctx: "_xDim" }` resolved in `interpretSpec` before `applyEncoding` | **NEW, tiny, additive** (Postel: `string \| ChannelDef \| CtxRef`) |
| "Which dim is x vs series" derived from selection | `vars` derive (`op:if`) computing `_xDim`/`_seriesDim` from the selection params | reuse (`filter-derive` / expr — same mechanism as today's `_regionSel`) |
| Directional select (region→sectors, sector→regions) | existing `FilterAction` on map/bar/table (`region`/`sector` params) | reuse (zero new wiring) |
| Explicit rotate gesture | new `PivotAction` folded through `useNodeInteractions` → same CommandBus point | **NEW action type** (one union arm) |
| Permalink | pivot state IS a filter param | reuse |

No second state store, no functions in config, no privileged dimension names, no client-side row transpose.

---

## 1. The problem, stated precisely (evidence)

The regional page (`geostat.provisioning.json`) carries **two** composition panels gated by the same state:

- `sectors` (id L3544) — **State A** donut: `by:["geo"]`, `encoding:{label:"label"}` (no `series`), `filter.sector:{$ctx:sector}`, `visibleWhen _regionSel == none`.
- `sectors-multi` (id L3697) — **State B** stacked bar: `by:["sector","geo","time"]`, `encoding:{label:"sectorLabel", series:"label"}`, `filter.geo:{$ctx:geo}`, `filter.sector:{$ne:_T}`, `visibleWhen _regionSel == some`.

`_regionSel` (L4626) is already a `vars` derive: `if (region != "") then "some" else "none"`. So the platform **already derives a discriminant from selection state** — it just spends it on `visibleWhen` (pick one of two frozen panels) instead of on the **encoding** (rotate one panel's channels).

The two panels differ across exactly four axes, all mechanically derivable from *which selection is active*:

| | State A (no sel) | State B (region sel) | select-sector (directional) |
|---|---|---|---|
| pinned dim (filter `$ctx`) | sector→_T | geo→selection | sector→selection |
| expanded dim (`$ne _T`, on **x**) | geo | sector | geo |
| series (stacked) | — none | geo (selection) | sector (selection) |
| mark | donut | stacked bar | stacked bar |

The **directional rule** (SPEC-regional-crossfilter §Selection semantics) generalises to one law, agnostic of `sector`/`geo`:

> **The SELECTED dimension → `series` (stacked) and is pinned to the selection; the CO-dimension → `x` (expanded, all members). No selection → the page's primary dim on `x`, no series (summary mark).**

That law is a **pure function of state**. Encoding-binding-to-state is the entire capability.

---

## 2. The grammar

### 2.1 State-bound encoding channel (the one new seam)

`encoding.ts` today: a channel is `string | ChannelDef` (`ChannelDef = {field,type?,key?}`). Postel-widen it additively:

```ts
export type CtxRef        = { $ctx: string }                 // resolves to a field NAME from state
export type EncodingChannel = string | ChannelDef | CtxRef   // bare string stays byte-identical
```

Authoring (the folded panel):

```jsonc
"data": {
  "type": "query",
  "encoding": {
    "label":  { "$ctx": "_xDim" },      // ← was "sectorLabel" | "label"  (rotates with state)
    "series": { "$ctx": "_seriesDim" }, // ← was "label"       | absent    (rotates with state)
    "color":  "color"
  },
  "pipe": [
    { "op": "aggregate", "agg": "sum", "by": ["sector", "geo", "time"], "measure": "value" },
    { "op": "lookup", "key": "sector", "from": {"$d":"sector"}, "fields": ["sectorLabel","sectorOrder"] },
    { "op": "lookup", "key": "geo",    "from": {"$d":"geo"},    "fields": ["geoLabel","color"] }
  ],
  "query": { "measure": "regional.gva", "filter": {
    "measure": "GVA",
    "geo":    { "$ctx": "geo",    "$ne": "_T" },   // selection scopes geo (already the cross-filter)
    "sector": { "$ctx": "sector", "$ne": "_T" },   // selection scopes sector
    "time":   { "$ctx": "time" }
  } }
}
```

**Key architectural point — data is aggregated by BOTH dims once; only the encoding rotates.** The pipe emits long-format rows keyed by `(sector, geo)` with both label fields present (`sectorLabel`, `geoLabel`). Rotating `x` ⇄ `series` is then a pure re-read of the SAME `DataRow[]` — exactly the encoding.ts golden rule. No re-query, no re-aggregate, no row transpose.

Resolution point: `interpretSpec` gains a one-line pre-pass `resolveEncodingRefs(enc, ctx)` that substitutes any `{$ctx:k}` channel → `String(ctx.dims[k] ?? ctx.vars[k])` (a field name), then hands the concrete `EncodingSpec` to `applyEncoding` **unchanged**. Bare-string channels are untouched → byte-identical (FF-ENCODING-POSTEL).

### 2.2 The state that drives it — a `vars` derive (reuse)

`_xDim` / `_seriesDim` are computed from the selection params by the SAME derive mechanism that already computes `_regionSel` — no new state, no privileged dim:

```jsonc
"vars": {
  // which dim is currently the selected (stacked) one:
  "_seriesDim": { "op": "if",
    "cond": { "left": {"$ctx":"region"}, "op": "ne", "right": "" }, "then": "geoLabel",
    "else": { "op": "if",
      "cond": { "left": {"$ctx":"sector"}, "op": "ne", "right": "" }, "then": "sectorLabel",
      "else": "" } },                              // no selection → no series
  // the co-dimension goes on x (inverse of the above):
  "_xDim": { "op": "if",
    "cond": { "left": {"$ctx":"region"}, "op": "ne", "right": "" }, "then": "sectorLabel",
    "else": "geoLabel" },
  // optional mark binding (P3) — donut when unselected, bar when a selection stacks:
  "_mark": { "op": "if",
    "cond": { "left": {"$ctx":"region"}, "op": "ne", "right": "" }, "then": "bar",
    "else": { "op": "if",
      "cond": { "left": {"$ctx":"sector"}, "op":"ne", "right":"" }, "then":"bar", "else":"donut" } }
}
```

The engine never sees `sector`/`geo` — it resolves `{$ctx:"_xDim"}` to whatever field the config named. **Agnostic by construction** (Law 1): the derive is config data; the resolver is dimension-blind. A 3-way `op:case` may be added later to flatten the nested `if` (optional ergonomics, not required).

### 2.3 The interactive verb — `PivotAction` (the manual rotate)

Two triggers produce a pivot; **both write through the single CommandBus point** (no second state path):

1. **Directional (implicit) — needs NO new action.** Selecting a region on the map / a sector on a bar is already a `FilterAction` writing `region`/`sector`. The §2.2 derive turns that param into the encoding. The rotation is a *consequence* of the selection the cross-filter already performs.

2. **Explicit rotate (manual) — a "swap axes" control.** One new arm on the `NodeAction` union:

```ts
export interface PivotAction {
  type: 'pivot'
  /** The param holding the axis assignment (a filter param → URL permalink). */
  key:  string            // e.g. "_pivot"
  /** How the gesture mutates it. 'rotate' = cycle the axis order; 'set' = pin one. */
  mode?: 'rotate' | 'set'
  /** For 'set': the value to write (an axis-order token). */
  value?: string
}
export type NodeAction = FilterAction | PivotAction
```

`useNodeInteractions` grows one branch mirroring the `filter` branch: fold the pivot through a pure `applyPivot(current, mode, value)` reducer (peer of `applySelection`, lives in `packages/core`), accumulate into the SAME `writes` map, dispatch via `bus` (`filter:set`). The pivot param feeds `_xDim`/`_seriesDim` (the derive reads `_pivot` when present, else falls back to the selection-derived default). Result: manual rotate and directional selection converge on ONE param → ONE URL → ONE permalink.

---

## 3. Fold-the-two-panels decision (with evidence)

**Verdict: fold to ONE pivot-panel — in two moves, Strangler-sequenced.**

- **The two *orientations* of the stacked bar (State B ⇄ its transpose) are the SAME node.** Identical store, measure, time, `by:[sector,geo]`, and mark. They differ ONLY in which of two already-present fields (`sectorLabel`/`geoLabel`) sits on `label` vs `series`. Keeping them as two panels would be textbook **Shotgun Surgery** (every new orientation = a new panel) and is not authorable as a capability. **Evidence:** `applyEncoding` already renders identical `DataRow[]` for both orientations — the transpose is a channel re-read, provably not a new dataset. → **Fold (P2).**

- **State A (donut, single-dim rollup) is a genuinely different MARK + GRAIN**, not a rotation. Two honest options, and I recommend collapsing it too:
  - *Fold it as well (recommended, P3):* bind `chartType: {$ctx:"_mark"}` and allow `series` to resolve empty. When no selection → `_seriesDim=""` (no series) + `_mark="donut"` → the panel degrades to the single-dim donut. One node, three states. This is the owner's stated target ("ONE pivot-panel replacing the two").
  - *Keep it separate (rejected as the end-state, accepted as the P2 interim):* a summary donut is arguably a distinct SoC. But `_mark` binding is cheap and removes the last `visibleWhen` fork, so the extensible mechanism wins over the point-split (Law 6/8).

  **Trade-off named (ISO 25010):** folding buys *modifiability + reusability* (a new orientation/dim = config, not a new panel) at the cost of one extra binding (`_mark`) whose value space (donut/bar) must be validated. Net positive; sequenced so the high-value rotation lands first and de-risks the mark step.

**End state: one `composition` pivot-panel. Both `sectors` and `sectors-multi` deleted.**

---

## 4. Layer map (respects the dependency arrow)

```
contracts ← expr ← core ← charts ← react ← plugins ← apps
```

| Concern | Layer | Change |
|---|---|---|
| `EncodingChannel` widened to accept `CtxRef`; `resolveEncodingRefs(enc,ctx)` pre-pass in `interpretSpec` | **packages/core** (`data/encoding.ts`, `data/spec.ts`) | additive |
| `applyPivot(current,mode,value)` pure reducer (peer of `applySelection`) | **packages/core** (`data/applyPivot.ts`) | new pure fn |
| `_xDim/_seriesDim/_mark` derive — no code, uses existing `filter-derive`/expr ops | **packages/core** (config) | none (data only) |
| `PivotAction` union arm + `NodeEventTrigger` (reuse) | **packages/react** (`engine/node-events.ts`) | additive |
| pivot branch in the ONE interaction adapter | **packages/react** (`engine/useNodeInteractions.ts`) | additive |
| state-bound `chartType` resolution (`{$ctx:"_mark"}`) + rotate control (a chrome button emitting `pivot`) | **packages/plugins** (chart panel shell) | additive |
| the folded `composition` panel + vars + rotate control config | **apps/api provisioning** | replaces 2 panels |

Charts (`packages/charts`) needs **no change** — it consumes resolved `DataRow[]`; the rotation is upstream in core encoding. The arrow is never crossed: pure resolve in core, action wiring in react, config in apps.

---

## 5. Constructor-readiness (ties to AR-10)

Pivot surfaces as **discriminants, not bespoke props** — the Constructor sees only what the schema declares:

- **Channel source** — each encoding channel's PropSchema becomes `oneOf: [ {field-name}, {$ctx-ref} ]` → a "literal vs state-bound" toggle in the encoding editor. One schema change, every channel gains it.
- **Pivot action** — `PivotAction` is a new arm of the `NodeAction` discriminated union → auto-appears in the existing `on[]` action-type dropdown (same as `filter` does today). No new authoring subsystem.
- **The `_xDim/_seriesDim` vars** round-trip through the existing `vars` serializer already exercised by `roundtrip-pages.fitness.test.ts`.

So AR-36 is authored via AR-10's SSOT (`describeApp()`/PropSchema consumed, never forked) — a capability the palette can browse, not a hand-written config.

---

## 6. Phased Strangler build plan

| Phase | Deliverable | Gate to advance |
|---|---|---|
| **P0** — seam | Widen `EncodingChannel` → `CtxRef`; `resolveEncodingRefs` pre-pass in `interpretSpec`. Bare strings byte-identical. | build+typecheck green; **FF-ENCODING-POSTEL** locks additivity |
| **P1** — state derive | Author `_xDim/_seriesDim` vars from selection; unit-assert the directional truth table (region-sel→x=sector; sector-sel→x=geo; none→x=geo,no series). | derive round-trips; **FF-PIVOT-AGNOSTIC** (resolver has no dim literal) |
| **P2** — fold orientations | Build ONE `composition` panel (`by:[sector,geo]`, `encoding.label/series:{$ctx}`); **delete `sectors-multi`**. `sectors` donut stays behind `visibleWhen` (strangler: old code lives till replaced). | State-B ⇄ transpose verified real-browser; **FF-PIVOT-PERMALINK** |
| **P3** — fold the donut | Bind `chartType:{$ctx:"_mark"}` + empty-series degrade; **delete `sectors`**. ONE panel, three states. | donut(no-sel)/bar(sel) verified; last `visibleWhen` fork gone |
| **P4** — explicit rotate verb | `PivotAction` + `applyPivot` reducer + a "swap axes" chrome control; manual rotate independent of selection. | **FF-PIVOT-ONE-WRITE-POINT** extends FF-XF-ONE-WRITE-POINT |
| **P5** — Constructor surface (AR-10) | Channel-source `oneOf` PropSchema + pivot action in the `on[]` form + palette entry. Build when the authoring UI is a real consumer (YAGNI gate). | **FF-PIVOT-ROUNDTRIP** (lossless authoring) |

Old panels deleted only after the replacement verifies — Strangler-Fig, never a big-bang swap.

---

## 7. Fitness gates (lock the invariants)

- **FF-ENCODING-POSTEL** — a bare-string channel produces byte-identical `DataRow[]`; widening is purely additive.
- **FF-PIVOT-AGNOSTIC** — `resolveEncodingRefs` / `applyPivot` contain no dim-name literal (`sector`/`geo`); works for any two dims (Law 1).
- **FF-PIVOT-DECLARATIVE** — no function anywhere in a pivot/encoding config; channel refs are `$ctx` data only (extends the check-laws Law-2 scan to encoding channels).
- **FF-PIVOT-ONE-WRITE-POINT** — every pivot write goes through `CommandBus` (extends FF-XF-ONE-WRITE-POINT); no second state store.
- **FF-PIVOT-PERMALINK** — pivot/selection state round-trips through the URL param (reload reproduces the exact rotation).
- **FF-PIVOT-ROUNDTRIP** — a pivot-bound config serializes losslessly (Constructor round-trip parity).

---

## 8. Rejected alternatives (≥2)

1. **Status quo — two `visibleWhen` A/B panels.** Rejected: Shotgun Surgery (every orientation/dim = a new panel), not authorable as a capability, cannot express a manual rotate, and duplicates store/measure/pipe. This is precisely the hardcode the owner named.
2. **Imperative encoding — `getEncoding: (ctx) => …` / a function in config.** Rejected: violates Law 2 (logic in the renderer, not config), not JSON-serializable → not Constructor-ready. A renderer resolving declarative `$ctx` state is the only law-compliant path.
3. **A second selection/pivot STATE STORE (parallel to filter params).** Rejected: violates Law 1 + SSOT + the single-CommandBus-write-point invariant (`FF-XF-ONE-WRITE-POINT`). Pivot state must be a filter param on the same URL-permalink spine, not a sidecar.
4. **Client-side DATA transpose (pivot the `DataRow[]` array).** Rejected: breaks `encoding.ts`'s golden rule ("data is never pivoted; encoding tells the renderer HOW"), re-implements pivot logic the encoding layer already owns, and voids the long-format contract that lets Table and Chart share one dataset.
5. **A dedicated `pivot` DataSpec kind (`type:"pivot-panel"`) with its own resolver.** Rejected: a new spec kind for what is a re-read of the existing encoding is speculative generality (YAGNI) and forks the resolve path; the additive `CtxRef` channel rides the existing `query`/`transform` kinds with no new resolver.

---

## 9. Sequencing risk (flag for the owner)

Another agent is fixing the **State-A KPI double-count** in the SAME file (`geostat.provisioning.json`, regional page). Collision surface:

- **This run: none** — design-only, no provisioning edit.
- **Build P0/P1/P4/P5: none** — those are `packages/*` edits, disjoint from the KPI fix.
- **Build P2/P3: possible** — they edit the regional composition **section** nodes (`sectors`/`sectors-multi`, ~L3440–3908). The KPI double-count fix edits **kpi-typed** nodes on the same page. The node subtrees are disjoint, but they live in the same large JSON → concurrent edits risk a textual merge conflict.
- **Recommended sequence:** land the KPI double-count fix FIRST (smaller, a correctness bug, unblocks State-A), then start P2 on a fresh base. If parallel is required, scope the KPI agent to the `kpi` nodes and the pivot build to the composition sections, and rebase P2 onto the KPI commit before merge.

---

_Author: architect. Registry: AR-36 (VISION → DESIGNED). Awaiting owner sign-off to build P0._
