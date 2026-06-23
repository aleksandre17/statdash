# 02 — Updated `DataStore` interface

## Decision: dual method — keep `querySync()`, add `queryAsync()` as the primary async path (Approach A)

```ts
export interface DataStore {
  /**
   * Synchronous fast-lane. Returns rows immediately from in-memory state.
   * MUST be implemented by every sync-capable store (caps.sync !== false).
   * Used by: SSR (renderPageToHTML/JSON), warm-then-read, and useNodeRows'
   * synchronous first paint when the store is sync-capable.
   * Renamed from today's `query()` — pure rename, same signature, same return.
   */
  querySync(q: StoreQuery, ctx: SectionContext): EngineRow[]

  /**
   * Async primary path. Returns a QueryResult envelope.
   * Sync stores: a micro-task wrap of querySync (state:'done' immediately).
   * Network stores: performs the fetch and resolves to 'done' | 'error'.
   * Optional: a sync-only store may omit it — the engine wraps querySync via
   * asyncFromSync(). An async-ONLY store implements this + sets caps.sync = false.
   */
  queryAsync?(q: StoreQuery, ctx: SectionContext): Promise<QueryResult>

  /** Batch fast-lane (unchanged shape, renamed for symmetry). */
  batchQuerySync?(queries: StoreQuery[], ctx: SectionContext): EngineRow[][]
  /** Async batch — Grafana targets[] in one round-trip. */
  batchQueryAsync?(queries: StoreQuery[], ctx: SectionContext): Promise<QueryResult[]>

  /** Optional live subscription — see 07-streaming.md. Present ⟺ caps.streaming === true. */
  subscribe?(q: StoreQuery, ctx: SectionContext, onResult: (r: QueryResult) => void): Unsubscribe

  readonly caps?:        StoreCaps
  readonly classifiers?: Record<string, Classifier>
  readonly display?:     Record<string, DisplayMap>
  readonly metadata?:    MetadataPort
}

export type Unsubscribe = () => void
```

`StoreCaps` gains a `sync` flag (the SSR fast-lane contract — `06-ssr-fastlane.md`):

```ts
export interface StoreCaps {
  queryTypes: ReadonlyArray<StoreQuery['type']>
  batching:   boolean
  streaming:  boolean
  /** True ⟺ querySync() returns complete rows without I/O. Gate for SSR/snapshot fast-lane.
   *  Absent → treated as `true` (Phase-1 convention: every existing store is sync). */
  sync?:      boolean
}
```

## Why Approach A and not the alternatives

| Alternative | Why rejected |
|---|---|
| **B — union return: `query(): EngineRow[] \| Promise<QueryResult>`** | Every call site must `if (result instanceof Promise)` branch — an `instanceof` smell sprayed across ~10 consumers (resolvers, kpi.ts, runBatch, SSR walkers, useNodeRows). It conflates two contracts in one name: `query()` returning `EngineRow[]` *sometimes* is exactly the surprise we forbid (Least Astonishment). Rejected. |
| **C — all stores return `Promise<QueryResult>`, sync stores micro-task-wrap** | Cleanest *interface* but **kills the synchronous SSR fast-lane**. `renderPageToHTML` uses `renderToStaticMarkup` (html.tsx:196) — fully synchronous, cannot `await`. `renderPageToJSON` is a "pure TypeScript data function, no React" (api.ts:14) called synchronously today. Forcing async there rewrites the SSR target signatures to `Promise<string>` and threads async through the entire node-walk — far larger blast radius — and taxes the only stores that exist (in-memory) with a micro-task per cell read. Rejected: don't bend the fast path to the slow path. |
| **A — dual method (chosen)** | `querySync` is a **pure rename** of `query()` → zero behavior change for every existing sync consumer. `queryAsync` is **additive** → no consumer breaks (Open/Closed). SSR keeps its synchronous fast-lane verbatim. Network-only stores opt out of `querySync` via `caps.sync = false`. The two methods name two genuinely different contracts (Grafana ships exactly this split). **One trade-off paid:** two methods to keep coherent — mitigated by `asyncFromSync()` so a sync-store author writes only `querySync`. |

**Trade-off (ISO 25010):** gained *Reliability* (per-node fault tolerance, loading states) + *Performance efficiency* (SSR zero-overhead sync path) at the cost of *Maintainability* surface (one extra interface method). Cost is bounded because `asyncFromSync` derives the async path from the sync one.
