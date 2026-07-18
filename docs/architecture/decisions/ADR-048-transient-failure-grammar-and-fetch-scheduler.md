# ADR-048 — The transient-failure grammar + the ONE fetch scheduler

> **Status:** ACCEPTED (design + first build) — closes the sweep's #1 breaks-trust finding (`docs/architecture/audit/PROACTIVE-SWEEP-2026-07-18.md` finding 1; card `work/items/0092`). Our own per-IP rate-limit (429) killed the portal `/ka/regional` to a whole-page **English** "dashboard is not configured" dead-end and crashed studio element shells.
> **Decision authority:** architect (scheduler seam + honest-state grammar entry, `packages/core`, arrow-clean) → build.
> **Extends (never forks):** the `_cache` per-slice dedupe in `ApiStore` · the `_promiseCache` per-warm dedupe in `packages/react` `useNodeRows` · the `useDebouncedLivePage` (350 ms) edit-burst bound · the Cell honest-state seam (`ValueState`, `cell.ts`). No new cache layer (SSOT: memory `live-preview-request-volume`).
> **Laws:** 1 (generic — no dim/route literal), 3 (dependency arrow — scheduler is `packages/core`, no react/app import), 5 (`ApiStore` is the adapter boundary), 6 (root-cause: the per-element fetch fan-out with no admission control), 7 (Strangler expand-contract — additive, `fetch` seam swapped, cache untouched), 11 (the canvas never lies — a transient failure is a *declared* state, never a fabricated empty / fake 0 / English dead-end).

---

## Context — a 429 kills the whole product (the Law-11 breach, proven live)

Proven live (sweep finding 1; re-tripped during the 0099 probe, 35× 429). A data-heavy page renders many elements; each element's `useNodeRows` async warm fires DISTINCT `queryAsync` fetches. There is **no admission control** between the render fan-out and the network, so:

1. **No concurrency cap** — a page fires all its distinct fetches at once. Over one fixed-window minute the count can exceed `RATE_LIMIT_GLOBAL_PER_MIN` (300) → the server's own per-IP limiter emits **429 + `Retry-After`** (RFC 9457 `too-many-requests`, `rate-limit.ts`).
2. **No backoff** — `ApiStore.queryAsync` maps a `!res.ok` (429) straight to `{state:'error'}`. `Retry-After` is ignored. The read never recovers.
3. **No declared transient state** — that error degrades three ways, all dishonest:
   - the element warm throws → `NodeErrorBoundary` → **crashed shell** (`[renderNode] shell crashed … HTTP 429`);
   - the **boot** fetch (`fetchBootstrap` → `/api/bootstrap`) 429s → `resolveManifest()` falls to `emptyManifest()` → the whole page is the **English** "dashboard is not configured" dead-end, even on `/ka`;
   - a KPI degrades to a fake-empty / English "Retry".

A transient, self-inflicted rate-limit is not a configuration failure and is not "no data". Rendering it as either is a lie (Law 11).

### Ground truth (SSOT — do NOT re-derive; memory `live-preview-request-volume`)

Dedupe **already exists** and must not be duplicated: `ApiStore._cache` (keyed `JSON(params)`) dedupes identical observation requests; `useNodeRows._promiseCache` (cap 200) dedupes the suspending promise per spec fingerprint; `useDebouncedLivePage` bounds edit bursts. `CachedStore` is **bypassed** for async stores (`resolveStore`: `caps.sync===false` returns raw). **The gap is NOT dedupe — it is admission control (concurrency + backoff) and a declared transient state.**

---

## Decision

### D1 — One fetch scheduler at the `ApiStore` network seam (`packages/core`)

