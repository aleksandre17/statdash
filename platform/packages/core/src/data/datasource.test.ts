import { describe, it, expect } from 'vitest'
import type { DatasourceInstanceConfig } from './datasource'

// ── round-trip helpers ────────────────────────────────────────────────

function roundTrip<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

// ── DatasourceInstanceConfig ──────────────────────────────────────────

describe('DatasourceInstanceConfig', () => {
  it('round-trips a minimal descriptor through JSON', () => {
    const minimal: DatasourceInstanceConfig = { id: 'main', kind: 'external' }
    expect(roundTrip(minimal)).toEqual(minimal)
  })

  it('round-trips descriptors with all optional fields populated', () => {
    const full: DatasourceInstanceConfig = {
      id:     'live',
      kind:   'stats',
      url:    'https://stats.example.com/api',
      params: { lang: 'en', timeout: 5000 },
    }
    expect(roundTrip(full)).toEqual(full)
  })

  it('preserves params of mixed types', () => {
    const cfg: DatasourceInstanceConfig = {
      id:   'mixed',
      kind: 'api',
      params: {
        flag:   true,
        count:  42,
        tags:   ['a', 'b'],
        nested: { x: 1, y: null },
      },
    }
    expect(roundTrip(cfg)).toEqual(cfg)
  })

  it('accepts open kind strings beyond the built-in set', () => {
    const kinds: string[] = ['custom', 'file', 'graphql', 'grpc']
    for (const kind of kinds) {
      const cfg: DatasourceInstanceConfig = { id: kind, kind }
      expect(roundTrip(cfg).kind).toBe(kind)
    }
  })

  it('round-trips an array of mixed descriptors identically', () => {
    const configs: DatasourceInstanceConfig[] = [
      { id: 'store-a', kind: 'external' },
      { id: 'store-b', kind: 'api',   url: 'https://api.example.com' },
      { id: 'store-c', kind: 'stats', url: 'https://stats.geostat.ge', params: { locale: 'ka' } },
    ]
    expect(roundTrip(configs)).toEqual(configs)
  })

  it('omitted optional fields are absent after round-trip', () => {
    const cfg: DatasourceInstanceConfig = { id: 'bare', kind: 'external' }
    const result = roundTrip(cfg)
    expect(result).not.toHaveProperty('url')
    expect(result).not.toHaveProperty('params')
  })

  // FF-CONFIG-ROUNDTRIP (extend) — a 'static' source's inline `params.values`
  // survive JSON round-trip unchanged. This is the offline/portability invariant
  // made executable: a config that embeds its own data serializes losslessly.
  // (ADR adr_data_source_reference_spectrum — the STATIC kind.)
  it("round-trips a 'static' descriptor's inline values losslessly", () => {
    const cfg: DatasourceInstanceConfig = {
      id:     'demo',
      kind:   'static',
      params: {
        values: [
          { measure: 'GDP', time: 2020, value: 100 },
          { measure: 'GDP', time: 2021, value: 110 },
        ],
        classifiers: { time: [] },
      },
    }
    expect(roundTrip(cfg)).toEqual(cfg)
  })
})
