// ── Observability plugin — request-id + RED metrics + /metrics (API-10) ───────
//
//  Wires the three operational concerns the api was missing into ONE seam:
//
//   1. REQUEST-ID CORRELATION. Fastify is configured (index.ts) with
//      requestIdHeader:'x-request-id' + a genReqId that mints a UUID when the
//      header is absent. That makes req.id either the caller-propagated id or a
//      fresh one, and Fastify's per-request child logger (req.log) binds it as
//      reqId on EVERY log line for the request — so a single request's worker
//      drain + publish + error lines all correlate by one id (the whole point).
//      This plugin echoes that id back on the response header so a caller (and an
//      upstream proxy / the browser) can quote it in a bug report, and the error
//      handler stamps it into the RFC 9457 body (lib/error-handler.ts).
//
//   2. RED METRICS. An onRequest/onResponse pair records request rate, errors
//      (by status class), in-flight gauge, and a latency histogram — the RED
//      method (Rate/Errors/Duration), the second observability pillar. Labels are
//      bounded (method + status class), never the raw path (cardinality guard).
//
//   3. /metrics. A public, unguarded Prometheus exposition endpoint (the scrape
//      target). Read-only, no secrets — the standard ops contract.
//
//  The MetricsPort is injected (Dependency Inversion): this plugin depends on the
//  port, not the concrete registry, so a test can pass a fresh registry or the
//  NULL port. Dogfooded immediately — the rate-limiter and ingest bulkhead emit
//  into the SAME registry, so /metrics is a live, non-dead port.

import type { FastifyInstance } from 'fastify'
import { randomUUID } from 'node:crypto'
import type { MetricsRegistry } from './metrics.js'
import { METRIC } from './metrics.js'

/** Fastify constructor options that turn x-request-id into req.id (propagate-or-mint). */
export const REQUEST_ID_OPTIONS = {
  requestIdHeader: 'x-request-id' as const,
  // Minted only when the inbound header is absent; an inbound id is honoured so a
  // trace spans the proxy → api hop (distributed correlation).
  genReqId: (): string => randomUUID(),
}

/** Map an HTTP status to a low-cardinality class label (2xx/4xx/5xx/…). */
function statusClass(status: number): string {
  return `${Math.floor(status / 100)}xx`
}

export interface ObservabilityOptions {
  readonly metrics: MetricsRegistry
}

/**
 * Register the request-id echo + RED metrics hooks + the /metrics route. Call at
 * the app layer BEFORE routes so the hooks cascade to every encapsulated child
 * context (same ordering rationale as the global error handler).
 */
export function registerObservability(app: FastifyInstance, opts: ObservabilityOptions): void {
  const { metrics } = opts

  // Echo the correlation id on the response as early as possible so it is present
  // even on a thrown-error response (the error handler runs after onRequest).
  app.addHook('onRequest', async (req, reply) => {
    reply.header('x-request-id', req.id)
    metrics.addGauge(METRIC.httpInFlight, 1)
  })

  app.addHook('onResponse', async (req, reply) => {
    metrics.addGauge(METRIC.httpInFlight, -1)
    const labels = { method: req.method, status: statusClass(reply.statusCode) }
    metrics.incCounter(METRIC.httpRequests, labels)
    // reply.elapsedTime is milliseconds since the request started; the histogram
    // is in seconds (Prometheus convention).
    metrics.observe(METRIC.httpDuration, reply.elapsedTime / 1000, { method: req.method })
  })

  // GET /metrics — Prometheus exposition. Unguarded scrape target (no secrets);
  // text/plain is the OpenMetrics content type prom scrapers expect.
  app.get('/metrics', async (_req, reply) => {
    return reply
      .header('content-type', 'text/plain; version=0.0.4; charset=utf-8')
      .send(metrics.render())
  })
}
