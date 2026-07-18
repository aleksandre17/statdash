// ── FetchScheduler — the ONE client-side admission + backoff queue (ADR-048) ──────
//
//  The gap the sweep's #1 finding exposed is NOT dedupe (ApiStore._cache and
//  useNodeRows._promiseCache already dedupe — do NOT add a cache here). It is
//  ADMISSION CONTROL between the per-element render fan-out and the network:
//    (1) no concurrency cap → a data-heavy page fires every distinct fetch at once
//        and trips our own per-IP rate-limit (429 + Retry-After);
//    (2) no backoff → a 429 was mapped straight to {state:'error'} → a crashed
//        shell / the English "dashboard is not configured" dead-end.
//
//  This scheduler sits at the ApiStore network seam (queryAsync's fetch call), ABOVE
//  the _cache dedupe and strictly BELOW the cache write — it wraps ONLY the network
//  fetch, so cacheKeyFor / querySync / the warm-key contract are untouched. It is NOT
//  a cache: it is a concurrency-limited queue with Retry-After-honoring exponential
//  backoff on transient statuses.
//
//  A module-level default singleton (defaultFetchScheduler) is shared by every
//  ApiStore instance AND the boot fetch, so the concurrency cap is CLIENT-GLOBAL
//  (a page's many stores throttle together). Fully DI (fetchImpl/now/sleep) so the
//  fitness tests need no network and no real timers.
//
//  Arrow-clean (Law 3): packages/core, zero react/app import. Benchmarked against
//  Grafana's per-datasource query scheduler and Google SRE retry-with-jitter.

/** HTTP statuses treated as TRANSIENT — retried with backoff. */
export const TRANSIENT_STATUSES: ReadonlyArray<number> = [429, 503]

export function isTransientStatus(status: number): boolean {
  return TRANSIENT_STATUSES.includes(status)
}

/** The subset of `fetch` the scheduler needs — DI-friendly, DOM-lib-light. */
export type FetchImpl = (input: string, init?: RequestInit) => Promise<Response>

export interface RetryInfo {
  /** 1-based attempt about to be waited out (the retry number). */
  attempt: number
  /** The transient status that triggered the wait, or undefined for a thrown fetch. */
  status?: number
  /** The delay (ms) before the retry. */
  delayMs: number
  /** The request URL (diagnostics only). */
  url: string
}

export interface FetchSchedulerOptions {
  /** Max in-flight fetches (default 6). The rest queue. */
  maxConcurrent?: number
  /** Retries on a transient failure before giving up (default 4). */
  maxRetries?: number
  /** Exponential-backoff base in ms when no Retry-After header (default 400). */
  baseDelayMs?: number
  /** Ceiling for a single exponential-backoff wait (default 8000). */
  maxDelayMs?: number
  /** Ceiling for an honored Retry-After wait (default 60000 = one rate-limit window). */
  maxRetryAfterMs?: number
  /**
   * Retry a THROWN fetch (network reject) too (default false). Off by default: the
   * scheduler's job is the explicit transient SIGNAL (429/503 — "slow down / try
   * again"). A hard reject (ECONNREFUSED) means the server is genuinely down, so we
   * fail FAST — the boot fail-soft must not hang retrying an unreachable API, and an
   * element error surfaces immediately (byte-identical to pre-scheduler behavior).
   */
  retryNetworkErrors?: boolean
  /** Injected fetch (default globalThis.fetch, bound). */
  fetchImpl?: FetchImpl
  /** Injected clock (default Date.now) — jitter/tests. */
  now?: () => number
  /** Injected sleep (default setTimeout) — tests drive backoff without real time. */
  sleep?: (ms: number) => Promise<void>
  /** Observation hook — fires before each backoff wait (telemetry / honest-state). */
  onRetry?: (info: RetryInfo) => void
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Parse an HTTP `Retry-After` value (delta-seconds OR an HTTP-date) into ms.
 * Returns undefined when absent/unparseable — the caller falls back to exponential
 * backoff. `now` is injected so an HTTP-date is testable.
 */
export function parseRetryAfterMs(
  header: string | null | undefined,
  now: () => number,
): number | undefined {
  if (header == null) return undefined
  const trimmed = header.trim()
  if (trimmed === '') return undefined
  // delta-seconds form (the form our server emits).
  if (/^\d+$/.test(trimmed)) return Number(trimmed) * 1000
  // HTTP-date form.
  const when = Date.parse(trimmed)
  if (Number.isNaN(when)) return undefined
  return Math.max(0, when - now())
}

export class FetchScheduler {
  private readonly maxConcurrent:   number
  private readonly maxRetries:      number
  private readonly baseDelayMs:     number
  private readonly maxDelayMs:      number
  private readonly maxRetryAfterMs: number
  private readonly retryNetworkErrors: boolean
  private readonly fetchImpl:       FetchImpl
  private readonly now:             () => number
  private readonly sleep:           (ms: number) => Promise<void>
  private readonly onRetry?:        (info: RetryInfo) => void