A single `FetchScheduler` (`packages/core/src/data/fetch-scheduler.ts`) wraps the `fetch` call inside `ApiStore.queryAsync`. It is a **module-level default singleton** (`defaultFetchScheduler`) shared by every `ApiStore` instance AND the boot fetch, so the concurrency cap is **client-global** (a page's many stores throttle together — a per-store cap would not bound the storm). It provides:

- **Concurrency cap** — at most `maxConcurrent` (default 6) fetches in flight; the rest queue. The slot is **released during backoff** (a sleeping retry never holds a slot → no deadlock).
- **`Retry-After`-honoring exponential backoff** on `429`/`503` (`TRANSIENT_STATUSES`): honor the header when present (clamped to `maxRetryAfterMs`, default 60 s = one window), else exponential `base·2ⁿ` + jitter (clamped to `maxDelayMs`), up to `maxRetries` (default 4). On exhaustion the final `Response` (still `429`) is returned — the caller decides SWR vs error. A **hard network reject** (ECONNREFUSED — the server is genuinely down) fails **FAST** by default (`retryNetworkErrors` off): the retry signal is the *explicit* transient status, and the boot fail-soft must never hang retrying an unreachable API.
- **Dependency-injected** `fetchImpl` / `now` / `sleep` — fully testable without a network or timers.

It composes **ABOVE** the existing `_cache` dedupe and strictly **BELOW** the cache write: it wraps only the network `fetch`; `cacheKeyFor` / `querySync` / the warm-key contract are untouched. It is **not** a cache (no new layer) — an admission + retry queue.

### D2 — Stale-while-revalidate / last-good on exhaustion

When the scheduler returns an exhausted `!res.ok` (or the fetch throws), `queryAsync` serves any **held `_cache` slice** (even TTL-expired) as `{state:'done', meta.stale:true}` — last-good, never a crash when we hold prior data. Only with **no** held slice does it return `{state:'error', meta.transient:true}`.

### D3 — `transient-retrying` joins the honest-state grammar (Law 11)

`ValueState` (`cell.ts`) gains `'transient-retrying'` with a `retryingCell()` constructor — the DECLARED state a read carries while the scheduler is backing off. It flows automatically into `KpiHonestState` (`= Exclude<ValueState,'ok'|'unbound'>`) so the strip renders a bilingual "retrying" tile, never a fabricated 0. For the async render path the primary honest affordance is *structural*: because the scheduler retries **inside** the pending `queryAsync` promise, Suspense keeps its `aria-busy` loading skeleton and **auto-recovers** on success — the crashed shell / dead-end is never reached for a transient 429.

### D4 — The boot fetch honors backoff (kill the English dead-end)

`fetchBootstrap` routes through `scheduleFetch` (the same core primitive; `apps/geostat` may import `packages/core` — with the arrow). A transient boot 429 now backs off and recovers to the real manifest instead of falling to the `emptyManifest()` English dead-end. The dead-end remains only for a genuinely-unconfigured/persistently-down platform (its designed purpose).

---

## Alternatives weighed + rejected

1. **A react-hook-level limiter** (throttle inside `useNodeRows`). *Rejected:* wrong layer — misses every non-hook read (`fetchBootstrap`, `fetchStoreManifest`, direct `queryAsync`), is per-component (no client-global cap), and pushes network policy into the view (arrow/ISP breach). The scheduler must sit at the store's network seam where ALL reads converge.
2. **A global `fetch` monkeypatch** (wrap `globalThis.fetch`). *Rejected:* untestable without global mutation, not arrow-clean (invisible cross-cutting side effect), throttles unrelated traffic (auth, telemetry, ingest), and cannot see `Retry-After` semantics per logical read. Refused on Parnas/Demeter grounds.
3. **Add a new in-flight request-coalescing cache.** *Rejected:* the SSOT memory forbids another cache layer; `_cache` + `_promiseCache` already dedupe. Coalescing at the `Response` level is unsafe (a body reads once) and would need cloning — cost without a proven gap. The concurrency cap + backoff solves the storm without it. (Documented follow-up if profiling shows in-flight identical-query pressure.)
4. **Raise `RATE_LIMIT_GLOBAL_PER_MIN`.** *Rejected:* the server budget is a deliberate DoS control; weakening it treats the symptom. Architecture leads (Law 7): the CLIENT must be well-behaved (cap + dedupe + backoff), not the fence lowered.

---

## Fitness functions

- **FF-SCHEDULER-CONCURRENCY-CAP** — N concurrent `schedule()` calls never exceed `maxConcurrent` in flight; all resolve.
- **FF-SCHEDULER-BACKOFF-RECOVERS** — a `429` with `Retry-After` followed by a `200` resolves to the `200` (backoff waited the honored delay, retried, succeeded) — not empty, not thrown.
- **FF-SCHEDULER-EXHAUSTION** — a persistent `429` past `maxRetries` returns the final `429` `Response` (caller degrades), never an unbounded retry storm.
- **FF-CELL-HONEST-STATE** (existing) — extended: `transient-retrying` is a declared `ValueState`; a read in backoff is never a fabricated `0`.

## Consequences

- **Gained:** reliability (ISO 25010) — a transient rate-limit auto-recovers; last-good SWR; an honest declared retrying state; the boot dead-end no longer fires on a transient. Arrow-clean, DI-testable.
- **Cost:** a page under a genuine persistent limit shows longer loading skeletons (bounded by the backoff budget) before an honest error — correct behavior, not a regression.
- **Reversible:** the `fetch` seam swap is additive; removing the scheduler restores byte-identical behavior. Cache/warm-key contract unchanged.
