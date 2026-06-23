# 05 — Shell rendering contract

**Invariant: a shell contains ZERO async-aware code.** Loading, error, and empty are handled *above* the shell by the render pipeline. This is already ~90% true; N34 preserves it.

## Loading
The pipeline's existing `<Suspense fallback={skeletonFn(node, ctx)}>` (renderNode.ts:289-301) catches the suspended async resource thrown by `useNodeRows` (when its async branch uses React `use()`). The `skeletonRegistry` (skeletonRegistry.ts) supplies the fallback. **No change to renderNode's wrapper — it already exists.** The only new wiring (N34c) is that `useNodeRows`'s async branch suspends, which the Suspense boundary already catches.

## Error — two tiers, both already present
- **Hard error** (resource throws) → existing `NodeErrorBoundary` (renderNode.ts:296) shows the per-slice `errorFallback`.
- **Soft error** (`{state:'error'}`) → shell renders its existing `<EmptyState />` path (ChartShell.tsx:74, TableShell.tsx:39) — already there.

## Data
Unchanged: shell reads `rows` (from `ctx.rows` or `useNodeRows().rows`) and renders.

## What a shell author writes
Nothing new for the common case. For surgical reactivity they swap:
```ts
const rows = ctx.rows ?? []                  // before
const { rows } = useNodeRows(def, ctx)        // after (opt-in)
```
The skeleton is contributed once via the slice's `Skeleton` export (already a `registerSlice` field).

**The pipeline owns the async-state UI; the shell owns the data-present UI.** (Separation of Concerns; mirrors Grafana panel vs PanelChrome.)
