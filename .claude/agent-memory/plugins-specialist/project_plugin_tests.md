---
name: plugin-tests
description: Vitest setup for engine/plugins panel tests
metadata:
  type: project
---

`engine/plugins/vitest.config.ts` was created to test panels. Added to `vitest.workspace.ts` as an extends entry.

Test pattern for panels:
- Extract pure logic (renderer, calculator) into a `*Utils.ts` file, export it from `default/index.ts`
- Test utils in `*.test.ts` with `// @vitest-environment node` — fast, no DOM
- Shell render smoke tests would use `// @vitest-environment jsdom` + `@testing-library/react`

Store mocking for interpretSpec tests (N42 lesson):
- `interpretSpec(row-list, ctx, store)` calls `storeVal(store, code, ctx)` which calls `store.querySync({ type: 'val', code }, ctx)`
- Mock must implement `querySync` returning `[{ value: N }]` for type:'val' queries — NOT `val: () => N`
- `apps/panel/src/canvas/*.test.tsx` are pre-existing failures (package resolution: `@geostat/react/engine` not exported in panel's node_modules) — not caused by plugin changes

`PanelSliceMeta` field notes:
- `category: SliceCategory` — valid values: `'page' | 'data' | 'layout' | 'content' | 'filter'`
- `caps?: readonly NodeCap[]` — valid: `'data' | 'children' | 'chart' | 'table' | 'kpi' | 'export' | 'filter' | 'page'` (plus open strings)
- No `description` field on `PanelSliceMeta`
- Text panels use `category: 'content'`, no caps needed
- `canHaveChildren: false` is the literal false (panels are always leaves)
