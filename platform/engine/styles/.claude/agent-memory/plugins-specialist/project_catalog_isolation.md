---
name: plugin-catalog-isolation
description: meta.ts extraction pattern — each plugin's META lives in a Shell-free pure-TS file so apps/panel can import the catalog without pulling React/apexcharts/leaflet
metadata:
  type: project
---

Plugin catalog isolation is complete as of 2026-06-14.

**Pattern:** Each `{plugin}/default/meta.ts` holds only the META constant — imports `type NodeSliceMeta/PanelSliceMeta/PageSliceMeta` from `@geostat/react/engine` and value imports from the co-located `*Node.ts` (Zod schemas, defaults, slots, groups). Zero React/TSX imports.

The `default/index.ts` for each plugin now re-exports `META` from `'./meta'` instead of declaring it inline.

`catalog.ts` imports directly from `*/default/meta` paths (not barrels) for the PALETTE_META array. A `pages/meta.ts` barrel collects the four page META files.

`apps/panel/src/platform-capabilities.ts` now imports `PLUGIN_CATALOG` from `@geostat/plugins/catalog` and exposes it as `PLATFORM_CAPABILITIES.nodes`.

**Why:** `catalog.ts` previously resolved META through barrel exports that also exported Shell components, pulling `react-apexcharts`, `react-leaflet`, and `i18next` into `apps/panel` where they aren't installed. The DEFERRED comment in platform-capabilities.ts described this exactly.

**How to apply:** Any future plugin (node/panel/page) must follow the same split: `meta.ts` (pure TS) + `index.ts` (re-exports META from meta.ts + all Shell/type exports). Never inline META in index.ts.
