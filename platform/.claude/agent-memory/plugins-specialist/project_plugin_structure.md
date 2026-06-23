---
name: plugin-structure
description: Actual plugin directory structure and registration wiring for engine/plugins
metadata:
  type: project
---

Plugins live in `engine/plugins/`, NOT a top-level `plugins/` directory. The task brief used `plugins/` as shorthand.

**Why:** The platform monorepo puts all engine code under `engine/`; `@plugins` alias in vite resolves to `engine/plugins`.

**How to apply:** All new panel/node/control slices go under `engine/plugins/panels|nodes|controls`. Tests go under the same directory with a `vitest.config.ts` at `engine/plugins/vitest.config.ts`.

Registration chain:
1. `engine/plugins/panels/[name]/default/` — Shell, Node type, meta, CSS, utils
2. `engine/plugins/panels/[name]/default/index.ts` — exports `Shell`, type, `META`, utils
3. `engine/plugins/panels/[name]/index.ts` — `export * from './default'`
4. `engine/plugins/panels/index.ts` — add `export * as name from './name'`
5. `engine/plugins/registry.ts` — add `export * from './panels/name'`
6. `engine/plugins/catalog.ts` — add named export + direct meta.ts import + PALETTE_META entry

`apps/geostat/src/setupRegistrations.ts` uses `Object.values(Panels)` — no change needed there for new panels; the `panels/index.ts` barrel is sufficient.

See [[plugin-fieldconfig]] for the FieldConfig/Threshold shape.
