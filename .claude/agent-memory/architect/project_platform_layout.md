---
name: platform-layout
description: Real monorepo path layout for statdash-platform — engine/* + apps/*, and where key framework seams live
metadata:
  type: project
---

The published-package + app layout under `platform/` (pnpm workspace: `engine/*` = libs, `apps/*` = deployables).

**Packages (`engine/*`):** `core` (`@geostat/engine`), `react` (`@geostat/react` + subpath `@geostat/react/engine`), `charts`, `expr`, `plugins` (`@geostat/plugins`), `styles`.
**Apps (`apps/*`):** `api` (fastify), `geostat` (the dashboard app), `panel` (the Constructor — react-admin based).

**Import-path → folder map:** `@geostat/react/engine` → `engine/react/src/engine/`. `@geostat/plugins/catalog` → `engine/plugins/catalog.ts`.

**Key framework seams (where to look):**
- Node dispatch: `engine/react/src/engine/renderNode.ts` (12-step pipeline, zero if/switch on type) + `NodeRegistry.ts` + `NodeView.tsx` (registry-as-composition JSX).
- Node types: co-located at `engine/plugins/nodes/<type>/default/{<Type>Node.ts, <Type>Shell.tsx, meta.ts}`; data panels at `engine/plugins/panels/<type>/`. Each augments `NodeTypeMap` via `declare module '@geostat/react/engine'`.
- Constructor manifest: `engine/react/src/engine/constructor.ts` (`describeApp()`), `propSchemaToJsonSchema.ts`, `NodeRegistry.describeRegistry()`.
- Diagnostics/observability: emit via `emitDiagnostic(diagWarning(...))` from `@geostat/engine` (the established channel used by spec.ts/resolvers.ts); app wires `setDiagnosticObserver` in `apps/geostat/src/setupRegistrations.ts`. A richer `TelemetryPort` (`setTelemetryPort`) also exists.

**@plugins alias seam (from the apps/ monorepo migration):** when `src/` moved under `apps/geostat/`, plugins were imported by *relative path* (`../plugins`) in 8 files (`setupRegistrations.ts`, `app/LocaleGuard.tsx`, 6 `pages/*`) which silently break as `src/` nests deeper. A stable `@plugins/*` alias was introduced at the plugins boundary; packages were always alias-portable via `@geostat/*`. When touching imports in apps, prefer `@plugins/*` / `@geostat/*` over relative climbs. npm workspaces (not Turborepo/Nx) was the YAGNI choice for the two app entry points. Alias mechanics: [[geostat-alias-resolution]].

**RENAME KEY (ADR-012, proposed→shipping):** the shared layer moved `engine/*` → `platform/packages/*` and the scope `@geostat/*` → `@statdash/*`. Older memories written against `engine/core`/`@geostat/engine` map to `packages/core`/`@statdash/engine`; treat their path literals as illustrative, verify against the current tree. The CLAUDE.md dependency arrow is the current SSOT: `packages/contracts ← packages/expr ← packages/core ← packages/charts ← packages/react ← packages/plugins ← apps/*`.

**Why:** The architecture-audit task assumed paths like `engine/plugins` and `apps/panel/src` with chart/kpi as `nodes`; reality is `{nodes,panels}` under plugins and chart/table/kpi/gauge/map are **panels**, not nodes.
**How to apply:** Always ground path assumptions against the current tree before grepping; task-prompt and older-memory paths are illustrative, not literal.
