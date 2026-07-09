// ── metricDrag — the typed metric drag payload round-trips (AR-49 M0) ─────────
//
//  jsdom does not implement a full DataTransfer, so we back it with a minimal
//  Map-based stub exposing exactly the surface metricDrag uses (setData/getData/
//  types/effectAllowed/dropEffect). This proves the write→detect→read contract the
//  canvas drop handler relies on, without a real browser.
//
import { describe, it, expect } from 'vitest'
import { METRIC_DND_FORMAT, writeMetricDrag, hasMetricDrag, readMetricDrag } from './metricDrag'

function fakeDataTransfer(): DataTransfer {
  const store = new Map<string, string>()
  return {
    setData: (format: string, data: string) => { store.set(format.toLowerCase(), data) },
    getData: (format: string) => store.get(format.toLowerCase()) ?? '',
    get types() { return [...store.keys()] },
    effectAllowed: 'none',
    dropEffect: 'none',
  } as unknown as DataTransfer
}

describe('metricDrag — payload round-trip', () => {
  it('writes a metric-id that detect + read recover', () => {
    const dt = fakeDataTransfer()
    writeMetricDrag(dt, 'gdp.realGrowth')

    expect(hasMetricDrag(dt)).toBe(true)
    expect(readMetricDrag(dt)).toBe('gdp.realGrowth')
    expect(dt.getData('text/plain')).toBe('gdp.realGrowth') // interop mirror
    expect(dt.effectAllowed).toBe('copy')
  })

  it('detects the metric format via types (dragover-safe, value unreadable then)', () => {
    const dt = fakeDataTransfer()
    writeMetricDrag(dt, 'x.y')
    expect([...dt.types]).toContain(METRIC_DND_FORMAT)
  })

  it('reports no metric drag / null id for a foreign payload', () => {
    const dt = fakeDataTransfer()
    dt.setData('nodeType', 'chart') // a palette node-type drag, not a metric
    expect(hasMetricDrag(dt)).toBe(false)
    expect(readMetricDrag(dt)).toBeNull()
  })
})
