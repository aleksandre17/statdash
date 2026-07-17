---
name: kpistrip-data-bindable-misdiagnosis
description: WORK-0083 "canvas ctx boot divergence" — falsified as a boot-path bug; real cause was kpi-strip's meta.ts falsely declaring `data-bindable`, which let a stray Inspector bind hijack effectiveStoreKey's store routing for the whole strip. Includes the probe-selector-breadth trap that manufactured the false boot-path correlation, and the panel dev-container packages/* sync gap.
metadata:
  type: project
---

## The falsified diagnosis
A fix card characterized "no-param `/studio/insert` boot persistently shows KPI no-data,
`?page=regional` boot stays healthy" as a ctx/filter-default init-order race relative to
page activation. Reproduced live (both probes ran against `192.168.1.199:3013`), then
DISPROVEN by isolation: landing on the no-param path with **zero clicks** already showed
correct KPI values (self-heals identically to the param path — no real ctx divergence).
The SAME click sequence as the "broken" probe, run against the "healthy" `?page=regional`
direct-entry path, reproduced the IDENTICAL corruption. The two reproducer probes
(`probe-0081-replica.mjs` vs `probe-bind-transient.mjs`) differed only in canvas-node
selector breadth: `[data-node-type="chart"], [data-node-type="kpi-strip"]` (picks
whichever is FIRST in DOM — the kpi-strip, since it renders above any chart) vs
`[data-node-type="chart"]` alone (a legitimately data-bindable node). **A union CSS
selector + `.first()` picking a DIFFERENT real element than intended can manufacture a
false boot-path correlation** — always isolate by removing one variable at a time
(no-click control, then swap only the selector) before trusting a "boundary".

## The real root cause
`packages/plugins/panels/kpi-strip/default/meta.ts` declared `caps: [..., 'data-bindable']`
— copy-pasted from chart/table/geograph's meta.ts, which genuinely own a top-level
`data: DataSpec` field. kpi-strip's own contract is `items: KpiSpec[]` (each item has its
OWN governed `value.measure`); its shell explicitly never reads `ctx.rows` (a separate
`interpretKpis` read surface). The `data-bindable` cap is read ONLY by
`apps/panel/src/inspector/facets/builtinFacets.ts`'s `appliesWhen` to opt a node into the
generic Data facet (`DataFacetField`/`MetricPalette`) — so it mounted for a kpi-strip
selection despite the node having no real use for it.

Binding a metric there wrote `node.data` — unread by the shell, but `effectiveStoreKey`
(`packages/react/src/engine/renderNode.ts` + `resolveNodeRows.ts`) generically walks ANY
node's `.data` via `specDataSource` to override `ctx.pageStoreKey` for that node (Law 1 —
no privileged type names, by design). A different-dataSource metric bound onto the stray
field silently rerouted the WHOLE strip's store — every sibling KPI item (still carrying
its own correct raw measure code) then queried the WRONG cube → 0 rows → the honest
"no observation for this coordinate" state on every card, indistinguishable on screen
from a real ctx-resolution failure.

**General heuristic**: a `caps`/capability declaration is a CONTRACT the generic
authoring layer trusts blindly (Law 1 — no per-type special-casing). If a node declares a
capability its shell doesn't actually back, any GENERIC mechanism that trusts that
capability (store routing, drag targets, validation) can be hijacked through the
now-wrongly-exposed authoring surface — grep for `appliesWhen`/cap-gated facets when a
"random field went to the wrong place" bug doesn't localize to the field's own code path.
See also [[async-store-live-render-patterns]] trap-class (declaration/consumption mismatch).

## Infra fact — packages/* is NOT live-synced to the panel dev container
`ops/scripts/dev-watch-panel.sh` / the documented rsync one-liner syncs ONLY
`platform/apps/panel/src` → `geostat-deploy:/tmp/statdash-dev-line/platform/apps/panel/src`,
which is the ONE bind-mount the `statdash-dev-panel-full` container has
(`docker inspect --format '{{range .Mounts}}...'`). `packages/*` (incl. `plugins`) is
BAKED into the container image at build time — rsyncing the host `/tmp/statdash-dev-line`
tree has ZERO effect on a running container for anything under `packages/`. To reflect a
`packages/*` source edit into that live dev container: `docker cp <file>
statdash-dev-panel-full:/app/<same-relative-path>` then `docker restart
statdash-dev-panel-full` (vite's fs watcher did not pick up the `docker cp` alone in
practice — restart was required to re-serve the module). Verify via
`docker exec statdash-dev-panel-full grep ... /app/<path>` before/after. This is a real
gap (`packages/*` has no live-sync path at all) worth flagging to the platform team if
`packages/*` edits become a frequent panel-dev-loop need.
