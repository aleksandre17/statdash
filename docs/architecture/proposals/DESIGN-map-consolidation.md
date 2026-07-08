# DESIGN 1 — RX-16: Consolidate the two competing map node types

> Status: ARCHITECT-GATED → **READY TO BUILD**. Design-only (no product code touched).
> Author: architect (Opus). Class-M, one-way-door content flagged inline.
> Laws in play: **Law 6** (best solution, no duplication), **Law 7** (architecture leads), **Law 1** (no privileged dims), **Law 8** (platform/OCP), **Law 9** (a11y/permalink).

---

## 1. The problem, precisely (what the code actually shows)

There are **two node types for one concept**, and the audit framing ("real vs stubbed") undersells it — they are not redundant, they are **two disjoint halves of one capability** mashed into two slices:

| | `geograph` (node slice) | `map` (panel slice) |
|---|---|---|
| File | `packages/plugins/nodes/geograph/default/` | `packages/plugins/panels/map/default/` |
| Renderer | **Real Leaflet** (`components/GeoMap.tsx`, react-leaflet + a worker fetch) | **Stub** — `MapShell.tsx` renders a placeholder `<table>` only |
| What it actually does | **Interactive region SELECTOR** — click → `ctx.bus.dispatch(filter:set)`; single accent fill, opacity for selection. **It is NOT a value choropleth.** | **Value CHOROPLETH** — `buildColorScale(rows, geoDim, valueField, …)` colors by value… that feeds **only the placeholder table** |
| Authoring model | Imperative: `geoJsonUrl` + `isoField` + `geoCodeMap` (ISO→dim bridge) + worker fetch | **Law-1 clean**: generic `view.geoDim` / `view.valueField` / `scale` / `palette` / `topology` (registry id) |
| Geometry source | Per-node URL fetched at runtime | `topologyRegistry.ts` — app-tier `registerTopology()` (OCP, Law 8) |
| sliceType / children | `node`, `canHaveChildren` (table view-toggle child), `caps:['…','nav-contributor']` | `panel`, no children |
| Live usage | **YES** — `apps/api/provisioning/geostat.provisioning.json` (the live regional map) | **NO** — referenced only by `apps/panel/src/discovery/capabilityGate.test.ts` |
| Dead code | worker.js fetch is real | `mapColorUtils.ts` (`buildColorScale`, 134 LOC + test) computes a colorMap that **renders nowhere** ("dead colorScale code") |

**Root cause (5-Whys):** the platform has *two orthogonal map features* — (A) **choropleth coloring by value**, (B) **interactive region selection** — and each was built into its own node, each missing the other half. An author cannot tell which to use; neither is complete. This is **Shotgun Surgery + Divergent Change** waiting to happen (any "map" requirement forces edits in two places).

**The correct architecture is ONE map node** that composes both orthogonal features behind one neutral model, with the **renderer** (Leaflet vs lightweight-SVG) as the only thing that varies — a `VariantDef`/Strategy. This is exactly the **neutral `ChartOutput` seam** the chart panel already uses: `interpretChart(def,rows,ctx) → ChartOutput → toApexOptions → <ReactApexChart/>` (`packages/plugins/panels/chart/default/useChartOutput.ts`). The map gets the same shape: `buildMapModel → MapModel → {LeafletView | SvgView}`.

---

## 2. Recommended approach

**Survivor = the `geograph` slice** (it is the live one, the only real renderer, the richer shell — node + table view-toggle child + `nav-contributor`). **The `map` panel folds in as the lightweight-SVG renderer variant** plus its two genuinely-valuable assets (`buildColorScale`, `topologyRegistry`). Then `panels/map` is deleted.

Three things fold in, each addressing a distinct gap:

1. **`map`'s `buildColorScale` → the live choropleth engine.** Today it is dead (feeds a placeholder). It becomes the `colorMap` producer inside the neutral `MapModel`, consumed by the Leaflet fill. This **resurrects the dead colorScale code** and makes choropleth a real, opt-in capability of the one node.
2. **`map`'s stub SVG render path → the `renderer:'svg'` `VariantDef`.** A real lightweight SVG choropleth (no Leaflet, SSR/print-safe, a11y table fallback retained) that consumes the **same** `MapModel`. This is "the other folds in as a variant."
3. **`map`'s `topologyRegistry` → the cleaner geometry source.** App-tier registered geometry (`{ data, dimProp }`, OCP) is architecturally superior to per-node `geoJsonUrl`+`isoField`+`geoCodeMap`. It is added as an **additive alternative** geometry source; the live config's URL path keeps working (byte-identical) and migrates later (deferred door, §5).

