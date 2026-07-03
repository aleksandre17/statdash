# DESIGN — Directional SECTOR arm of the regional cross-filter (AR-38)

> The second half of the cross-filter SPEC (`SPEC-regional-crossfilter-behavior.md`). The **region** arm ships and is live (select region → pin `geo`, DISPLAY `sector`, composition shows sectors stacked by the selected regions). This doc designs the **sector** arm: **select sector → pin `sector`, DISPLAY `geo`** (that sector across regions), plus the canonical **compound** (region ∧ sector) semantics.
>
> Reconciled with **AR-36** (`DESIGN-grammar-of-interaction.md`) — this is the completion of AR-36 §2.2's already-sketched two-param derive, refined where the SPEC now disambiguates the compound tiebreaker. **Design-only run — no code / provisioning touched.**

---

## 0. TL;DR

The sector arm is **already 90% built by AR-36** and needs **no engine change**. The live provisioning already:
- resolves state-bound encoding channels (`label:{$ctx:_xDim}`, `series:{$ctx:_seriesDim}`) and state-bound pipe params (`by:{$ctx:_byDims}`, `sort:{$ctx:_sortBy/_sortDir}`) and `chartType:{$ctx:_mark}` — the AR-36 P0–P3 seams are in code (`resolveEncodingRefs`, `resolvePipeRefs`);
- carries a **`sector` filter param** (filter-bar `select` + a range-view `point:click` → `filter sector`) and a **`region` filter param** (map/chart/table cross-filter);
- carries the six derives (`_xDim/_seriesDim/_mark/_byDims/_sortBy/_sortDir`).

The **only gap**: those six derives key **solely on `$ctx:region`** — they are blind to `sector`. So a selected sector narrows some panels but never **reorients** the composition. The deliverable is therefore, in order of size:

1. **Extend the six derives** to a two-param truth table (region ∧ sector), with a **sector-priority** tiebreaker for the compound case — *pure config, no code.*
2. **Harmonize the `sector` unselected sentinel** from `_T` to `""` (peer with `region`), so ONE store-agnostic compound clause `sector:{$ne:"_T", $ctx:"sector"}` narrows on both stores — *pure config, +4 companion `default:"_T"` edits.*
3. **(Optional, YAGNI-gated) direct-manipulation**: click a sector bar in the composition to pin it, via a small state-bound `FilterAction.key/fromField` react delta (mirrors `resolveEncodingRefs`).

Phase 1+2 fully satisfy the owner requirement with **zero engine change**; the sector is selected via the existing filter-bar control. Phase 3 is the ergonomic nicety.

---

## 1. The chosen semantics (canonical, least-astonishing)

### 1.1 The directional law (from AR-36, SPEC-grounded)

> **The dimension in FOCUS → `series` (stacked) + pinned to the selection; its CO-dimension → `x` (expanded, all members). No selection → the primary dim (`geo`) on `x`, no series (summary donut).**

For a single selection this is unambiguous. The open question is the **compound tiebreaker**: when BOTH a region and a sector are pinned, *which* is the focus (series) and which is the co-dim (x)?

### 1.2 Verdict — SECTOR-PRIORITY, with justification

**When a sector is active, sector is the focus: `series = sectorLabel`, `x = geoLabel`, regardless of whether regions are also selected.**

Grounds:
1. **SPEC line 23 is explicit**: *"Select sector → pin sector, DISPLAY the geo dimension (that sector across regions)."* Selecting a sector must put **geo on x**. In the compound case a sector *is* selected, so geo must be on x → sector-priority.
2. **Owner intent (today)**: *"the selected sector should show."* The sector is named as the thing that becomes the subject → it takes the salient (series/color) channel and the view reorients around it.
3. **Determinism / permalink (SSOT)**: a *static* priority is a pure function of the param set `{region, sector}` — it round-trips through the URL and reloads identically. The rejected alternative (recency: "most-recently-clicked dim wins") needs order state the URL doesn't carry → a reload can't reconstruct it (breaks `FF-PIVOT-PERMALINK`).

This **refines** AR-36 §2.2, which sketched a *region-priority* derive (`_xDim: if region then sectorLabel else geoLabel`). That sketch predates the SPEC-line-23 clarification and is correct for sector-**only** but wrong for **compound** (it would keep x=sector when a sector is the active subject). We adopt sector-priority; AR-36's mechanism is otherwise unchanged.

### 1.3 Compound is INTERSECTION, not replace

