// @vitest-environment node
//
// ── Fitness: the 'href' source kind (ADR adr_data_source_reference_spectrum, D-HREF) ─
//
//  FF-HREF-DOOR          — an author-supplied url + format resolves to EngineRow[]
//                          through the SAME DataStore port as static/stats (json + csv).
//  FF-SOURCE-KIND-CLOSED — href registers via the same registerStoreBuilder seam;
//                          buildStoreManifest dispatches it with no resolver edit.
//  SSRF gate             — a remote fetch is BLOCKED by default; allowlisting an
//                          origin (per-source) unblocks exactly that origin.
//  OCP registries        — a new format / auth scheme is one registration.
//
//  fetch is mocked throughout — these run in a bare node env. The SSRF gate is
//  exercised explicitly (no real network is ever touched).

import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  registeredKinds, buildStoreManifest, getSourceMetadata, testSource,
} from '@statdash/react/engine'
import type { DatasourceInstanceConfig, EngineRow } from '@statdash/engine'
import {
  registerStoreBuilders, registerHrefStoreBuilder,
  registerHrefFormatParser, registeredHrefFormats,
  registerHrefAuthStrategy, registeredHrefAuthSchemes,
  assertHrefAllowed, fetchHrefRows,
} from './index'

const ORIGIN = 'https://open.data.example'
const JSON_URL = `${ORIGIN}/gdp.json`
const CSV_URL  = `${ORIGIN}/gdp.csv`

/** A Response-like stub with a given body + ok flag. */
function stubResponse(body: string, ok = true, status = 200): Response {
  return {
    ok, status,
    text: () => Promise.resolve(body),
    json: () => Promise.resolve(JSON.parse(body)),
    headers: { get: () => null },
  } as unknown as Response
}

afterEach(() => vi.restoreAllMocks())

describe("'href' source kind — registration + OCP", () => {
  it('the shared boot fn registers a reachable href kind', () => {
    registerStoreBuilders()
    expect(registeredKinds()).toContain('href')
  })

  it('ships json + csv format parsers and none/bearer/header auth schemes', () => {
    registerHrefStoreBuilder()
    expect(registeredHrefFormats()).toEqual(expect.arrayContaining(['json', 'csv']))
    expect(registeredHrefAuthSchemes()).toEqual(expect.arrayContaining(['none', 'bearer', 'header']))
  })
})

describe("'href' resolves EngineRow[] through the DataStore port — FF-HREF-DOOR", () => {
  it('JSON: a bare array document builds a store that serves its rows', async () => {
    registerHrefStoreBuilder()
    const body = JSON.stringify([
      { measure: 'GDP', time: 2020, value: 100 },
      { measure: 'GDP', time: 2021, value: 110 },
    ])
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(stubResponse(body))

    const cfg: DatasourceInstanceConfig = {
      id: 'remote', kind: 'href', url: JSON_URL,
      params: { format: 'json', allowedOrigins: [ORIGIN] },
    }
    const store = (await buildStoreManifest([cfg]))['remote']!
    expect(store).toBeDefined()

    // Flows through the SAME OLAP querySync as static/stats — proves one port.
    expect(store.querySync({ type: 'val', code: 'GDP' }, { dims: { time: 2020 } })[0]?.['value'])
      .toBe(100)
    const obs = store.querySync({ type: 'obs', measure: 'GDP' }, { dims: {} })
    expect(obs).toHaveLength(2)
    expect(fetchSpy).toHaveBeenCalledOnce()
  })

  it('JSON: a { data: [...] } envelope is unwrapped', async () => {
    registerHrefStoreBuilder()
    const body = JSON.stringify({ data: [{ measure: 'CPI', time: 2021, value: 5 }] })
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(stubResponse(body))
    const rows = await fetchHrefRows(JSON_URL, { format: 'json', allowedOrigins: [ORIGIN] })
    expect(rows).toEqual([{ measure: 'CPI', time: 2021, value: 5 }])
  })

  it('CSV: a header + rows document parses into typed EngineRow[]', async () => {
    registerHrefStoreBuilder()
    const csv = 'measure,time,value\nGDP,2020,100\nGDP,2021,110\n'
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(stubResponse(csv))

    const cfg: DatasourceInstanceConfig = {
      id: 'csv', kind: 'href', url: CSV_URL,
      params: { format: 'csv', allowedOrigins: [ORIGIN] },
    }
    const store = (await buildStoreManifest([cfg]))['csv']!
    // numeric cells coerced → the OLAP sum can add them.
    expect(store.querySync({ type: 'val', code: 'GDP' }, { dims: { time: 2020 } })[0]?.['value'])
      .toBe(100)
  })

  it('CSV: quoted fields with embedded commas + escaped quotes parse correctly', async () => {
    registerHrefStoreBuilder()
    const csv = 'measure,label,value\nGDP,"Gross, Domestic",100\nCPI,"a ""quoted"" b",5\n'
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(stubResponse(csv))
    const rows = await fetchHrefRows(CSV_URL, { format: 'csv', allowedOrigins: [ORIGIN] })
    expect(rows[0]).toMatchObject({ measure: 'GDP', label: 'Gross, Domestic', value: 100 })
    expect(rows[1]).toMatchObject({ measure: 'CPI', label: 'a "quoted" b', value: 5 })
  })
})

