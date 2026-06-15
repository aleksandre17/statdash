---
name: project_panel_setup
description: React Admin v5 scaffold installed in apps/panel; pre-existing engine TS errors block composite build
metadata:
  type: project
---

apps/panel is the Constructor admin interface (Phase 2). React Admin v5.14.7 + MUI v6 + Emotion v11 installed via pnpm catalog.

**Why:** Phase 2 Constructor will use React Admin CRUD UI to build/edit dashboard JSON configs. DataProvider is a placeholder returning empty data until the config API is built.

**How to apply:** When building panel, expect `tsc -b` to fail due to pre-existing engine errors (see below). Panel's own src/ is clean — filter errors by path to distinguish panel vs engine debt.

## Pre-existing engine TS errors (not panel debt)

These block `pnpm --filter ./apps/panel run build` via composite build references. They are NOT caused by panel changes:

- `engine/core/src/core/error.ts` lines 31-33: TS1294 `erasableSyntaxOnly` — enum syntax
- `engine/core/src/data/store.ts` lines 184, 270: TS1294 same
- `engine/core/src/registry/interpreters.ts` line 443: TS1294 same
- `engine/expr/src/derive.ts` line 17: TS2591 `process` not in scope (needs @types/node in tsconfig)
- `engine/plugins` (GeoMap, GeorgraphShell, HeroShell, PageHeader, ChartShell, ApexRenderer, toApexOptions): missing `react-leaflet`, `leaflet`, `react-router-dom`, `apexcharts`, `react-apexcharts` type declarations
- `engine/react/src/context/SiteContext.tsx` + `registerSlice.ts`: missing `i18next` type declarations

## DataProvider typing note

react-admin v5 DataProvider methods take TWO arguments: `(resource: string, params: XParams)`.
Single-arg arrow functions will mistype `params` as `string`. Always write `(_resource, params) =>`.
For methods with irresolvable generic return types (create, getOne, delete), `as never` cast on the return is the correct escape hatch.
