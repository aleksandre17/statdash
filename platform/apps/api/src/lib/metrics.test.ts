import { describe, it, expect } from 'vitest'
import { createMetricsRegistry, registerHttpMetrics, METRIC } from './metrics.js'

describe('metrics registry', () => {
  it('counts, gauges, and observes into labelled series', () => {
    const reg = createMetricsRegistry()
    reg.define('reqs', { type: 'counter', help: 'h' })
    reg.define('inflight', { type: 'gauge', help: 'h' })
    reg.define('dur', { type: 'histogram', help: 'h', buckets: [0.1, 1] })

    reg.incCounter('reqs', { method: 'GET' })
    reg.incCounter('reqs', { method: 'GET' })
    reg.incCounter('reqs', { method: 'POST' }, 3)
    reg.addGauge('inflight', 2)
    reg.addGauge('inflight', -1)
    reg.observe('dur', 0.05)
    reg.observe('dur', 5)

    expect(reg.peek('reqs', { method: 'GET' })).toBe(2)
    expect(reg.peek('reqs', { method: 'POST' })).toBe(3)
    expect(reg.peek('inflight')).toBe(1)
  })

  it('label order does not split a series (deterministic key)', () => {
    const reg = createMetricsRegistry()
    reg.define('c', { type: 'counter', help: 'h' })
    reg.incCounter('c', { a: '1', b: '2' })
    reg.incCounter('c', { b: '2', a: '1' })
    expect(reg.peek('c', { a: '1', b: '2' })).toBe(2)
  })

  it('fails fast on an unregistered or mistyped metric', () => {
    const reg = createMetricsRegistry()
    reg.define('g', { type: 'gauge', help: 'h' })
    expect(() => reg.incCounter('nope')).toThrow(/not registered/)
    expect(() => reg.incCounter('g')).toThrow(/not a counter/)
  })

  it('renders Prometheus exposition with HELP/TYPE and histogram buckets', () => {
    const reg = createMetricsRegistry()
    registerHttpMetrics(reg)
    reg.incCounter(METRIC.httpRequests, { method: 'GET', status: '2xx' })
    reg.observe(METRIC.httpDuration, 0.02, { method: 'GET' })
    const out = reg.render()
    expect(out).toContain(`# TYPE ${METRIC.httpRequests} counter`)
    expect(out).toContain(`${METRIC.httpRequests}{method="GET",status="2xx"} 1`)
    expect(out).toContain(`# TYPE ${METRIC.httpDuration} histogram`)
    expect(out).toMatch(/http_request_duration_seconds_bucket\{method="GET",le="0.025"\} 1/)
    expect(out).toContain('http_request_duration_seconds_count{method="GET"} 1')
  })
})
