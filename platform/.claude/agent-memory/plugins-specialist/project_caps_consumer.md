---
name: project-caps-consumer
description: CAPS/getByCapability wired into Constructor palette via paletteEntries.ts — dead-seam eliminated in N29
metadata:
  type: project
---

`getGroupedPaletteEntries()` in `apps/panel/src/canvas/paletteEntries.ts` is the live consumer of `nodeRegistry.getByCapability(CAPS.*)`. Partition logic:

- `CAPS.FILTERABLE` → "Data panels" group (chart, table, kpi-strip, gauge, map, georgraph, repeat)
- `CAPS.COLLAPSIBLE` (non-filterable) → "Layout" group (section)
- Neither → "Content" group (hero, links, page-header, row, wrap, …)

`NodePalette.tsx` renders `getGroupedPaletteEntries()` as `<section>` groups with `<h3>` headings; falls back to a flat `<ul>` when no groups exist (empty registry in isolated tests).

`getPaletteEntries()` (flat, rootOnly-filtered) remains for backward compat; now also surfaces `caps: NodeCap[]` per entry.

**Why:** CAPS + getByCapability were published but had no Constructor consumer — dead-seam. Adding a cap to a `meta.ts` now automatically re-classifies that type in the palette with zero palette code change.

**How to apply:** When adding new CAPS vocabulary or new grouping strategies, extend `getGroupedPaletteEntries()` partition logic only — no NodePalette.tsx changes needed.