Selecting a sector while regions are selected **intersects** (compound filter: *that sector, in those regions*) — it does **not** clear the region selection. Region selection remains multi-select CSV `= ANY` on `geo`; sector selection is (P1) single, (P-multi) multi-select CSV `= ANY` on `sector`. The two params are orthogonal axes (Law 1) that AND together in every query. This is the least-surprising reading of *"when a sector is ALSO selected — along with the individual regions"* (owner's own "also"/"along with" = additive intersection).

---

## 2. State matrix (what each panel shows) — the acceptance spine

Params: `region` (CSV, unselected = `""`), `sector` (unselected = `""` after harmonization). "sel" = a real member is pinned.

| # | region | sector | Composition (id `sectors`) | Comparison (`regions-bar`) | Map | KPIs | Title |
|---|--------|--------|----------------------------|----------------------------|-----|------|-------|
| **A** none | `""` | `""` | **donut** of all regions (`x=geoLabel`, no series, `by=[geo]`) | hbar, **all** regions (total each) | plain choropleth | national totals | national |
| **B** region-only | sel | `""` | **stacked bar**, `x=sectorLabel`, `series=geoLabel` (selected regions' sectoral structure) | hbar, **only selected** regions (total each) | highlight selected | selected regions' combined | `{_regionTitle}` |
| **C** sector-only | `""` | sel | **stacked bar**, `x=geoLabel`, `series=sectorLabel` (that sector across **all** regions) | hbar, **all** regions, **that sector**'s value each | plain choropleth | that sector, national | sector (see §5 note) |
| **D** compound | sel | sel | **stacked bar**, `x=geoLabel`, `series=sectorLabel` (that sector across the **selected** regions) | hbar, **selected** regions, **that sector**'s value each | highlight selected | that sector, selected regions | `{_regionTitle}` |

Rows A/B are the shipped region arm (unchanged). Rows C/D are what this design adds. Note the **symmetry**: B and C are mirror images across the `geo`⇄`sector` axis — exactly the AR-36 pivot, now driven by *which* param is pinned.

---

## 3. The config deltas (the whole build, layer by layer)

### 3.1 The six derives → two-param truth table (`vars`, ~L4742)

Sector-priority nested `op:if` (expr `if`, cond may be an `and`/`nin` expr — verified available in `@statdash/expr`). "sector is active" = `sector ∉ {"", "_T"}`; "region is active" = `region ≠ ""`. Encode the sector test robustly so a stray `""` or leftover `_T` never counts as a selection:

```jsonc
// _seriesDim — the FOCUS channel (stacked). Sector wins when active.
"_seriesDim": { "op": "if",
  "cond": { "op": "nin", "left": { "$ctx": "sector" }, "right": ["", "_T"] },
  "then": "sectorLabel",
  "else": { "op": "if",
    "cond": { "op": "ne", "left": { "$ctx": "region" }, "right": "" },
    "then": "geoLabel",
    "else": "" } },                                   // A: no series → donut

// _xDim — the CO-dimension (expanded). Inverse of the focus.
"_xDim": { "op": "if",
  "cond": { "op": "nin", "left": { "$ctx": "sector" }, "right": ["", "_T"] },
  "then": "geoLabel",                                 // C/D: sector active → geo on x  (SPEC line 23)
  "else": { "op": "if",
    "cond": { "op": "ne", "left": { "$ctx": "region" }, "right": "" },
    "then": "sectorLabel",                            // B: region-only → sector on x
    "else": "geoLabel" } },                           // A: default primary dim on x

// _mark — bar when EITHER dim is active, donut when neither.
"_mark": { "op": "if",
  "cond": { "op": "or", "exprs": [
    { "op": "nin", "left": { "$ctx": "sector" }, "right": ["", "_T"] },
    { "op": "ne",  "left": { "$ctx": "region" }, "right": "" } ] },
  "then": "bar", "else": "donut" },

// _byDims — need BOTH label fields whenever we rotate; just geo for the donut.
"_byDims": { "op": "if",
  "cond": { "op": "or", "exprs": [
    { "op": "nin", "left": { "$ctx": "sector" }, "right": ["", "_T"] },
    { "op": "ne",  "left": { "$ctx": "region" }, "right": "" } ] },
  "then": "sector,geo,time", "else": "geo" },

// _sortBy / _sortDir — sector active → rank regions by value desc;
//                       region-only → sector order asc; none → value desc.
"_sortBy": { "op": "if",
  "cond": { "op": "nin", "left": { "$ctx": "sector" }, "right": ["", "_T"] },
  "then": "value",
  "else": { "op": "if",
    "cond": { "op": "ne", "left": { "$ctx": "region" }, "right": "" },
    "then": "sectorOrder", "else": "value" } },
"_sortDir": { "op": "if",
  "cond": { "op": "nin", "left": { "$ctx": "sector" }, "right": ["", "_T"] },
  "then": "desc",
  "else": { "op": "if",
    "cond": { "op": "ne", "left": { "$ctx": "region" }, "right": "" },
    "then": "asc", "else": "desc" } }
```

No engine touch — these resolve through the existing `resolveEncodingRefs` (label/series) and `resolvePipeRefs` (by/sort) dims→vars fallback, and `_mark` through the existing `chartType:{$ctx:_mark}` binding. The `_regionSel` / `_regionTitle` / `regionObj` vars are unchanged. (`op:case` could later flatten the nested `if` — ergonomics only, not required.)

### 3.2 The compound filter clause + sentinel harmonization

**Root cause.** The composition query (~L3801) filters `sector:{"$ne":"_T"}` (all real sectors) and never reads the sector selection. To narrow to the selected sector in C/D **without breaking** the all-sectors case in B, the clause must switch wire-shape by state. On the **ApiStore** this is unavoidable: `{$ne:"_T"}` alone deletes the pin and fetches broad (correct for B); a positive `sector=X` pin is needed for C/D (verified in `store-filter.ts` `buildObsFilterParam` L86–103 + `matchesFilter` L228–243).

**The clean fix (store-agnostic, no engine change): harmonize the sector sentinel `"_T" → ""`** so `region` and `sector` are true peers, then use the symmetric compound clause:

```jsonc
// composition query.filter.sector  (was {"$ne":"_T"})
"sector": { "$ne": "_T", "$ctx": "sector" }
```

Behavior of the `NeCtxRef` `{$ne, $ctx}` (already implemented, no new op):
- **B (sector = `""`)**: `$ctx` resolves empty → wildcard; `$ne:"_T"` still excludes the total row → **all real sectors**. Wire: no positive pin emitted (empty `$ctx`, empty baseline) → fetch-broad, exclude client-side. Works on **both** stores.
- **C/D (sector = `X`)**: `$ctx` narrows to `X`'s leaves; `$ne:"_T"` harmless. Wire: sends `sector=X`. Works on both stores.

This makes the sector arm a byte-for-byte **mirror of the geo arm** (the map/comparison already use `geo:{$ne:"_T", $ctx:"geo"}`). The asymmetry (region uses `""`, sector uses `"_T"`) was itself a latent Law-1 privileged-dimension smell; harmonizing removes it. That symmetry is the architectural argument, not a workaround.

**Companion edits required by the sentinel flip** (each is a one-line `default:"_T"` addition so "no sector" still means "the total member" where a panel wants the aggregate row — otherwise a bare `{$ctx:sector}` with `""` would wildcard and double-count the `_T` total against its leaves):

| Node / clause | Current | Change |
|---|---|---|
| `sector` param def (~L4499) | `"default": "_T"`, `type:"select"` | `"default": ""` (emptyLabel "All" already handles display) |
| composition (id `sectors`, ~L3808) | `sector:{"$ne":"_T"}` | `sector:{"$ne":"_T","$ctx":"sector"}` |
| GVA-by-region donut (~L3597) | `sector:{"$ctx":"sector"}` | add `"default":"_T"` |
| comparison `regions-bar` (~L4002) | `sector:{"$ctx":"sector"}` | add `"default":"_T"` |
| comparison `regions-bar-range` (~L4122) | `sector:{"$ctx":"sector"}` | add `"default":"_T"` |
| dynamics `sectors-range` (~L4263) | `sector:{"$ctx":"sector"}` | add `"default":"_T"` |

The ~15 KPI/GDP clauses already carry `sector:{"$ctx":"sector","default":"_T"}` (e.g. L3155, L3172) → **safe, untouched**. `sector-history` (~L4404) is pure `{"$ne":"_T"}` → wants all sectors → **safe, untouched**. This is the complete, bounded ripple — all provisioning JSON, no engine.

### 3.3 What the KPIs and comparison do for free

KPIs (`reg-gva`, siblings) already read `geo:{$ctx:geo,$ne:_T}` + `sector:{$ctx:sector,default:_T}` → they **already** reflect region ∧ sector (State C/D show the selected sector's value; D scopes to selected regions). The comparison `regions-bar` already reads both → with the `default:"_T"` companion it yields the correct total/selected-sector per region across states A–D. So beyond §3.1/§3.2, **no KPI or comparison logic change** — they were built sector-aware and only awaited the derive.

---

## 4. Interaction — how a sector gets selected

Two selection surfaces **already exist** and satisfy the requirement with the §3 config alone:
1. **Filter-bar `sector` control** (~L4499) — the canonical select; P1 target.
2. **Range-view stacked-area `point:click` → `filter sector` `replace`** (~L4315) — the dynamics perspective.

### 4.1 (Optional P3) direct manipulation on the composition

The owner's natural flow is: regions selected → composition shows sectors → *click a sector bar* to pin it. Today the composition's `point:click` sets `region` (`fromField:id`, `id=geo`). To also pin a sector by clicking the sector bar in State B, the click's **target dimension must rotate with `_xDim`** (click the x-category = pin that dim: State A/donut → region; State B → sector).

The law-compliant way (mirrors AR-36's encoding-channel Postel-widen exactly): allow `FilterAction.key` and `FilterAction.fromField` to accept a `{$ctx:key}` ref, lowered in `useNodeInteractions` through the **same ref dispatcher** (`resolveRef`, dims→vars fallback) as `resolveEncodingRefs`:

```jsonc
"on": [{ "event": "point:click", "actions": [
  { "type": "filter", "key": { "$ctx": "_selKey" }, "fromField": { "$ctx": "_selField" }, "mode": "toggle", "max": 10 }
] }]
```
with two new derives `_selKey` (param: State-A/donut → `"region"`, State-B → `"sector"`) and `_selField` (row field: `"geo"` / `"sector"`). This is **one small react delta** (resolve two ref-able string fields before `applySelection`; bare strings byte-identical), open-for-extension (Law 8), agnostic (Law 1), and routes through the unchanged single CommandBus write point (`FF-XF-ONE-WRITE-POINT` holds). **YAGNI gate**: build only if the owner wants click-the-bar beyond the dropdown; P1+P2 already meet the SPEC.

### 4.2 (Optional P4) multi-select sector `= ANY`

The derives and `{$ne,$ctx}` clause already handle a CSV sector (matchesFilter splits multi-value → `= ANY`, exactly like geo). To make sector multi-select: flip the control `type:"select" → "multi-select"` and the range/composition click `mode:"replace" → "toggle"` (+`max`). Render implication: multiple sectors stack as multiple series in C/D (the composition already stacks). Nearly free; sequence after P1–P2 land.

---

## 5. Open SPEC points to confirm with the owner (small)

- **Title in State C (sector-only, no region).** `{_regionTitle}` is empty when no region is pinned. Options: (a) leave the section's static title; (b) add a `_focusTitle` derive that shows the selected sector label when sector-only. Recommend (b) as a 1-var follow-up (`join-labels` on `$d:sector`), not blocking.
- **Map in State C/D.** The map is a region-selection surface; a selected sector does not change region highlight. Keep as-is (no sector re-color) unless the owner wants the choropleth values to reflect the selected sector — that would be a separate enhancement (data-driven choropleth by sector), out of scope here.

---

## 6. Strangler / build phases + gates

| Phase | Deliverable | Files | Gate to advance |
|---|---|---|---|
| **P0 — sentinel + companions** | Flip `sector` param default `"_T"→""`; add `default:"_T"` to the 4 bare `{$ctx:sector}` clauses (§3.2 table) | provisioning only | build+typecheck green; **FF-DIM-SENTINEL-SYMMETRY** (no `_T` default on the sector param; no bare `{$ctx:sector}` without `default`) |
| **P1 — compound clause** | composition `sector:{"$ne":"_T","$ctx":"sector"}` | provisioning | State B still shows all sectors (no regression) on BOTH stores; **FF-SECTOR-COMPOUND-FILTER** |
| **P2 — two-param derives** | Extend the 6 derives to the §3.1 truth table | provisioning | derives round-trip (`roundtrip-pages`); **FF-DIRECTIONAL-TRUTH-TABLE** unit-asserts A/B/C/D → `_xDim/_seriesDim/_mark/_byDims`; **FF-SECTOR-DERIVE-AGNOSTIC** (no privileged logic; resolver dim-blind — extends FF-PIVOT-AGNOSTIC) |
| **P3 — (opt) click-to-pin sector** | State-bound `FilterAction.key/fromField` + `_selKey/_selField` derives + a "select sector" gesture on the composition | `packages/react` (`useNodeInteractions`, `node-events`) + provisioning | bare-string action byte-identical; **FF-ACTION-KEY-POSTEL**; **FF-XF-ONE-WRITE-POINT** still holds |
| **P4 — (opt) multi-select sector** | control `multi-select` + click `toggle` | provisioning | `= ANY` verified; multi-series stack renders |

P0→P1→P2 is the shippable target and is **provisioning-only**. Verify each in a real browser on both a live-API page and the ExternalStore path before advancing (the compound clause is the one behavior that differs by store).

### Fitness gates (lock the invariants)
- **FF-DIRECTIONAL-TRUTH-TABLE** — the 4-state derive matrix (§2) is asserted as a unit truth table; a change to any derive that breaks a cell fails.
- **FF-SECTOR-COMPOUND-FILTER** — the composition query yields *all real sectors* when `sector=""` and *only sector X* when `sector=X`, asserted on **both** `ExternalStore` (client predicate) and the `ApiStore` **wire param** (the store-dependent case).
- **FF-DIM-SENTINEL-SYMMETRY** — `region` and `sector` share the `""` unselected sentinel and the `{$ne:"_T",$ctx:dim}` idiom; a scan forbids a `_T` default on the sector *param* and forbids a bare `{$ctx:sector}` filter lacking `default:"_T"` (Law-1 symmetry lock, prevents the double-count regression).
- **FF-SECTOR-DERIVE-AGNOSTIC** — extends `FF-PIVOT-AGNOSTIC`: the resolver path stays dimension-blind (no `sector`/`geo` literal in engine/react).
- **(reuse) FF-XF-ONE-WRITE-POINT · FF-PIVOT-PERMALINK · FF-ENCODING-POSTEL** — sector selection routes through the one CommandBus point, region∧sector round-trips the URL, bare channels stay byte-identical.

---

## 7. Rejected alternatives (≥2)

1. **Region-priority tiebreaker (AR-36 §2.2 as-sketched).** Rejected for the compound case: contradicts SPEC line 23 — a selected sector must DISPLAY geo (x=geo); region-priority leaves x=sector when the sector is the active subject (astonishing, and the "selected sector" fails to become the subject). Kept only as the *sector-only* branch, where it and sector-priority agree.
2. **Recency tiebreaker (most-recently-clicked dim wins the focus).** Rejected: introduces order-dependent sidecar state that the URL doesn't carry → a reload can't reconstruct the focus (breaks `FF-PIVOT-PERMALINK` + SSOT). Static sector-priority is a pure function of the param set → deterministic and reload-stable.
3. **Keep sector sentinel `"_T"`; add `$ctx` to the existing `{$ne:"_T"}`.** Rejected: on the ApiStore this sends `sector="_T"` then excludes `_T` client-side → **empty** in State B. The wire shape is genuinely state-dependent; only harmonizing the sentinel to `""` yields one store-agnostic clause.
4. **A second sector-selection state store / bespoke handler.** Rejected: SSOT + Law 1 — sector is already a filter param on the URL spine; a parallel store violates `FF-XF-ONE-WRITE-POINT`.
5. **Client-side data narrowing (filter `DataRow[]` by the selected sector in the renderer).** Rejected: breaks the encoding golden rule ("data is never pivoted; encoding says HOW") and the store-as-SSOT; narrowing belongs in the query filter, where caching and provenance are honored.
6. **A dedicated compound-filter spec kind / new engine op.** Rejected: YAGNI — the existing `NeCtxRef` `{$ne,$ctx}` already expresses the compound narrow once the sentinel is harmonized; a new op forks the resolve path for no new capability.

---

## 8. Collision note — `feat/chart-lowcardinality-render`

That branch changes the **composition chart rendering** (colors / bar-width for low-cardinality series). Overlap with this initiative:

- **This design edits**: the page-level `vars` block (~L4742–4790), the composition **section** `data.query.sector` clause (~L3808), and the 4 companion `default` clauses. All are `data`/`vars` sub-objects.
- **That branch edits**: the composition chart **child** node's view/styles (colors, bar-width) and `packages/plugins` chart render code.
- **Textual proximity, disjoint sub-objects**: both live in the same large JSON and both concern the `sectors` node subtree, so a concurrent edit risks a **textual merge conflict** even though the JSON keys are disjoint.
- **Semantic complementarity (flag this)**: sector-priority makes States C/D render **low-cardinality** bars (often a single sector series across regions) — exactly the case the render branch styles. So the two are complementary, but the low-cardinality render must be **re-verified against the NEW orientation** (`x=geo`, 1 series), not only against State B (`x=sector`, N region series).
- **Recommended sequence**: land `feat/chart-lowcardinality-render` **first** (a self-contained visual pass), then apply P0–P2 on top and rebase; or, if parallel, scope the render branch to the chart child + plugins and this work to `vars`/`data`/filter clauses, and rebase P0–P2 onto the render commit before merge. P3/P4 (react) are disjoint from that branch entirely.

---

_Author: architect. Registry: AR-38 (DESIGNED). Depends-on: AR-36 (P0–P3 in code). Awaiting owner confirm of the sector-priority tiebreaker + the sentinel harmonization, then route P0._
