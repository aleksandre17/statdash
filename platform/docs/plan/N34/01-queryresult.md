# 01 — The `QueryResult` contract

New type, lives in `engine/core/src/data/store.ts`, exported from `engine/core/src/data/index.ts`.

```ts
// ── QueryResult — async query envelope (Grafana PanelData / TanStack Query state) ──
//
//  The unit of async data flow. Every async store call returns one of these.
//  `state` is the discriminant; `data` is always present (empty on loading/error)
//  so consumers never crash on `result.data.map(...)`. (Postel's Law / Null Object.)
//
export interface QueryResult<T = EngineRow> {
  /** Lifecycle discriminant. Drives skeleton (loading) / error-boundary (error) / shell (done). */
  state: 'loading' | 'done' | 'error'
  /** Rows. ALWAYS an array — `[]` while loading or on error (Null Object — no `?.`). */
  data: T[]
  /** Present only when state === 'error'. Engine never throws across the store boundary. */
  error?: string | Error
  /** Optional diagnostics — never required for correctness. */
  meta?: ResultMeta
}

// ── ResultMeta — non-load-bearing diagnostics (Grafana PanelData.request/timings) ──
export interface ResultMeta {
  /** Wall-clock ms from query start to resolution. */
  durationMs?: number
  /** Identifier of the store that produced the rows (e.g. 'ExternalStore', 'ApiStore@/api'). */
  source?: string
  /** True when served from cache (CachedStore hit / ApiStore warm hit). */
  cacheHit?: boolean
  /** Total rows available upstream (may exceed data.length when a limit was applied). */
  totalRows?: number
  /** ISO 8601 — when the underlying data was last refreshed at source (provenance / 'last updated' badge). */
  fetchedAt?: string
  /** True when upstream marked these rows preliminary (IMF/Eurostat preliminary badge — root law §9). */
  preliminary?: boolean
}
```

## Design notes

- **`state:'error'` carries the error in-band rather than throwing.** The store boundary is a **fail-soft seam** — one node's data failure must not abort sibling resolution. This is the *existing* contract in SSR: `targets/api.ts:82` and `targets/html.tsx` already swallow per-node errors. `useNodeRows` re-throws into the React `NodeErrorBoundary` only on the React hard-fail path (`04-rendercontext.md`); the SSR/JSON path reads `result.error` and degrades. **One envelope, two consumption styles.**
- **`data` is never `undefined`.** Shells keep their `ctx.rows ?? []` idiom working unchanged (Null Object — ChartShell.tsx:32, TableShell.tsx:18).
- **`meta` is optional everywhere.** `preliminary`/`fetchedAt` connect directly to the root-law §9 data-integrity badges — the async envelope is the right home for provenance freshness signals.
- **Generic `T = EngineRow`** because the core store layer is renderer-agnostic (encoding.ts:32). The React layer parameterizes as `QueryResult<DataRow>` after `applyEncoding`.
