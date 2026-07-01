---
name: apistore-freshness-gate
description: ApiStore 304/ETag conditional-GET freshness gate — TTL-aware cache entries, three-way fresh/stale/miss dispatch
metadata:
  type: reference
---

ApiStore (`platform/packages/core/src/data/store-api.ts`) `queryAsync` has a TTL-aware freshness gate restoring the P1 ETag/304 capability (audit FINDING 1, 2026-06).

- `_cache` entries are `{ rows, expiresAt }` (was a bare `EngineRow[]`); 8th ctor arg `ttlMs` (default 5min).
- Three cases: FRESH (`now < expiresAt`) → serve, no network. STALE (held, TTL elapsed) → conditional GET `If-None-Match: <dataset ETag>`; 304 → reuse held rows + refresh TTL, 200 → replace. MISS (no entry) → UNCONDITIONAL GET (sending ETag on a miss = the 304-to-empty kpi-strip crash).
- The conditional header gate is `if (storedETag && cached)` — the 304 branch is `if (res.status===304 && cached)`, now genuinely reachable (the old `_cache.has` past an unconditional early-return was DEAD code that a test ratified).
- `querySync`/`queryFrame` read `cached.rows`. `querySync` returns held rows even when TTL-stale (revalidation is queryAsync's job).
- Dataset-level ETag is the correct validator for ANY slice (a version bump invalidates all slices → next revalidation of each 200s).
- Tests split by concern (400-line ceiling): basic params/cache/filter in `apiStore.async.test.ts`; ETag/304 freshness in `apiStore.revalidation.test.ts`. A 304 is ONLY ever mocked after a request that legitimately carried If-None-Match.
- Note: in prod ApiStore is wrapped by CachedStore (own 5min TTL `_obsCache`), so revalidation is gated by the wrapper's TTL first; both layers independently correct.
