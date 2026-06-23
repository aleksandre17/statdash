# 04 — `RenderContext.rows` evolution

## Decision: `useNodeRows()` is the async boundary. Shells never see raw async.

`RenderContext.rows?: DataRow[]` (types.ts:176) is **unchanged in shape** — it remains the synchronously-resolved cascade rows that renderNode injects (renderNode.ts:197, 209). It keeps SSR and parent→child inheritance working. We do **not** add `rowsAsync` or `rowsState` to `RenderContext`:

| Rejected option | Why |
|---|---|
| `rowsAsync?: Promise<DataRow[]>` on ctx | A Promise on the threaded, partly-serializable RenderContext (types.ts:161 splits ctx into serializable / runtime halves). A Promise is neither — it pollutes the serializable seam and every `{...ctx}` spread re-shares a stale promise. Rejected. |
| `rowsState?: AsyncState<DataRow[]>` on ctx | Forces renderNode (a non-hook function, renderNode.ts:159) to own async state. renderNode cannot call hooks. State must live in a component. Rejected. |
| **`useNodeRows()` is the boundary (chosen)** | Already a hook (useNodeRows.ts:41), already memoized on `specDimKey`, already called inside `ShellWrapper` (a real component — defineShell.tsx:38). The *only* place that can legally hold async React state. It already exists. |

## `useNodeRows` evolved signature

```ts
// engine/react/src/engine/useNodeRows.ts — N34c
export interface NodeRowsResult {
  state: 'loading' | 'done' | 'error'
  rows: DataRow[]          // always []-safe (Null Object)
  error?: Error
  meta?: ResultMeta
}

/** Async-aware node row resolution. Sync-capable stores resolve synchronously on
 *  first render (state:'done' immediately) → zero flicker, SSR-identical output.
 *  Network/async stores suspend (loading) then settle. */
export function useNodeRows(node: NodeBase, ctx: RenderContext): NodeRowsResult
```

Behavior:
1. Resolve store via `resolveStore(ctx)` (resolveNodeRows.ts:35).
2. `store.caps?.sync !== false` → call synchronous `resolveNodeRows`, return `{state:'done', rows}` **on the same render** (no flicker, SSR-parity). The overwhelmingly common Phase-1 case.
3. `store.caps?.sync === false` → drive `storeQueryAsync` through a small `useAsyncResource` (React `use()` + a per-`specDimKey` promise cache). Return `loading` → `done|error`.
4. The hook **re-throws on error into the existing `NodeErrorBoundary`** *only when a node opts into hard-fail*; default is soft `{state:'error'}` so the shell renders an inline error/empty (matches today's `EmptyState`).

## Backward-compat shim for `ctx.rows`-reading shells

ChartShell (ChartShell.tsx:32) and TableShell (TableShell.tsx:18) read `ctx.rows ?? []` today and keep working: for sync stores, `renderNode` still injects `ctx.rows` synchronously (unchanged). A shell migrates to `useNodeRows` **only when it needs loading/error granularity** — and even then receives a `NodeRowsResult`, never a Promise. Migration is opt-in per shell (Strangler-Fig), not a flag-day.
