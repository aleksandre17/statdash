---
name: caps-pass
description: NodeRegistry caps data pass — CAPS vocabulary, NodeCap extension, plugin META wiring, integration test location
metadata:
  type: project
---

Completed the `caps` data pass for NodeRegistry [N29]. All slices now declare capability tokens.

**Why:** Constructor palette and future routing need `getByCapability(cap)` to work; no slice had `caps` populated until this session.

**How to apply:** When adding a new plugin or new capability token, follow the pattern established here.

## What changed

**`engine/react/src/engine/slice-meta.ts`** (SSOT):
- Extended `NodeCap` union with 7 new tokens: `'collapsible' | 'filterable' | 'view-toggle' | 'methodology' | 'drill' | 'repeat'` (plus retained `'export' | 'data' | 'children' | 'chart' | 'kpi'`).
- Added `CAPS` constant (`as const satisfies Record<string, NodeCap>`) with all 11 tokens.
- Added `Cap` type alias (`typeof CAPS[keyof typeof CAPS]`).

**`engine/react/src/engine/NodeRegistry.ts`**: Re-exports `CAPS` and `Cap` alongside existing `NodeCap`.

**`engine/react/src/engine/engine/index.ts`**: Adds `CAPS` (value) and `Cap` (type) to public barrel.

## Caps assigned per slice type

| node type | caps |
|---|---|
| chart | export, collapsible, filterable, view-toggle |
| table | export, collapsible, filterable |
| map (panel) | collapsible, filterable, view-toggle |
| kpi-strip | filterable |
| gauge | filterable |
| section | collapsible, methodology |
| georgraph | collapsible, filterable, view-toggle |
| repeat | repeat, filterable |
| page-header, filter-bar, mode-bar | [] |
| row, grid, columns, stack, card, wrap, divider, spacer | [] |
| inner-page, tab-page, container-page (all variants) | [] |
| hero, links, stats-carousel, text | [] |

Note: `gauge` previously had `['data', 'export']` — corrected to `['filterable']` to use the new vocabulary. `'data'` and `'export'` as declared by gauge were using old ad-hoc tokens.

## Test location

Integration test: `engine/plugins/nodes/__tests__/NodeRegistry.caps.test.ts`
- Lives in `engine/plugins` (correct layer — can import plugin META files).
- Imports `NodeRegistry` / `CAPS` directly from `@geostat/react/engine/NodeRegistry` (not the barrel) to avoid `i18next` transitive dep resolution failure.
- 19 tests, all green.

Unit test (mechanics, pre-existing): `engine/react/src/engine/NodeRegistry.caps.test.ts` — unchanged, still passes.

## Key lesson

Integration tests that use plugin META **must** live in `engine/plugins/`, not `engine/react/`. The dependency arrow (`engine/react ← engine/plugins`) forbids the inverse. Also: import `NodeRegistry` directly from its file, not from the barrel (`engine/index.ts`), to avoid the `i18next` peer dep being dragged in through `registerSlice.ts`.
