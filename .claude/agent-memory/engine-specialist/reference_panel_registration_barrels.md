---
name: reference-panel-registration-barrels
description: A new panel under packages/plugins/panels/* must be wired into THREE barrels or it silently drops (never registers, get(type) undefined)
metadata:
  type: reference
---

A panel dir `packages/plugins/panels/<name>/` (with `default/meta.ts` + `default/index.ts` exporting `Shell` + `META`) is NOT live until it is added to THREE registration faces. Miss one and the failure is SILENT — no error, the node just renders nothing.

1. **`panels/index.ts`** — `export * as <name> from './<name>'`. THIS is the runtime gap that bites: `apps/geostat/src/setupRegistrations.ts` does `...Object.values(Panels)` (where `Panels = import * as @plugins/panels`) and feeds each into `registerSlice()`. A panel absent here never calls `registerSlice` → `nodeRegistry.get('<name>')` is `undefined`.
2. **`registry.ts`** — `export * as <name> from './panels/<name>'` (full runtime registry, renderer + react hooks face).
3. **`catalog.ts`** — `export { META as <name> } from './panels/<name>'` PLUS a `import { META as <name>Meta } from './panels/<name>/default/meta'` PLUS add `<name>Meta` to the `PALETTE_META` array (the Constructor palette face; META-only, no Shell in graph).

`registerSlice` (`packages/react/src/engine/registerSlice.ts`) routes sliceType 'node'|'page'|'panel' → `nodeRegistry.register(type, variant, Shell, opts)`. Panel META shape: `{ sliceType:'panel', type, variant:'default', label, icon, category, schema, groups, canHaveChildren:false, caps, version }`.

**Real incident (2026-06-23, 2nd-tenant capstone):** `text` + `gauge` existed on disk, were absent from all three barrels → never registered → `apps/geostat/src/data/site-manifest.ts` `emptyManifest()`/`offlinePage()` (which builds the offline "site unavailable" page from a `type:'text'` node) rendered EMPTY. Fix = add to all 3 barrels.

**Guard (added same incident):** `packages/plugins/nodes/__tests__/panel-registration.fitness.test.ts` — structural fitness reading barrel SOURCE as text + disk layout; asserts every `panels/*` dir with `default/meta.ts` is exported from all three barrels. Plus `panel-resolution.test.ts` proves `nodeRegistry.get('text'|'gauge')` resolves. Both are `@vitest-environment node` and import META from pure `meta.ts` (NOT the barrel — barrel pulls Shell/apexcharts/leaflet/i18next, unresolvable in node env). See sibling C0 fitness `schema-completeness.fitness.test.ts` which already imports every panel meta and requires panels to carry a non-empty schema.
