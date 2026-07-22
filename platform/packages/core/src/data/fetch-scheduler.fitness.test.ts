// ── FF-SCHEDULER — the admission + backoff queue (ADR-048) ────────────────────
//
//  Proves the three invariants that close the sweep's #1 breaks-trust finding:
//    FF-SCHEDULER-CONCURRENCY-CAP  — N concurrent reads never exceed maxConcurrent
//                                    in flight; all resolve.
//    FF-SCHEDULER-BACKOFF-RECOVERS — a 429 + Retry-After then a 200 resolves to the
//                                    200 (waited the honored delay, retried, won).
//    FF-SCHEDULER-EXHAUSTION       — a persistent 429 past maxRetries returns the
//                                    final 429 (caller degrades), never a storm.
//  Fully DI (fetchImpl/now/sleep) — no network, no real timers.

import { describe, it, expect } from 'vitest'
import { FetchScheduler, parseRetryAfterMs, isTransientStatus, TRANSIENT_STATUSES, coalesceKeyFor } from './fetch-scheduler'

// ── FF-SCHEDULER-CONCURRENCY-CAP ──────────────────────────────────────────────
describe('FF-SCHEDULER-CONCURRENCY-CAP', () => {
  it('never exceeds maxConcurrent fetches in flight; all resolve', async () => {
    let active = 0
    let peak = 0
    const gates: Array<() => void> = []

    const scheduler = new FetchScheduler({
      maxConcurrent: 2,
      fetchImpl: () => {
        active += 1
        peak = Math.max(peak, active)
        return new Promise<Response>((resolve) => {
          gates.push(() => { active -= 1; resolve(new Response('ok', { status: 200 })) })
        })
      },
    })

    const all = Promise.all(
      Array.from({ length: 6 }, (_, i) => scheduler.schedule(`/x?${i}`)),
    )

    // Let the first wave acquire slots, then drain the gates until every queued
    // request has run. At no point may more than 2 be in flight.
    const flush = async () => { for (let i = 0; i < 6; i++) await Promise.resolve() }
    await flush()   // let the first wave clear `await acquire()` and enter fetchImpl
    let drained = 0
    while (gates.length > 0) {
      expect(scheduler.inFlight).toBeLessThanOrEqual(2)
      const g = gates.shift()!
      g()
      drained += 1
      await flush()   // let release() hand the slot to the next waiter, which re-enters fetchImpl
    }
    expect(drained).toBe(6)

    const results = await all
    expect(results).toHaveLength(6)
    expect(results.every((r) => r.status === 200)).toBe(true)
    expect(peak).toBeLessThanOrEqual(2)
    expect(scheduler.inFlight).toBe(0)
  })
})

// ── FF-SCHEDULER-BACKOFF-RECOVERS ─────────────────────────────────────────────
describe('FF-SCHEDULER-BACKOFF-RECOVERS', () => {
  it('honors Retry-After, retries, and resolves to the eventual 200', async () => {
    const slept: number[] = []
    let call = 0
    const scheduler = new FetchScheduler({
      sleep: async (ms) => { slept.push(ms) },   // record, never actually wait
      fetchImpl: () => {
        call += 1
        // First two calls are rate-limited with an explicit Retry-After of 2s.
        if (call <= 2) {
          return Promise.resolve(new Response('slow down', { status: 429, headers: { 'Retry-After': '2' } }))
        }
        return Promise.resolve(new Response('ok', { status: 200 }))
      },
    })

    const res = await scheduler.schedule('/obs')
    expect(res.status).toBe(200)          // recovered — NOT empty, NOT thrown
    expect(call).toBe(3)                  // two 429s, then the winning 200
    expect(slept).toEqual([2000, 2000])   // honored Retry-After (2s), never clamped down
    expect(scheduler.inFlight).toBe(0)    // slot released across every backoff
  })

  it('falls back to exponential backoff when no Retry-After header', async () => {
    const slept: number[] = []
    let call = 0
    const scheduler = new FetchScheduler({
      baseDelayMs: 100,
      sleep: async (ms) => { slept.push(ms) },
      fetchImpl: () => {
        call += 1
        return call === 1
          ? Promise.resolve(new Response(null, { status: 503 }))   // transient, no header
          : Promise.resolve(new Response('ok', { status: 200 }))
      },
    })
    const res = await scheduler.schedule('/obs')
    expect(res.status).toBe(200)
    expect(slept).toHaveLength(1)
    // full-jitter exponential: base*2^0 * (0.5..1.0) = 50..100ms
    expect(slept[0]).toBeGreaterThanOrEqual(50)
    expect(slept[0]).toBeLessThanOrEqual(100)
  })
})

