---
name: panel-tsconfig-constraints
description: platform/apps/panel AND apps/geostat tsconfigs forbid TS parameter-properties and require import type; how it shapes new app code
metadata:
  type: project
---

Both Vite apps — `platform/apps/panel/tsconfig.json` and `platform/apps/geostat/tsconfig.app.json` — compile with `erasableSyntaxOnly: true` and `verbatimModuleSyntax: true`.

**Why:** Bundler-mode strictness — only erasable TS syntax is allowed (no runtime-emitting TS constructs), and import elision must be explicit.

**How to apply:**
- Do NOT use constructor parameter-properties (`constructor(public x: number)`) in panel `src/` — declare the field then assign in the body. This bit `ApiError` in `lib/api.ts`.
- Type-only imports must use `import type { ... }`.
- `import.meta.env` is typed because `"types": ["vite/client"]` is set — no need for a `vite-env.d.ts`.
- Type-checking either app also pulls in `engine/` + `plugins/` sources (geostat's `tsconfig.app.json` has `include: ["src", "../../engine"]`), which emit their own pre-existing errors: `erasableSyntaxOnly` constructs in engine, missing `@types` for react-router-dom/leaflet/apexcharts in plugins, and `META`/`Shell` re-export ambiguity in `plugins/registry.ts`. When validating app work, filter `tsc -b` output to `src/...` (exclude `../../engine/`) — those are not yours.
