# 07 — Polling / streaming (C2)

`StoreCaps.streaming` already exists (store.ts:48). The async contract makes `subscribe` a natural optional extension — **not a new parallel system**, just a push variant of `queryAsync`.

```ts
// On DataStore (optional, present ⟺ caps.streaming === true):
subscribe?(
  q: StoreQuery,
  ctx: SectionContext,
  onResult: (r: QueryResult) => void,
): Unsubscribe
```

## Contract
- `subscribe` emits an initial `{state:'loading'}` then `{state:'done', data}` (parity with `queryAsync`'s settle), then re-emits `{state:'done'}` on each tick/push. Errors emit `{state:'error'}` **without ending the subscription** (a transient poll failure must not tear down a live panel — Graceful Degradation; Postel).
- **Polling is the default `subscribe` implementation** — a `pollingSubscribe(store, intervalMs)` helper (new, store.ts) wraps `queryAsync` on a timer; `clearInterval` is the `Unsubscribe`. A request/response store gets polling for free; a true streaming store (SSE/WebSocket) implements `subscribe` natively.
- **React boundary:** a `useNodeSubscription(node, ctx)` hook (N34d) mirrors `useNodeRows` but wires `subscribe` → `useState` → `Unsubscribe` in `useEffect` cleanup. Refresh interval comes from config (`node.data.refresh?: number` or `view.refresh`), keeping it **declarative** (root law §2 — config carries intent, renderer carries logic). Shells stay async-unaware: they still read `rows`; the hook re-renders on each push.
- **Backpressure / Bulkhead:** the hook drops in-flight results superseded by a newer `specDimKey` (last-write-wins), and one slow subscription cannot block sibling nodes (each owns its own hook state).