// ── FF-SCHEDULER-EXHAUSTION ───────────────────────────────────────────────────
describe('FF-SCHEDULER-EXHAUSTION', () => {
  it('returns the final 429 after maxRetries — bounded, never an unbounded storm', async () => {
    let call = 0
    const scheduler = new FetchScheduler({
      maxRetries: 3,
      sleep: async () => {},
      fetchImpl: () => {
        call += 1
        return Promise.resolve(new Response('nope', { status: 429, headers: { 'Retry-After': '1' } }))
      },
    })
    const res = await scheduler.schedule('/obs')
    expect(res.status).toBe(429)     // exhausted — caller decides SWR/error
    expect(call).toBe(4)             // 1 initial + 3 retries, then STOP (no storm)
    expect(scheduler.inFlight).toBe(0)
  })

  it('fails FAST on a hard network reject by default (server genuinely down — no retry)', async () => {
    let call = 0
    const scheduler = new FetchScheduler({
      maxRetries: 4,
      sleep: async () => {},
      fetchImpl: () => { call += 1; return Promise.reject(new Error('ECONNREFUSED')) },
    })
    await expect(scheduler.schedule('/obs')).rejects.toThrow('ECONNREFUSED')
    expect(call).toBe(1)             // NOT retried — fail fast (the boot fail-soft must not hang)
    expect(scheduler.inFlight).toBe(0)
  })

  it('retries a network reject only when retryNetworkErrors is opted in', async () => {
    let call = 0
    const scheduler = new FetchScheduler({
      maxRetries: 2,
      retryNetworkErrors: true,
      sleep: async () => {},
      fetchImpl: () => { call += 1; return Promise.reject(new Error('ECONNRESET')) },
    })
    await expect(scheduler.schedule('/obs')).rejects.toThrow('ECONNRESET')
    expect(call).toBe(3)             // 1 + 2 retries
    expect(scheduler.inFlight).toBe(0)
  })
})

