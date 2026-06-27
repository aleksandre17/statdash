// ── MetricsPort + in-process registry — the api's observability seam (API-10) ─
//
//  The api had NO metrics pillar (logs only). This is the second pillar: a
//  TelemetryPort the app layer wires ONCE at boot and every producer (the request
//  hook, the rate-limiter, the ingest bulkhead, the worker) depends on — never on
//  a concrete client. Mirrors the engine's TelemetryPort discipline (packages/core
//  core/telemetry.ts), but api-local because the dependency arrow forbids apps/api
//  from importing packages/core.
//
//  WHY hand-rolled (no prom-client): the same zero-supply-chain stance as the
//  hand-rolled HS256 JWT (lib/auth.ts) and the HMAC embed signer. The exposition
//  format below is the Prometheus/OpenMetrics text format — a real, scrapeable
//  adapter, not a stub. A new metric = one register* call (OCP); the port surface
//  never changes.
//
//  DESIGN: counters + gauges (RED/USE) + histograms (latency). Labels are a flat
//  string map; a metric+label-set is one time series. Cardinality is the caller's
//  responsibility — labels must be bounded (method, status-class, bucket-name),
//  never unbounded (no raw paths, no ids) — the standard high-cardinality guard.

// ── Port (Dependency Inversion) ───────────────────────────────────────────────
// Producers depend ONLY on this narrow surface. A no-op implementation
// (NULL_METRICS) satisfies it, so a unit test or a script needs no registry.
export interface MetricsPort {
  /** Add `value` (default 1) to a monotonic counter time-series. */
  incCounter(name: string, labels?: Labels, value?: number): void
  /** Set an instantaneous gauge time-series to `value`. */
  setGauge(name: string, value: number, labels?: Labels): void
  /** Add `delta` (may be negative) to a gauge — for in-flight / queue-depth. */
  addGauge(name: string, delta: number, labels?: Labels): void
  /** Record one observation into a histogram (latency / size distribution). */
  observe(name: string, value: number, labels?: Labels): void
}

export type Labels = Readonly<Record<string, string>>

/** A registry is a MetricsPort that can also render the Prometheus exposition. */
export interface MetricsRegistry extends MetricsPort {
  /** Declare a metric before use (fail-fast: an unregistered name throws). */
  define(name: string, def: MetricDef): void
  /** Prometheus/OpenMetrics text exposition of every series held. */
  render(): string
  /** Test/inspection helper: the current value of a counter/gauge series. */
  peek(name: string, labels?: Labels): number | undefined
}

/** Inert port — the default when no registry is wired (scripts, unit tests). */
export const NULL_METRICS: MetricsPort = {
  incCounter() {},
  setGauge() {},
  addGauge() {},
  observe() {},
}

// ── Metric definitions ────────────────────────────────────────────────────────

type MetricType = 'counter' | 'gauge' | 'histogram'

interface MetricDef {
  readonly type: MetricType
  readonly help: string
  /** Histogram upper bounds (seconds or bytes). Ignored for counter/gauge. */
  readonly buckets?: readonly number[]
}

/** Default latency buckets (seconds) — sub-ms to 10s, the usual web spread. */
export const DEFAULT_LATENCY_BUCKETS = [
  0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10,
] as const

interface Series {
  // counter/gauge: single value. histogram: bucket counts + sum + count.
  value: number
  bucketCounts?: number[]
  sum?: number
  count?: number
}

// ── Registry factory ──────────────────────────────────────────────────────────
//
//  Metrics must be REGISTERED before use (fail-fast: an unregistered name throws,
//  so a typo can't silently create a phantom series). registerHttpMetrics() below
//  declares the standard set this service emits.
export function createMetricsRegistry(): MetricsRegistry {
  const defs = new Map<string, MetricDef>()
  const series = new Map<string, Series>()

  const key = (name: string, labels?: Labels): string => {
    if (!labels) return name
    // Deterministic label ordering so {a,b} and {b,a} map to ONE series. Values are
    // quoted here so the key doubles as the Prometheus label block on render (the
    // exposition format requires quoted label values: method="GET").
    const parts = Object.keys(labels).sort().map((k) => `${k}="${labels[k]}"`)
    return parts.length ? `${name}{${parts.join(',')}}` : name
  }

  const defOf = (name: string): MetricDef => {
    const def = defs.get(name)
    if (!def) throw new Error(`metrics: '${name}' is not registered (register it before use)`)
    return def
  }

  const ensure = (name: string, labels?: Labels): Series => {
    const k = key(name, labels)
    let s = series.get(k)
    if (!s) {
      const def = defOf(name)
      s = def.type === 'histogram'
        ? { value: 0, bucketCounts: new Array((def.buckets ?? []).length).fill(0), sum: 0, count: 0 }
        : { value: 0 }
      series.set(k, s)
    }
    return s
  }

  return {
    incCounter(name, labels, value = 1) {
      if (defOf(name).type !== 'counter') throw new Error(`metrics: '${name}' is not a counter`)
      ensure(name, labels).value += value
    },
    setGauge(name, value, labels) {
      if (defOf(name).type !== 'gauge') throw new Error(`metrics: '${name}' is not a gauge`)
      ensure(name, labels).value = value
    },
    addGauge(name, delta, labels) {
      if (defOf(name).type !== 'gauge') throw new Error(`metrics: '${name}' is not a gauge`)
      ensure(name, labels).value += delta
    },
    observe(name, value, labels) {
      const def = defOf(name)
      if (def.type !== 'histogram') throw new Error(`metrics: '${name}' is not a histogram`)
      const s = ensure(name, labels)
      const bounds = def.buckets ?? []
      for (let i = 0; i < bounds.length; i++) {
        if (value <= bounds[i]) s.bucketCounts![i] += 1
      }
      s.sum! += value
      s.count! += 1
    },
    peek(name, labels) {
      return series.get(key(name, labels))?.value
    },
    define(name, def) {
      const existing = defs.get(name)
      if (existing && existing.type !== def.type) {
        throw new Error(`metrics: '${name}' already defined as ${existing.type}`)
      }
      defs.set(name, def)
    },
    render() {
      return renderProm(defs, series)
    },
  }
}

