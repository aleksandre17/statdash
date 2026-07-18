---
id: "0092"
title: "TRANSIENT-FAILURE GRAMMAR + the ONE query scheduler — 429 must degrade honestly, never kill a page (sweep #1, breaks-trust)"
status: BUILT-GREEN (2026-07-18 — scheduler + backoff + SWR + transient-retrying grammar + boot fail-soft shipped; full suite 0 failed; ADR-048; live-verify pending) · was QUEUED-HOT (proactive sweep top-1 — our own rate-limit killed the portal to an English dead-end and crashed studio shells)
class: M-L
priority: P0
owner: lead → architect (scheduler seam, packages/core, arrow-clean) → build
implements: sweep dossier `docs/architecture/audit/PROACTIVE-SWEEP-2026-07-18.md` finding 1 — ONE store-layer query scheduler (dedupe identical ObsQueries · concurrency cap · backoff honoring Retry-After · stale-while-revalidate) + `transient-retrying` as a DECLARED bilingual honest state (Law 11). The per-element fetch fan-out is the architectural smell (one-derivation economy violated at the store layer).
---

## Build record (2026-07-18) — ADR-048

**Decision.** `docs/architecture/decisions/ADR-048-transient-failure-grammar-and-fetch-scheduler.md`. The fetch scheduler lives at the `ApiStore` network seam (`packages/core`, arrow-clean), a CLIENT-GLOBAL singleton — ABOVE the existing `_cache`/`_promiseCache` dedupe, BELOW the cache write. Two alternatives rejected: react-hook-level limiter (wrong layer, per-component), global fetch monkeypatch (untestable, not arrow-clean).

**Shipped (minimal, expand-contract).**
- `packages/core/src/data/fetch-scheduler.ts` (NEW) — `FetchScheduler` (concurrency cap, default 6; `Retry-After`-honoring exp-backoff+jitter on 429/503; slot released during backoff; DI fetch/now/sleep; network reject fails FAST unless `retryNetworkErrors`) + `defaultFetchScheduler` singleton + `scheduleFetch` + `parseRetryAfterMs`/`isTransientStatus`/`TRANSIENT_STATUSES`.
- `store-api.ts` — `ApiStore.queryAsync` fetch routed through the scheduler; SWR last-good on exhausted transient / network throw (`lastGoodOr` serves a held `_cache` slice, even TTL-expired, as `meta.stale`; only with no held slice → `meta.transient` error).
- `cell.ts` — `ValueState` gains `'transient-retrying'` + `retryingCell()`; `store.ts` `ResultMeta` gains `stale`/`transient`.
- `KpiStripShell.tsx` + kpi-strip `meta.ts` — bilingual retrying tile copy (ka/en).
- `site-manifest.ts` — `fetchBootstrap` routes through `scheduleFetch` (D4: a transient boot 429 backs off/recovers instead of the English `emptyManifest()` dead-end).

**Gate (packages/core → FULL ritual).** `tsc -b` geostat + panel = 0; ESLint (touched) = 0; FULL vitest from platform root = **0 failed** (4054 tests); parity block (warm-covers / warm-read-key / bind-parity / FF-CANVAS-NEVER-LIES) green — the scheduler wraps only the network fetch, so the warm≡read contract is untouched.

**FFs.** `FF-SCHEDULER-CONCURRENCY-CAP` · `FF-SCHEDULER-BACKOFF-RECOVERS` · `FF-SCHEDULER-EXHAUSTION` (`fetch-scheduler.fitness.test.ts`) + extended `FF-CELL-HONEST-STATE`.

**Remaining:** live-verify on dev (:3013 studio shells + :3012 portal fail-soft) per the DoD — deploy recipe in memory `live-deploy-mechanism` / `remote-dev-cli`.