  private active = 0
  private readonly waiters: Array<() => void> = []

  constructor(opts: FetchSchedulerOptions = {}) {
    this.maxConcurrent   = opts.maxConcurrent   ?? 6
    this.maxRetries      = opts.maxRetries      ?? 4
    this.baseDelayMs     = opts.baseDelayMs     ?? 400
    this.maxDelayMs      = opts.maxDelayMs      ?? 8_000
    this.maxRetryAfterMs = opts.maxRetryAfterMs ?? 60_000
    this.retryNetworkErrors = opts.retryNetworkErrors ?? false
    // Bind so a bare globalThis.fetch keeps its `this` (undici/Node + browser).
    this.fetchImpl = opts.fetchImpl ?? ((input, init) => fetch(input, init))
    this.now       = opts.now   ?? Date.now
    this.sleep     = opts.sleep ?? defaultSleep
    this.onRetry   = opts.onRetry
  }

  /** In-flight fetch count — diagnostics / fitness assertions. */
  get inFlight(): number { return this.active }

  // ── Concurrency slot (a fair FIFO admission gate) ────────────────────────────
  private acquire(): Promise<void> {
    if (this.active < this.maxConcurrent) {
      this.active += 1
      return Promise.resolve()
    }
    return new Promise<void>((resolve) => this.waiters.push(resolve))
  }

  private release(): void {
    const next = this.waiters.shift()
    if (next) {
      // Slot handed directly to the next waiter — active stays balanced.
      next()
    } else {
      this.active -= 1
    }
  }

  /**
   * The drop-in `fetch` the ApiStore (and the boot fetch) call. Enforces the
   * concurrency cap, then on a transient status honors Retry-After / exponential
   * backoff up to maxRetries. The slot is RELEASED during the backoff sleep so a
   * long Retry-After never starves the pool. On exhaustion the final (still-429)
   * Response is returned — the caller decides last-good-SWR vs error. A thrown fetch
   * (a hard network reject) fails FAST by default (the server is down — the boot
   * fail-soft must not hang); set `retryNetworkErrors` to retry it too.
   */
  async schedule(input: string, init?: RequestInit): Promise<Response> {
    let attempt = 0
    for (;;) {
      await this.acquire()
      let res: Response
      try {
        res = await this.fetchImpl(input, init)
      } catch (err) {
        this.release()
        // Fail FAST on a hard network reject unless explicitly opted in — a genuinely
        // down server must not be retried (the boot fail-soft, an element error).
        if (!this.retryNetworkErrors || attempt >= this.maxRetries) throw err
        attempt += 1
        await this.backoff(attempt, undefined, input)
        continue
      }

      if (isTransientStatus(res.status) && attempt < this.maxRetries) {
        const retryAfter = parseRetryAfterMs(res.headers.get('Retry-After'), this.now)
        // Discard the transient body so the connection can be reused, then free the
        // slot for the backoff window.
        try { await res.body?.cancel?.() } catch { /* body may be absent/locked */ }
        this.release()
        attempt += 1
        await this.backoff(attempt, res.status, input, retryAfter)
        continue
      }

      // Success, a non-transient status, or retries exhausted — return + free slot.
      this.release()
      return res
    }
  }

  private async backoff(
    attempt:    number,
    status:     number | undefined,
    url:        string,
    retryAfter?: number,
  ): Promise<void> {
    const delayMs = this.delayFor(attempt, retryAfter)
    this.onRetry?.({ attempt, status, delayMs, url })
    await this.sleep(delayMs)
  }

  private delayFor(attempt: number, retryAfter?: number): number {
    if (retryAfter !== undefined) {
      // Honor the server's window; never wait longer than one full window.
      return Math.min(retryAfter, this.maxRetryAfterMs)
    }
    // Exponential backoff with full jitter (Google SRE), clamped to maxDelayMs.
    const exp = Math.min(this.maxDelayMs, this.baseDelayMs * 2 ** (attempt - 1))
    return Math.floor(exp * (0.5 + this.randomHalf()))
  }

  /** Deterministic-testable jitter source (0..0.5). */
  private randomHalf(): number {
    return Math.random() * 0.5
  }
}

// ── defaultFetchScheduler — the CLIENT-GLOBAL singleton ──────────────────────────
//
//  Every ApiStore instance AND the boot fetch route through this ONE scheduler so
//  the concurrency cap bounds the WHOLE page's fan-out (a per-store cap would not
//  bound the storm). Constructed with defaults; swap via the ApiStore ctor for tests.
export const defaultFetchScheduler = new FetchScheduler()

/** Ergonomic wrapper for non-store callers (the boot fetch) — routes through the
 *  shared scheduler so a transient boot 429 backs off instead of dead-ending. */
export function scheduleFetch(input: string, init?: RequestInit): Promise<Response> {
  return defaultFetchScheduler.schedule(input, init)
}