// ── Standard service metrics — the RED/USE set this api exposes ────────────────
//
//  Declared in ONE place (SSOT) so the names can't drift between the producer and
//  the dashboard. Names follow Prometheus conventions (_total for counters,
//  _seconds for latency). Call once at boot, right after createMetricsRegistry().
export const METRIC = {
  httpRequests:    'http_requests_total',
  httpDuration:    'http_request_duration_seconds',
  httpInFlight:    'http_requests_in_flight',
  rateLimited:     'rate_limit_rejections_total',
  ingestShed:      'ingest_load_shed_total',
  ingestInFlight:  'ingest_in_flight',
  ingestReclaimed: 'ingest_reclaimed_total',
} as const

export function registerHttpMetrics(reg: MetricsRegistry): void {
  const r = reg
  r.define(METRIC.httpRequests,    { type: 'counter', help: 'Total HTTP requests by method and status class.' })
  r.define(METRIC.httpDuration,    { type: 'histogram', help: 'HTTP request duration in seconds.', buckets: DEFAULT_LATENCY_BUCKETS })
  r.define(METRIC.httpInFlight,    { type: 'gauge', help: 'In-flight HTTP requests.' })
  r.define(METRIC.rateLimited,     { type: 'counter', help: 'Requests rejected by the rate limiter, by bucket.' })
  r.define(METRIC.ingestShed,      { type: 'counter', help: 'Ingest uploads load-shed by the bulkhead.' })
  r.define(METRIC.ingestInFlight,  { type: 'gauge', help: 'In-flight ingest uploads in the bulkhead.' })
  r.define(METRIC.ingestReclaimed, { type: 'counter', help: 'Stranded ingest submissions reclaimed by the boot sweep.' })
}

// ── Prometheus text exposition ────────────────────────────────────────────────
function renderProm(defs: Map<string, MetricDef>, series: Map<string, Series>): string {
  const lines: string[] = []
  // Group series by metric name so HELP/TYPE print once per metric.
  const byMetric = new Map<string, Array<[string, Series]>>()
  for (const [k, s] of series) {
    const name = k.includes('{') ? k.slice(0, k.indexOf('{')) : k
    const list = byMetric.get(name) ?? []
    list.push([k, s])
    byMetric.set(name, list)
  }

  for (const [name, def] of defs) {
    const list = byMetric.get(name)
    if (!list || list.length === 0) continue
    lines.push(`# HELP ${name} ${def.help}`)
    lines.push(`# TYPE ${name} ${def.type}`)
    for (const [k, s] of list) {
      const labelStr = k.includes('{') ? k.slice(k.indexOf('{')) : ''
      if (def.type === 'histogram') {
        const bounds = def.buckets ?? []
        let cumulative = 0
        for (let i = 0; i < bounds.length; i++) {
          cumulative += s.bucketCounts![i]
          lines.push(`${name}_bucket${withLe(labelStr, String(bounds[i]))} ${cumulative}`)
        }
        lines.push(`${name}_bucket${withLe(labelStr, '+Inf')} ${s.count ?? 0}`)
        lines.push(`${name}_sum${labelStr} ${s.sum ?? 0}`)
        lines.push(`${name}_count${labelStr} ${s.count ?? 0}`)
      } else {
        lines.push(`${name}${labelStr} ${s.value}`)
      }
    }
  }
  return lines.join('\n') + '\n'
}

/** Insert an `le="…"` label into an existing `{…}` label block (or create one). */
function withLe(labelStr: string, le: string): string {
  if (!labelStr) return `{le="${le}"}`
  return `${labelStr.slice(0, -1)},le="${le}"}`
}