describe('SSRF gate — default-safe posture', () => {
  it('BLOCKS a fetch when no origin is allowlisted (the default)', async () => {
    registerHrefStoreBuilder()
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    await expect(fetchHrefRows(JSON_URL, { format: 'json' })).rejects.toThrow(/disabled|SSRF/i)
    expect(fetchSpy).not.toHaveBeenCalled() // fetch never fired
  })

  it('blocks an origin that is not on the per-source allowlist', () => {
    expect(() => assertHrefAllowed('https://evil.example/x', [ORIGIN])).toThrow(/not on the allowed/i)
  })

  it('allows an origin that IS on the allowlist (returns its origin)', () => {
    expect(assertHrefAllowed(JSON_URL, [ORIGIN])).toBe(ORIGIN)
  })

  it('blocks a non-http(s) scheme even when allowlisted', () => {
    expect(() => assertHrefAllowed('file:///etc/passwd', ['file://'])).toThrow(/non-http/i)
  })

  it('a builder build is blocked by default (no silent internal fetch)', async () => {
    registerHrefStoreBuilder()
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    await expect(buildStoreManifest([{ id: 'x', kind: 'href', url: 'http://169.254.169.254/latest' }]))
      .rejects.toThrow(/SSRF|disabled/i)
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})

describe('auth strategies — headers from data-only descriptors (no secret logging)', () => {
  it('bearer scheme sends Authorization: Bearer <token>', async () => {
    registerHrefStoreBuilder()
    let sentHeaders: Record<string, string> = {}
    vi.spyOn(globalThis, 'fetch').mockImplementation((_url, init) => {
      sentHeaders = (init?.headers ?? {}) as Record<string, string>
      return Promise.resolve(stubResponse('[]'))
    })
    await fetchHrefRows(JSON_URL, {
      format: 'json', allowedOrigins: [ORIGIN], auth: { scheme: 'bearer', token: 'SECRET' },
    })
    expect(sentHeaders['Authorization']).toBe('Bearer SECRET')
  })

  it('header scheme sends a custom header verbatim', async () => {
    registerHrefStoreBuilder()
    let sentHeaders: Record<string, string> = {}
    vi.spyOn(globalThis, 'fetch').mockImplementation((_url, init) => {
      sentHeaders = (init?.headers ?? {}) as Record<string, string>
      return Promise.resolve(stubResponse('[]'))
    })
    await fetchHrefRows(JSON_URL, {
      format: 'json', allowedOrigins: [ORIGIN], auth: { scheme: 'header', header: { name: 'X-Api-Key', value: 'K' } },
    })
    expect(sentHeaders['X-Api-Key']).toBe('K')
  })

  it('a fetch error message never echoes the auth token', async () => {
    registerHrefStoreBuilder()
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(stubResponse('', false, 403))
    const err: Error = await fetchHrefRows(JSON_URL, {
      format: 'json', allowedOrigins: [ORIGIN], auth: { scheme: 'bearer', token: 'TOPSECRET' },
    }).then(() => new Error('expected throw')).catch((e) => e as Error)
    expect(err.message).not.toContain('TOPSECRET')
    expect(err.message).toContain('403')
  })
})

describe('OCP — a new format / auth scheme is one registration', () => {
  it('a registered custom format parser is picked up by the builder', async () => {
    registerHrefStoreBuilder()
    // A trivial "tsv" parser — header + tab-separated. New format = one line.
    registerHrefFormatParser('tsv', (text) => {
      const [head, ...rows] = text.trim().split('\n')
      const keys = head.split('\t')
      return rows.map((r) => {
        const cells = r.split('\t')
        const row: Record<string, string | number> = {}
        keys.forEach((k, i) => { row[k] = k === 'value' ? Number(cells[i]) : cells[i] })
        return row as EngineRow
      })
    })
    expect(registeredHrefFormats()).toContain('tsv')
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(stubResponse('measure\tvalue\nGDP\t9'))
    const rows = await fetchHrefRows(JSON_URL, { format: 'tsv', allowedOrigins: [ORIGIN] })
    expect(rows).toEqual([{ measure: 'GDP', value: 9 }])
  })

  it('a registered custom auth scheme produces its headers', async () => {
    registerHrefStoreBuilder()
    registerHrefAuthStrategy('query-key', () => ({ 'X-Custom': '1' }))
    expect(registeredHrefAuthSchemes()).toContain('query-key')
    let sent: Record<string, string> = {}
    vi.spyOn(globalThis, 'fetch').mockImplementation((_u, init) => {
      sent = (init?.headers ?? {}) as Record<string, string>
      return Promise.resolve(stubResponse('[]'))
    })
    await fetchHrefRows(JSON_URL, { format: 'json', allowedOrigins: [ORIGIN], auth: { scheme: 'query-key' } })
    expect(sent['X-Custom']).toBe('1')
  })
})

describe('M2 authoring — getMetadata / testConnection (probe + parse-preview)', () => {
  it('getMetadata probes the url and derives dims/measures from the rows', async () => {
    registerHrefStoreBuilder()
    const body = JSON.stringify([{ measure: 'GDP', geo: 'GE', time: 2020, value: 100 }])
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(stubResponse(body))
    const md = await getSourceMetadata({
      id: 's', kind: 'href', url: JSON_URL, params: { format: 'json', allowedOrigins: [ORIGIN] },
    })
    expect(md?.kind).toBe('href')
    expect(md?.dimensions.map((d) => d.code).sort()).toEqual(['geo', 'measure'])
    expect(md?.measures.map((m) => m.code)).toEqual(['value'])
  })

  it('testConnection reports ok when the url is reachable + parses rows', async () => {
    registerHrefStoreBuilder()
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(stubResponse('[{"value":1}]'))
    const res = await testSource({
      id: 's', kind: 'href', url: JSON_URL, params: { format: 'json', allowedOrigins: [ORIGIN] },
    })
    expect(res?.ok).toBe(true)
  })

  it('testConnection reports the SSRF block (not-ok) when no origin is allowed', async () => {
    registerHrefStoreBuilder()
    const res = await testSource({ id: 's', kind: 'href', url: JSON_URL, params: { format: 'json' } })
    expect(res?.ok).toBe(false)
    expect(res?.message).toMatch(/SSRF|disabled/i)
  })

  it('testConnection reports not-ok with no url', async () => {
    registerHrefStoreBuilder()
    const res = await testSource({ id: 's', kind: 'href', params: {} })
    expect(res?.ok).toBe(false)
  })
})