// ── FF-SCHEDULER-COALESCE (card 0111) ─────────────────────────────────────────
//
//  While ONE idempotent fetch for a key is in flight, identical concurrent callers
//  share that single wire call and all settle equal; distinct keys still parallel;
//  a coalesced error propagates to every caller once; a post-settle re-request
//  fetches fresh (the gate is single-flight, never a cache).
describe('FF-SCHEDULER-COALESCE', () => {
  it('folds N concurrent identical GETs into exactly ONE fetch; all resolve equal', async () => {
    let calls = 0
    const scheduler = new FetchScheduler({
      fetchImpl: () => {
        calls += 1
        return Promise.resolve(new Response(JSON.stringify({ n: calls }), { status: 200 }))
      },
    })

    const N = 8
    const results = await Promise.all(
      Array.from({ length: N }, () => scheduler.schedule('/api/stats/classifiers/measure')),
    )

    expect(calls).toBe(1)                                   // 8 identical reads → ONE wire call
    expect(results).toHaveLength(N)
    expect(results.every((r) => r.status === 200)).toBe(true)
    // Every caller reads an INDEPENDENT body (clone-per-caller) — a shared consumed
    // body would throw "Body already used" on the 2nd read.
    const bodies = await Promise.all(results.map((r) => r.json() as Promise<{ n: number }>))
    expect(bodies.every((b) => b.n === 1)).toBe(true)       // all saw the same single fetch
    expect(scheduler.coalescing).toBe(0)                    // gate cleared on settle
  })

  it('keeps DISTINCT keys parallel — no accidental over-folding', async () => {
    let calls = 0
    const scheduler = new FetchScheduler({
      fetchImpl: (url) => { calls += 1; return Promise.resolve(new Response(url, { status: 200 })) },
    })
    await Promise.all([
      scheduler.schedule('/a'),
      scheduler.schedule('/b'),
      scheduler.schedule('/a'),   // coalesces with the first /a
      scheduler.schedule('/c'),
    ])
    expect(calls).toBe(3)         // /a folded (2→1), /b, /c distinct
  })

  it('does NOT coalesce across differing conditional headers (If-None-Match)', async () => {
    let calls = 0
    const scheduler = new FetchScheduler({
      fetchImpl: () => { calls += 1; return Promise.resolve(new Response('ok', { status: 200 })) },
    })
    await Promise.all([
      scheduler.schedule('/obs', { headers: { 'If-None-Match': 'v1' } }),
      scheduler.schedule('/obs'),                                     // unconditional miss
      scheduler.schedule('/obs', { headers: { 'If-None-Match': 'v1' } }), // folds with #1
    ])
    expect(calls).toBe(2)   // {If-None-Match:v1} folded; the unconditional miss is its own read
  })

  it('propagates a coalesced non-transient error to EVERY caller once (no amplification)', async () => {
    let calls = 0
    const scheduler = new FetchScheduler({
      fetchImpl: () => { calls += 1; return Promise.resolve(new Response('boom', { status: 500 })) },
    })
    const results = await Promise.all(
      Array.from({ length: 5 }, () => scheduler.schedule('/obs')),
    )
    expect(calls).toBe(1)                                   // one wire call for all five
    expect(results.every((r) => r.status === 500)).toBe(true)
    const bodies = await Promise.all(results.map((r) => r.text()))
    expect(bodies.every((b) => b === 'boom')).toBe(true)   // each caller got its own readable clone
  })

  it('propagates a coalesced THROWN reject to every caller once', async () => {
    let calls = 0
    const scheduler = new FetchScheduler({
      sleep: async () => {},
      fetchImpl: () => { calls += 1; return Promise.reject(new Error('ECONNREFUSED')) },
    })
    const settled = await Promise.allSettled(
      Array.from({ length: 4 }, () => scheduler.schedule('/obs')),
    )
    expect(calls).toBe(1)   // fail-fast, folded — one attempt for all four
    expect(settled.every((s) => s.status === 'rejected')).toBe(true)
    expect(scheduler.coalescing).toBe(0)
  })

  it('re-fetches fresh AFTER the shared read settles (single-flight, not a cache)', async () => {
    let calls = 0
    const scheduler = new FetchScheduler({
      fetchImpl: () => { calls += 1; return Promise.resolve(new Response(String(calls), { status: 200 })) },
    })
    const a = await scheduler.schedule('/obs')
    const b = await scheduler.schedule('/obs')   // gate already cleared → fresh fetch
    expect(calls).toBe(2)
    expect(await a.text()).toBe('1')
    expect(await b.text()).toBe('2')
  })

  it('a coalesced follower NEVER consumes a second concurrency slot', async () => {
    let active = 0
    let peak = 0
    const gates: Array<() => void> = []
    const scheduler = new FetchScheduler({
      maxConcurrent: 1,
      fetchImpl: () => {
        active += 1; peak = Math.max(peak, active)
        return new Promise<Response>((resolve) => {
          gates.push(() => { active -= 1; resolve(new Response('ok', { status: 200 })) })
        })
      },
    })
    const all = Promise.all(Array.from({ length: 5 }, () => scheduler.schedule('/same')))
    const flush = async () => { for (let i = 0; i < 5; i++) await Promise.resolve() }
    await flush()
    expect(scheduler.inFlight).toBe(1)   // five identical callers, ONE in-flight fetch
    gates.shift()!()
    await all
    expect(peak).toBe(1)
  })

  it('coalesceKeyFor: undefined for non-idempotent (POST / body); stable for GET', () => {
    expect(coalesceKeyFor('/x', { method: 'POST' })).toBeUndefined()
    expect(coalesceKeyFor('/x', { body: 'y' })).toBeUndefined()   // body-bearing → never fold
    expect(coalesceKeyFor('/x')).toBe(coalesceKeyFor('/x', { method: 'GET' }))
    // header order-invariant identity
    expect(coalesceKeyFor('/x', { headers: { a: '1', b: '2' } }))
      .toBe(coalesceKeyFor('/x', { headers: { b: '2', a: '1' } }))
    // differing conditional header → different key
    expect(coalesceKeyFor('/x', { headers: { 'If-None-Match': 'v1' } }))
      .not.toBe(coalesceKeyFor('/x', { headers: { 'If-None-Match': 'v2' } }))
  })
})

// ── Retry-After parsing + transient classification ────────────────────────────
describe('parseRetryAfterMs + isTransientStatus', () => {
  const now = () => 1_000_000
  it('parses delta-seconds', () => {
    expect(parseRetryAfterMs('5', now)).toBe(5000)
  })
  it('parses an HTTP-date relative to now', () => {
    const future = new Date(now() + 3000).toUTCString()
    const ms = parseRetryAfterMs(future, now)!
    // toUTCString drops sub-second precision → 2000..3000ms
    expect(ms).toBeGreaterThanOrEqual(2000)
    expect(ms).toBeLessThanOrEqual(3000)
  })
  it('returns undefined for absent/garbage', () => {
    expect(parseRetryAfterMs(null, now)).toBeUndefined()
    expect(parseRetryAfterMs('', now)).toBeUndefined()
    expect(parseRetryAfterMs('soon', now)).toBeUndefined()
  })
  it('classifies only 429/503 as transient', () => {
    expect(TRANSIENT_STATUSES.slice().sort()).toEqual([429, 503])
    expect(isTransientStatus(429)).toBe(true)
    expect(isTransientStatus(503)).toBe(true)
    expect(isTransientStatus(500)).toBe(false)
    expect(isTransientStatus(404)).toBe(false)
  })
})
