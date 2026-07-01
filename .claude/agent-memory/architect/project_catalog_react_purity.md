---
name: project-catalog-react-purity
description: plugins/catalog.ts is not module-graph-pure — blocks apps/panel from importing the Constructor palette catalog
metadata:
  type: project
---

`platform/engine/plugins/catalog.ts` claims to be the "no React required" META-only face of `@geostat/plugins`, but every per-slice re-export resolves through a folder barrel that also re-exports the Shell. Shells transitively pull `react-apexcharts` (chart), `react-leaflet` (georgraph), a CSS side-effect (`nodes/layout/index.ts` does `import './layout.css'`), and `i18next`.

**Why:** apps/panel has none of those installed, so it cannot import the catalog. Today it works around this: `apps/panel/src/platform-capabilities.ts` defers the `nodes` catalog, and `apps/panel/src/features/wizard/steps/PageStep.tsx` hardcodes a static `PALETTE_NODES` list instead of reading platform META.

**How to apply:** The fix trigger is extracting each slice's META into a Shell-free `*.meta.ts` file (~30 files) — out of scope for a typing pass. The stable typed contract (`PaletteEntry`, `PluginCatalog`, `PLUGIN_CATALOG`) now lives in catalog.ts; its shape will not change when the extraction lands, only the import becomes safe. When Constructor Phase 2 work starts in apps/panel, this extraction is the unblocking prerequisite. Tracked in `memory/project_debt.md` as "Plugin catalog isolation".