**Architecture-leads note (Law 7):** the map panel's **Law-1-generic authoring model** (`geoDim`/`valueField`) is the better contract; the unified node adopts it. `geograph`'s `geoCodeMap`/`isoField` is the legacy that migrates *to* the topology model — we do not bend the unified node back to the ISO-bridge.

### The neutral seam (mirrors ChartOutput)

```
buildMapModel(def, ctx)  →  MapModel  →  Strategy by variant `renderer`
                                          ├─ 'leaflet' → <LeafletMapView model={…}/>   (port of GeoMap)
                                          └─ 'svg'     → <SvgMapView model={…}/>        (port of MapShell SVG path)
```

`buildMapModel` is **pure** (no Leaflet import, no DOM) and lives in the slice (or `@statdash/charts` alongside `interpretChart` if a second consumer appears — YAGNI now). Both renderers are dumb views over the same model — **no duplicated data logic**, which is the whole point of FF-ONE-MAP-NODE.

---

## 3. Exact seam / types

### 3.1 Unified NodeDef (extends today's `GeographNode`, all additions optional → byte-identical)

`packages/plugins/nodes/geograph/default/GeographNode.ts`:

```ts
export interface GeographNode extends NodeBase {
  type: 'geograph'
  // … existing fields unchanged (title, data, children, view, geoJsonUrl,
  //    paramKey, isoField, geoCodeMap, labelOverrides, unit, initial*, multiSelect, maxSelect)

  // ── CHOROPLETH (folded from map panel — all optional; absent ⇒ accent-fill, byte-identical)
  valueField?: string                                   // Law 1: plain field name
  scale?:      'linear' | 'quantile' | 'threshold'
  palette?:    string[]

  // ── GEOMETRY: additive alternative to geoJsonUrl/isoField/geoCodeMap
  topology?:   string                                   // topologyRegistry id (preferred, OCP)

  // ── RENDERER is NOT a node field — it is a declared VARIANT (see 3.2)
}
```

### 3.2 Renderer as a declared `VariantDef` (the existing variant spine — zero new machinery)

The platform already has the full variant spine: `VariantDef`/`VariantSchema` (`packages/react/src/engine/variant-meta.ts`), `resolveVariants` (`packages/styles/src/resolvers/variant.ts`), and `defineShell` auto-wiring `variantAttrs` (`packages/react/src/engine/defineShell.tsx`). Renderer selection is a **declared enum variant** in the slice META:

```ts
// meta.ts — add to the geograph NodeSliceMeta
variants: {
  renderer: {
    attr:    'data-renderer',
    kind:    'enum',
    options: [
      { value: 'leaflet', label: { en: 'Interactive (Leaflet)', ka: 'ინტერაქტიული' } },
      { value: 'svg',     label: { en: 'Lightweight (SVG)',      ka: 'მსუბუქი' } },
    ],
    default: 'leaflet',        // ← byte-identical for the live regional map
    label:   { en: 'Renderer', ka: 'რენდერერი' },
  },
}
```

`defineShell` resolves this into `variantAttrs` (`data-renderer="leaflet"`) for free, and `variantPropSchema`/`nodeSchemaWithVariants` make it Constructor-authorable for free. The shell reads `def.variants?.renderer ?? 'leaflet'` to pick the Strategy. **A new renderer = one option + one View component, zero engine change** (Law 8 / OCP).

> Decision: renderer is a **variant (presentation strategy)**, not a node field, because it does not change *what* is rendered (the `MapModel`), only *how* — the exact distinction the variant spine encodes. This keeps round-trip/permalink/Constructor coherent.

### 3.3 The neutral `MapModel`

```ts
export interface MapModel {
  rows:       EngineRow[]                       // resolved data (Law 1: keyed by geoDim/valueField)
  geometry:   { features: unknown; dimProp: string }  // from topology registry OR url-loaded
  colorMap?:  Map<DimVal, string>               // present ⟺ valueField+scale authored (choropleth)
  selection:  { selected: string[]; paramKey?: string; multi: boolean; max: number }
  unit?:      string
}
export function buildMapModel(def: GeographNode, ctx: RenderContext): MapModel  // pure
```

- `colorMap` is computed by the ported `buildColorScale` **only when `valueField` is set**. Absent ⇒ `undefined` ⇒ both renderers use the current accent fill → **byte-identical live map**.
- `geometry` resolves from `topology` (registry) if present, else from `geoJsonUrl`+`isoField`+`geoCodeMap` (the transitional path). `dimProp` unifies `isoField`+`geoCodeMap` (registry path) and the ISO-bridge (url path) into one downstream contract.

---

