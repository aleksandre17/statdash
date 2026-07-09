// ── FF-METRIC-AUTHORING-SERIALIZABLE + FF-CATALOG-ONE-SSOT (M2.2, spec §12) ─────
//
//  FF-METRIC-AUTHORING-SERIALIZABLE — an authored metric is PURE JSON (no function /
//  fetch / expr-as-code, Law 2); a saved catalog round-trips
//  site_config → /api/bootstrap → registerManifest* BYTE-IDENTICALLY (the define-side
//  sibling of M0's FF-BIND-PARITY). Proven by: a JSON round-trip of the authored
//  metric + registering the round-tripped copy yields the SAME MetricDef in
//  describeApp() as registering the original — a steward-authored metric is
//  indistinguishable from a provisioned one downstream.
//
//  FF-CATALOG-ONE-SSOT — the authoring store, the delivery manifest and the runner
//  registry all read the SAME site_config catalog; there is no SECOND catalog
//  channel. A source scan asserts the ONLY persistence path is configApi.site.update
//  and the ONLY hydration is fetchCatalogManifest (the /api/bootstrap channel
//  bootstrapCatalog already uses).
//
import { describe, it, expect } from 'vitest'
import type { ManifestMetric } from '@statdash/contracts'
import { registerManifestMetrics } from '@statdash/engine'
import { describeApp } from '@statdash/react/engine'

const AUTHORED: ManifestMetric = {
  id: 'authored_gdp', code: 'B1GQ',
  label: { ka: 'მშპ', en: 'GDP' }, unit: { ka: 'მლნ ₾', en: 'mln GEL' },
  format: 'mln_gel', methodology: 'https://methodology', dims: { ADJUSTMENT: 'S' }, dataSource: 'stats',
}

function functionPaths(value: unknown, path = '$'): string[] {
  if (typeof value === 'function') return [path]
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) => functionPaths(v, `${path}.${k}`))
  }
  return []
}

describe('FF-METRIC-AUTHORING-SERIALIZABLE — authored metric is pure, round-trips byte-identically', () => {
  it('carries no function and survives a JSON round-trip unchanged', () => {
    expect(functionPaths(AUTHORED)).toEqual([])
    expect(JSON.parse(JSON.stringify(AUTHORED))).toEqual(AUTHORED)
  })

  it('registers identically whether or not it passed through the site_config→bootstrap JSON round-trip', () => {
    // The delivery round-trip is exactly JSON.stringify (site_config) → JSON.parse (bootstrap).
    const delivered = JSON.parse(JSON.stringify(AUTHORED)) as ManifestMetric

    registerManifestMetrics([AUTHORED])
    const direct = describeApp().metrics['authored_gdp']
    registerManifestMetrics([delivered])
    const viaWire = describeApp().metrics['authored_gdp']

    // Define-side byte-identity: a steward-authored metric === a provisioned one.
    expect(viaWire).toEqual(direct)
    expect(direct.code).toBe('B1GQ')
    expect(direct.unit).toEqual({ ka: 'მლნ ₾', en: 'mln GEL' })
    expect(direct.format).toBe('mln_gel')
    expect(direct.methodology).toBe('https://methodology')
    expect(direct.dims).toEqual({ ADJUSTMENT: 'S' })
  })
})

// ── FF-CATALOG-ONE-SSOT — source scan: one persist path, one hydrate channel ────
const SRC = import.meta.glob(['./*.ts', './*.tsx'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const read = (suffix: string): string => {
  const entry = Object.entries(SRC).find(([p]) => p.endsWith(suffix))
  if (!entry) throw new Error(`source not found: ${suffix}`)
  return entry[1]
}
/** Strip comments so prose mentioning an endpoint cannot trip the scan. */
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

describe('FF-CATALOG-ONE-SSOT — no second catalog channel', () => {
  it('the ONLY catalog persistence is configApi.site.update (PUT /api/config/site)', () => {
    const save = strip(read('saveSemanticCatalog.ts'))
    expect(save).toContain('configApi.site.update')
    // No competing catalog endpoint (a POST /metrics, /api/catalog, etc.).
    expect(save).not.toMatch(/['"`]\/(?:api\/)?(?:metrics|dimensions|catalog)\b/)
  })

  it('the editable copy hydrates from the SAME bootstrap channel (fetchCatalogManifest)', () => {
    const store = strip(read('semanticCatalog.store.ts'))
    expect(store).toContain('fetchCatalogManifest')
    // It does not open its own catalog fetch endpoint.
    expect(store).not.toMatch(/fetch\(/)
  })

  it('the live refresh re-registers through the engine boot seam (registerManifest*)', () => {
    const save = strip(read('saveSemanticCatalog.ts'))
    expect(save).toContain('registerManifestMetrics')
    expect(save).toContain('registerManifestDimensions')
  })
})
