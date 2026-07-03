---
name: composition-table-stateA-only-select
description: Regional composition table drives region-select ONLY in State A; State B pivots → DataTable routes to PivotTable which is never passed onRowSelect → multi-select from the composition table dies after the first pick
metadata:
  type: project
---

Owner report "selecting MULTIPLE regions does NOT break GDP down by sectors" — diagnosed live 2026-07-03 on prod :3002 (bundle index-CC6hZ4J4.js) via Playwright network + DOM instrumentation.

**What actually WORKS live now (not the bug):**
- Map-click single AND multiple regions → composition `#sectors` renders the sector breakdown correctly (x=sector labels, series=selected regions, stacked apex-bar). Verified R3,R4 → 2 series (Adjara+Guria) over 7-9 sector x-labels.
- The wire array fix (`toWireValue`, commits 85a7bf7/7e53c5a in store-filter.ts) IS deployed: map multi-select sends `filter={"geo":["R3","R4"],...}` (array, not literal "R3,R4"). API returns 20 rows (10 sector-rows × 2 regions). The old comma-literal shape → 0 rows (superseded — see [[multiregion-comma-geo-wire]] now RESOLVED).
- The cache-collision fix (ba95362, node-unique cacheKey) IS deployed: table-initiated State B renders sectors (not empty). The map-fix agent's "table path State-B EMPTY" was PRE-cache-fix and is now stale.
- State-A composition-table row-click WORKS: real click on a `tr[role=button]` region row → writes region param → State B renders the sector bar. (An earlier "no-op" probe was an artifact — it hit a non-interactive sibling table, not the `tr[role=button]` data-table.)

**The real residual defect (root, file:line):** `platform/packages/plugins/panels/table/default/components/DataTable.tsx` L69-92. `DataTable` picks the renderer by `isMultiSeries = rows.some(r => r.series !== undefined)`. In State A the composition rows have NO series (`_seriesDim=""`) → `SimpleTable`, which RECEIVES `onRowSelect`/`selectedIds` → rows are `role=button`, selectable. In State B/C/D the rows carry `series=geoLabel` → `isMultiSeries=true` → `PivotTable`, and DataTable **never forwards `onRowSelect`/`selectedIds` to the PivotTable branch** (only SimpleTable gets them, L80-92). `PivotTable.tsx` has no row-select support at all. So once ANY region is selected, the composition table goes inert (selectableRows:0, no role=button) → you cannot add a 2nd/3rd region, nor deselect, from that panel. Multi-region from the composition table is impossible; only the MAP (always selectable) and the separate `regions-bar` table (never pivots → stays SimpleTable) support multi-select.

**Compounding orientation mismatch:** even if PivotTable were wired, in State B its ROWS are SECTORS and the REGIONS are the series/column headers (`_xDim=sectorLabel`, `_seriesDim=geoLabel`). The declared handler `on: row:click → filter region fromField:id` (geostat.provisioning.json ~L3728) targets `region` from the row — semantically wrong once rows are sectors. This is exactly AR-36/AR-38 §4.1 "click target dim must rotate with `_xDim`". So the correct fix is BOTH: (1) forward `onRowSelect`/`selectedIds` to PivotTable in DataTable.tsx, AND (2) rotate the click's target dim with the pivot orientation (pivot row=sector → the interactive target should be the series/column = region, or the handler key rotates via a `{$ctx:_selKey}` ref per AR-38 §4.1 P3). Minimal owner-satisfying fix if they only drive from the map: none needed (map works); the defect is the composition-table affordance.

**Classification:** (b) a real interaction defect — NOT AR-38 (the region arm is built and works via map), NOT a wire/cache regression (both fixed & deployed & verified live). Distinct from the directional SECTOR arm (AR-38, still unbuilt). See [[promisecache-node-collision]], [[multiregion-comma-geo-wire]].