## 4. Strangler-Fig phases (each independently green; live regional map byte-identical throughout)

| Phase | Change | Why green / byte-identical |
|---|---|---|
| **M0** — additive NodeDef | Add optional `valueField`/`scale`/`palette`/`topology` to `GeographNode`; declare `renderer` `VariantDef` (default `leaflet`) in `meta.ts`. No render change. | All additions optional; live config sets none ⇒ identical. Two-way door. |
| **M1** — neutral `MapModel` seam | Extract pure `buildMapModel(def,ctx)`. Refactor `GeoMap.tsx` to consume `MapModel` instead of loose props (mechanical). Port `map`'s `buildColorScale` into the model (computed only when `valueField` present). | Refactor-only; live map has no `valueField` ⇒ `colorMap` undefined ⇒ same accent fill. Snapshot test guards. |
| **M2** — wire choropleth | Leaflet fill reads `model.colorMap` when present, else accent. | Live config: no `valueField` ⇒ accent path ⇒ identical. New configs get real choropleth (dead code resurrected). |
| **M3** — SVG variant | Implement `<SvgMapView model={…}/>` (real lightweight SVG choropleth + a11y table fallback), ported from `MapShell.tsx`/`map.css`. Shell dispatches on `def.variants?.renderer`. Default stays `leaflet`. | New code path, default-off. Live map unaffected. |
| **M4** — retire the duplicate | Delete `packages/plugins/panels/map/**`. Update the sole consumer `apps/panel/src/discovery/capabilityGate.test.ts` to assert the unified node. **FF-ONE-MAP-NODE** now passes. | Only a test references `map`. After deletion exactly one slice provides geo rendering. |
| **M5** — *deferred door* | Migrate live geometry `geoJsonUrl`→`topology`; optionally rename discriminant `geograph`→`map` behind a registry alias. | YAGNI now. See ledger. |

Coordination: M0–M4 land in `packages/plugins` + one `apps/panel` test — this is the **frontend-floor workstream's lane**; sequence with that team to avoid collisions in the plugins tree.

---

## 5. One/two-way-door ledger

| Door | Direction | Notes |
|---|---|---|
| M0–M3 (optional fields + default-off variant) | **Two-way** | Pure additions; revert is deletion. |
| M4 delete `panels/map` | **Two-way (low-risk)** | Reversible from git; only a test consumes it. Not a true one-way door. |
| Discriminant rename `geograph`→`map` (M5) | **One-way-ish → made two-way by a registry alias** | The name `map` is more discoverable (Principle of Least Astonishment), `geograph` is the live discriminant in `geostat.provisioning.json`. **Defer (YAGNI):** the consolidation value is one-renderer-one-node, not the string. When done, register `geograph` as an alias of `map` (reversible), migrate the config, then contract. |
| Geometry model `url`→`topology` (M5) | **Two-way** | Both supported during transition; topology is the target (Law 8). |

No irreversible decision is required to ship M0–M4. The genuinely-one-way content (rename, geometry migration) is deferred behind reversible aliases.

---

## 6. Fitness functions

- **FF-ONE-MAP-NODE** (the headline): a registry/source fitness asserting (a) exactly **one** registered slice declares geo-map rendering (one `MapContainer`/Leaflet import in the whole `packages/plugins` tree), and (b) **no second** `buildColorScale`. Fails the build if a competing map node reappears.
- **FF-MAP-MODEL-NEUTRAL**: `buildMapModel` imports neither `leaflet`/`react-leaflet` nor the DOM — both renderers consume the same pure model (no duplicated data logic). Mirrors the ChartOutput neutrality.
- **FF-CHOROPLETH-OPTIONAL** (byte-identity guard): a snapshot/render test on the live regional-map config asserts the rendered fill is unchanged through M0–M4 (no `valueField` ⇒ accent fill).
- **FF-NAV-CONTRIBUTOR-PRESERVED**: the unified node keeps `caps:['collapsible','filterable','view-toggle','nav-contributor']` so the regional map still contributes to capability nav (no-privileged-node ADR).
- **FF-VARIANT-ROUNDTRIP**: `renderer` survives Constructor author → serialize → render (the existing variant round-trip fitness, extended).

---

## 7. Effort & cards closed

**Effort: ~3–4 dev-days.** M0 0.5d · M1 1d · M2 0.5d · M3 1d · M4 0.5d. M5 deferred.

**Board cards closed:** **RX-16** (the consolidation). Also retires the **dead-colorScale-code** debt and the **panels/map stub**. Verdict: **lowest-risk of the two — fully additive, one test-only consumer, byte-identical live map.** Ship M0–M4 now; defer M5.
