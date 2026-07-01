---
id: "0018"
title: "C4: Choropleth consolidation — retire panels/map node; geograph sole engine (Drift 2)"
status: backlog
class: M
priority: P1
owner: —
implements: SPEC §1 C4, §4 FF-ONE-MAP-ENGINE / FF-GEO-JOIN-NONEMPTY
depends_on: ["0012", "0016", "0017"]
links:
  - platform/work/SPEC-render-pipeline-target.md
  - platform/work/render-drift-audit.md
---
**Goal** — Retire the ENTIRE `panels/map` node so `geograph` is the sole choropleth engine; the flat map becomes a value-ramped map via the C4-c re-style fix (a late-arriving `rows` re-styles the layer) with a loud `GEO_JOIN_EMPTY` failure on an all-miss.

**Implements** — SPEC §1 C4 (fixes DRIFT 2). Invariant I-3 (one choropleth engine).

**Root cause** — (1) Flat map (the REAL fix — C4-c): the GeoJSON layer is keyed only on `selectedGeos.join(',')` (`GeoMap.tsx:202`), which OMITS `colorByGeo`, so a late-arriving `rows` (cold warm) never re-styles the layer → flat `--color-accent` at first paint. The join is NOT mismatched: both sides already key on the geo dim code — `colorByGeo` is `map.set(String(r.id),…)` (`:123`) and lookup is `colorByGeo.get(geoCodeMap[iso])` (`:126/:155/:206`). The ramp math (`quantileColors`/`sequentialRamp`) is correct. (2) Two rival engines (SSOT violation): the live `nodes/geograph/.../GeoMap.tsx` (`quantileColors`) AND the fully-registered-but-dead `panels/map` node (`mapColorUtils.ts` `buildColorScale`).

**Files / modules touched** — RETIRE THE ENTIRE `panels/map` NODE (it is a fully-registered node, not a lone file — a bare `mapColorUtils.ts` delete breaks the build; ≥8 sites):
- UNREGISTER: `packages/plugins/registry.ts:43` (`export * as map from './panels/map'`), `catalog.ts` (:38 META + :61 palette), `authoring-metas.ts` (:45,:68).
- DELETE the node: `panels/map/default/{MapShell.tsx, MapNode, meta, mapColorUtils.ts, topologyRegistry, index}`. `MapShell.tsx` imports `buildColorScale`, so the util cannot be deleted in isolation. `topologyRegistry` is consumed ONLY inside `panels/map` (MapShell + shellAxe); the live `geograph` node gets its GeoJSON via a `geoUrl` prop and is independent — verified `apps/geostat` does NOT register topology through `panels/map`, so the node is dead-to-live-config and safe to remove.
- TESTS (remove/redirect the 4): `mapColorUtils.test.ts`, `MapShell.test.tsx`, `shellAxe.fitness.test.tsx` (imports the topology fn), `token-cohesion.fitness.test.ts` (imports `mapColorUtils`).
- `packages/styles/src/utils/choropleth.ts` (`sequentialRamp` + `quantileColors`) is the SOLE token-derived rebrandable value→fill scale (AR-25); `capabilityGate` gates on the `geo` capability, not a type-sniff.
- `packages/plugins/nodes/geograph/default/components/GeoMap.tsx` — **C4-c (PRIMARY FIX): add `colorByGeo` identity to the GeoJSON `key`** (`:202`, today only `selectedGeos.join(',')`) so a late-arriving `rows` re-styles the layer; the warm contract (C2/0017) ensures `rows` is populated at first paint. **C4-b is VERIFICATION-ONLY:** both key-spaces already agree (`colorByGeo` keyed on `String(r.id)`, lookup via `geoCodeMap[iso]`) — do NOT "fix" a correct join; keep the `GEO_JOIN_EMPTY` diagnostic for when `rows.length>0` and every feature misses.

**Dependencies** — 0012 (O-4: always-ramp + selection overlay), 0016 (C1 — tooltip via `fmtNum`), 0017 (C2 — geograph `data.query` warms before paint so `rows` is populated at first paint, C4-c). Can run in parallel with C5/C6.

**Acceptance criteria (incl. fitness functions)**
- [ ] C4-c (PRIMARY): `img_1` all-10 regions ramp by GVA (not flat); a late-arriving `rows` re-styles the layer (`colorByGeo` identity added to the GeoJSON `key`); geograph `data.query` warms before paint (C2/0017).
- [ ] C4-a: the ENTIRE `panels/map` node is retired — unregistered from `registry.ts`/`catalog.ts`/`authoring-metas.ts` and its files (`MapShell`/`MapNode`/`meta`/`mapColorUtils`/`topologyRegistry`/`index`) deleted; the 4 tests removed/redirected.
- [ ] **geograph is the SOLE choropleth engine; no rival node registered; build + all tests green.** `grep` confirms zero `panels/map` importers remain and the node is absent from registry/catalog/authoring-metas.
- [ ] **FF-ONE-MAP-ENGINE**: asserts the WHOLE `panels/map` namespace is gone (not just the util file); exactly one value→fill implementation (`styles/choropleth`).
- [ ] C4-b (verify-only): color map + feature lookup already key on the SAME geo dim code space (confirm, do NOT re-key); `geoCodeMap` covers every `isoField` value in the GeoJSON (11 `GE-*`→`R#`; occupied `GE-AB`/`GE-OS` correctly unshaded → `labelOverrides` tooltip, no fill).
- [ ] **FF-GEO-JOIN-NONEMPTY**: given rows + geoCodeMap covering the GeoJSON ISO set, `colorByGeo` matches ≥1 feature; a total-miss = failure (`GEO_JOIN_EMPTY` diagnostic).
- [ ] C4-d: fill COLOR = value (ramp); fill OPACITY + stroke WEIGHT = selection (orthogonal). `img_5`'s dark regions are selection highlight, not the ramp.
- [ ] `npx tsc --noEmit` EXIT=0.

**Standing DoD (applies)** — rendered result must match `scriness/` achieved ONLY through highest-concept architecture: no hardcoding, no anti-patterns, no DRY violations; declarative/config-driven; conditional logics covered; SSOT; refine/elevate EXISTING code (Strangler) — never rewrite-from-scratch or hardcode-to-match the screenshot. "Look like the screens" must NEVER be met by dropping quality.

**Notes** — Retiring `panels/map` is a one-way door (AR-12/RX-16 already decided) and an ≥8-site Class-M change: UNREGISTER first, then delete the node, then clean the 4 tests — a bare `mapColorUtils` delete leaves a half-consolidated node registered (worse SSOT than today). C4-b is NOT the fix (the join is already correctly keyed on `r.id`); the flat map is the C4-c re-style + warm-coverage. Otherwise two-way.
