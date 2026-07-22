---
name: fetch-scheduler-coalesce
description: FetchScheduler in-flight coalescing (0111) sits ON TOP of ADR-048 queue; stats-api getAt now routes through scheduleFetch
metadata:
  type: reference
---

The ONE client network seam is `FetchScheduler` (`packages/core/src/data/fetch-scheduler.ts`). Two layers, both at this seam — do NOT add a third:

1. **ADR-048 (0092):** concurrency cap (6) + Retry-After/exp-backoff on 429/503, slot released during backoff. The single fetch is the private `run()`.
2. **Coalescing (card 0111, commit 7d220f84):** public `schedule()` wraps `run()`. While one idempotent GET/HEAD (no body) fetch for a key is in flight, identical concurrent callers share it; each caller gets an independent `cloneResponse()` clone (a body reads once — master never consumed). `coalesceKeyFor` = method+URL+normalized-sorted-headers, so `If-None-Match` revalidation never folds into an unconditional miss. Gate clears on settle → single-flight, NOT a cache (store `_cache` is SSOT). Error/reject settles all callers once. `cloneResponse` degrades to as-is for duck-typed test doubles + consumed-body clone-throws.

**Non-obvious wire fact:** classifier/dataset/cube/data-sources reads do NOT self-route to the scheduler by default — they go through `stats-api.ts` `getAt()` which (since 0111) was pointed at `scheduleFetch` (the ADR-048 D4 boot-fetch precedent). That routing — not the coalescing itself — is what collapses the ~18× `/classifiers/measure` fan-out. `ApiStore.queryAsync` (observations) + `fetchBootstrap` (boot) were already on the seam. `stats-api.ts fetchObservations` (a separate raw-fetch obs path) is NOT the live obs route (ApiStore is) and was left untouched.

**What coalescing does NOT solve (by design):** page-switch refetch of hidden pages' cubes — a re-fetch AFTER the prior settled is fresh by design. That is the visibility-scoped-warm follow-up, panel/react-side, attaching where `useNodeRows`/warm scheduler decides WHICH specs to warm. See [[reference_apistore_freshness_gate]] for the 304/TTL layer below this.
