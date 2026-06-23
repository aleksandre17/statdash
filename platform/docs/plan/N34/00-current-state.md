# 00 — Current state: what already exists (do NOT design over it)

The task brief implies a green field. It is not. Four pieces of async infrastructure already exist and the design **builds on them rather than replacing them**.

1. **The render pipeline already wraps every shell in `<Suspense>` + `NodeErrorBoundary`.**
   `engine/react/src/engine/renderNode.ts:288-301` — every node is rendered as:
   ```
   <Suspense fallback={skeletonFn(node, ctx)}>
     <NodeErrorBoundary node fallback={errorFallback}>
       {shell(node, ctx, children)}
     </NodeErrorBoundary>
   </Suspense>
   ```
   The header comment (renderNode.ts:15) literally says *"7. Suspense — skeleton fallback (Phase 2: async data via `use()`)"*. The loading and error **display** surfaces already exist and are wired. What is missing is an async **source** that suspends/throws into them.

2. **`skeletonRegistry` is live** (`engine/react/src/engine/skeletonRegistry.ts`) with a 3-level cascade (brand variant → type default → engine fallback), already consulted by renderNode.ts:289. Shells contribute a `Skeleton` export via `registerSlice`. No shell needs loading code today; it just has no trigger.

3. **`useNodeRows()` already exists as the per-node resolution boundary** (`engine/react/src/engine/useNodeRows.ts`, shipped as N28). It memoizes `resolveNodeRows(node, ctx)` keyed on `specDimKey(node.data, ctx.sectionCtx)`. This is the correct seam to make async — it is already a hook, already called at shell top-level inside `ShellWrapper` (defineShell.tsx:38), already the documented "drop-in alternative to `ctx.rows`".

4. **`ApiStore.prefetch()` is already async** (`engine/core/src/data/store-impl.ts:78-95`) — `await fetch(...)` populates an in-memory cache, after which `query()` reads synchronously. This is the existing **"async warm → sync read"** precedent. The new contract generalizes it: `queryAsync` is the warm+read in one call; `querySync` is the post-warm cache read.

## Design consequence

N34 is *not* "add async rendering". It is "feed the async source that the pipeline is already waiting for, **without breaking the synchronous SSR fast-lane** that depends on current behavior." The Suspense / skeleton / error-boundary scaffolding is reused as-is.
