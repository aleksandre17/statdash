# 09 — Risk assessment + ADR

## Hardest part — N34c, the React async resource
Holding async state correctly with React `use()` + a promise cache keyed on `specDimKey`, without (a) re-suspending every render, (b) leaking promises across filter changes, or (c) flickering for sync stores. **Mitigation:** the sync-capable fast path (`caps.sync !== false`) bypasses the async machinery entirely and resolves on the same render — so the entire Phase-1 store set (ExternalStore/CachedStore/staticStore) never touches the risky code. The promise cache is exercised only by genuinely async stores, which do not exist in production yet. Risk converts from "every render" to "only the new network store."

## Top risks
1. **SSR divergence.** If the rename accidentally routes SSR through `queryAsync`, snapshots break. *Mitigation:* fitness test spying the store asserts `renderPageToHTML`/`renderPageToJSON` call **only** `querySync`; golden-snapshot test on a representative page.
2. **`ctx.rows` vs `useNodeRows` double-resolution.** A shell on the async path must not also receive a synchronously-injected `ctx.rows` that disagrees. *Mitigation:* for `caps.sync === false` stores, `renderNode` injects `ctx.rows = []` (loading) and the shell uses `useNodeRows`; a lint/fitness rule flags a shell whose store can be async that does not call `useNodeRows`.
3. **Promise cache memory growth / staleness** under rapid filter changes. *Mitigation:* WeakMap/LRU keyed on `specDimKey`, mirroring the existing `_storeCache` WeakMap pattern (resolveNodeRows.ts:33) the team already trusts; superseded entries dropped (last-write-wins, `07-streaming.md`).
4. **Error-envelope vs throw confusion.** Two error styles (in-band `{state:'error'}` for SSR/soft, thrown for ErrorBoundary/hard). *Mitigation:* single rule — *stores never throw across the boundary (always return `{state:'error'}`)*; only the React `use()` adapter may re-throw for hard-fail nodes. Fitness test: no store method throws on a query error.
5. **Interface coherence of dual methods.** *Mitigation:* `asyncFromSync` derivation means sync-store authors implement only `querySync`; an ADR + a fitness rule ("a store declaring `caps.sync !== false` must implement `querySync`") keeps the two methods consistent.

## Rollback checkpoints
N34a revert = clean (additive + rename). N34b = clean (additive). N34c = per-shell + hook isolated; Phase-1 sync path provably untouched. N34d = fully isolated (opt-in, no current consumer).

## One-way vs two-way door
N34a's rename of the public `DataStore.query` is the most irreversible step (published `@statdash/engine` interface). Treat it as a **one-way door**: do it once, atomically, with the full grep sweep + fitness gate. Everything after is a two-way door (additive, opt-in, revertible).

---

## ADR summary (record under the project's decisions file)

- **Context:** Synchronous `interpretSpec`/`DataStore.query` + hardcoded `streaming:false` block loading/error/polling/streaming/network-live data (~8 gaps, N34).
- **Decision:** Dual-method `DataStore` (`querySync` retained as fast-lane + rename of `query`; additive `queryAsync` returning a `QueryResult` envelope). `interpretSpec` stays synchronous over `querySync`; **async is a React-layer concern owned by `useNodeRows`**, feeding the *already-present* Suspense/skeleton/ErrorBoundary scaffolding. SSR keeps a synchronous fast-lane gated by `caps.sync`; async-only stores warm-then-read.
- **Consequences:** +Reliability (per-node fault tolerance, loading states), +Performance (SSR zero-overhead sync path preserved), −Maintainability (one extra interface method, mitigated by `asyncFromSync`). Migration is expand-contract; Phase-1 all-sync behavior provably unchanged.
- **Rejected alternatives:** (B) union return `EngineRow[] | Promise<QueryResult>` — `instanceof` branching across all consumers, Least-Astonishment violation. (C) all-async single method — kills the synchronous SSR fast-lane (`renderToStaticMarkup` can't await; `renderPageToJSON` is a pure sync function), forces async through the entire node-walk, taxes the only stores that exist today.
