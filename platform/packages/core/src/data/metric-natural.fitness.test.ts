// ── ADR-047 Wave A · DECISION 1 — metric-natural browse coordinates ────────────────
//
//  The three biting gates that close the W-P5c −100 FINDING (card 0082): a grain-∅ calc
//  browse of a NATIONAL metric on a page pinning a FOREIGN dim (geo=<region>) renders the
//  REAL national growth series + an honest first-period null — NEVER −100 (a Law-11 lie: a
//  number fabricated from an empty match). The coordinate rule is DERIVED from the obs slice
//  the browse already scans (Law 5), never a declared per-metric axis field.
//
//  • FF-BROWSE-METRIC-NATURAL        — the exact −100 reproduction turns green→honest.
//  • FF-BROWSE-WARM-COVERS-NATURAL   — warm ≡ read across the re-merge wall on an async store.
//  • FF-NATURAL-DERIVED-NOT-DECLARED — naturality derives from obs; no declared axis field.
//
// @vitest-environment node

import { describe, it, expect, vi, afterEach } from 'vitest'
import { interpretSpec, extractRequirements } from './spec'
import { metricNaturalDims, naturalBrowseCtx } from './metric-natural'
import { registerMetric }        from './metric'
import { ExternalStore }         from './store-impl'
import { ApiStore }              from './store-api'
import type { RawObsRow }        from './store-api'
import '../registry/resolvers'   // side-effect: register the built-in resolvers
import type { EngineRow }        from './encoding'
import type { DataSpec }         from '../config/data-spec'
import type { Observation }      from '../sdmx'
import type { SectionContext }   from '../core/context'

// ── The fixture: a NATIONAL GDP (obs only at geo:'_T') + a calc YoY over it ─────────
//
//  gdp.growthYoy has NO geo axis (its component GDP is national). Browsed on a page that
//  pins geo='adjara' (a region GDP has no obs for), the FOREIGN geo pin must be neutralized
//  so resolveMetricValue reads national GDP — not storeValAt(GDP,{geo:adjara})=0 → −100.
const NATIONAL_GDP: Observation[] = [
  { measure: 'nat:GDP', time: 2018, geo: '_T', value: 80,  label: 'GDP', color: '#111' },
  { measure: 'nat:GDP', time: 2019, geo: '_T', value: 90,  label: 'GDP', color: '#111' },
  { measure: 'nat:GDP', time: 2020, geo: '_T', value: 100, label: 'GDP', color: '#111' },
]

// A REGIONAL measure (obs at concrete geo members) — geo IS a natural axis, kept on browse.
const REGIONAL_GVA: Observation[] = [
  { measure: 'reg:GVA', time: 2019, geo: 'adjara', value: 10, label: 'GVA', color: '#222' },
  { measure: 'reg:GVA', time: 2020, geo: 'adjara', value: 12, label: 'GVA', color: '#222' },
  { measure: 'reg:GVA', time: 2019, geo: 'tbilisi', value: 40, label: 'GVA', color: '#222' },
]

// growth-YoY expr: (cur / prev − 1) × 100 — REUSES @statdash/expr, no second dialect.
const YOY_EXPR = {
  op: 'mul',
  left:  { op: 'sub', left: { op: 'div', left: { $derived: 'cur' }, right: { $derived: 'prev' } }, right: 1 },
  right: 100,
} as const

registerMetric('natv:gdp', { label: { en: 'GDP' }, code: 'nat:GDP' })
registerMetric('natv:gva', { label: { en: 'GVA' }, code: 'reg:GVA' })
registerMetric('natv:gdp-yoy', {
  label: { en: 'GDP growth YoY' },
  additivity: 'non-additive',
  calc: {
    inputs: {
      cur:  { measure: 'natv:gdp' },
      prev: { measure: 'natv:gdp', at: { time: { $prev: 1 } } },
    },
    expr: YOY_EXPR,
  },
})

const store    = new ExternalStore(NATIONAL_GDP)
const regStore = new ExternalStore(REGIONAL_GVA)
// The FOREIGN coordinate: a region the national metric has no obs for, no year pin (range).
const foreignCtx: SectionContext = { dims: { geo: 'adjara' } }

// ── FF-NATURAL-DERIVED-NOT-DECLARED — naturality is a projection of the obs, not a field ──
describe('FF-NATURAL-DERIVED-NOT-DECLARED — the metric-natural axes derive from the obs slice', () => {
  it('a NATIONAL metric (obs only at geo:_T) has NO natural geo axis — geo is a FOREIGN pin', () => {
    // metricNaturalDims reads ONLY the obs (Law 5); a dim carrying only the '_T' total is
    // NOT a natural axis. No MetricDef/ManifestMetric axis field is consulted.
    const natural = metricNaturalDims(NATIONAL_GDP, 'nat:GDP')
    expect(natural.has('time')).toBe(true)     // time carries concrete members
    expect(natural.has('geo')).toBe(false)     // geo carries only '_T' → not natural

    const { ctx, neutralized } = naturalBrowseCtx(NATIONAL_GDP, 'nat:GDP', foreignCtx)
    expect(neutralized).toEqual(['geo'])                 // the foreign geo pin is neutralized
    expect(ctx.dims['geo']).toBe('')                     // to the empty-wildcard
  })

  it('a REGIONAL metric (obs at concrete geo members) KEEPS a natural geo pin', () => {
    const natural = metricNaturalDims(REGIONAL_GVA, 'reg:GVA')
    expect(natural.has('geo')).toBe(true)                // adjara/tbilisi are concrete members
    const { neutralized, ctx } = naturalBrowseCtx(REGIONAL_GVA, 'reg:GVA', foreignCtx)
    expect(neutralized).toEqual([])                      // geo=adjara is a NATURAL pin → kept
    expect(ctx.dims['geo']).toBe('adjara')
  })

  it('a pin ON the total (geo:_T) is kept — only a genuinely foreign coordinate is dropped', () => {
    const { neutralized } = naturalBrowseCtx(NATIONAL_GDP, 'nat:GDP', { dims: { geo: '_T' } })
    expect(neutralized).toEqual([])                      // '_T' IS present in the obs → not foreign
  })
})

// ── FF-BROWSE-METRIC-NATURAL — the −100 reproduction, green→honest ─────────────────
describe('FF-BROWSE-METRIC-NATURAL — a calc browse under a FOREIGN pin renders the real series', () => {
  const calcBrowse: DataSpec = {
    type: 'pipeline', pipe: [{ op: 'source', metrics: ['natv:gdp-yoy'] }], encoding: { label: 'id' },
  }

  it('gdp.growthYoy browsed on a geo=adjara page = the REAL national YoY, NEVER −100', () => {
    const rows = interpretSpec(calcBrowse, foreignCtx, store)
    expect(rows.map((r) => r['id'])).toEqual(['2018', '2019', '2020'])
    expect(rows[0]!['value']).toBeNull()                       // first period — honest no-data (ADR-045)
    expect(Number(rows[1]!['value'])).toBeCloseTo(12.5)        // (90/80 − 1)×100 — the REAL series
    expect(Number(rows[2]!['value'])).toBeCloseTo(11.111, 2)   // (100/90 − 1)×100
    // The Law-11 floor: NOTHING is the fabricated −100 (0/prev from a zeroed foreign match).
    for (const r of rows) expect(r['value']).not.toBe(-100)
  })

  it('a BASE national metric browsed under a foreign pin reads its NATURAL (national) table', () => {
    const baseBrowse: DataSpec = {
      type: 'pipeline', pipe: [{ op: 'source', metrics: ['natv:gdp'] }], encoding: { label: 'id' },
    }
    const rows = interpretSpec(baseBrowse, foreignCtx, store)
    expect(rows.length).toBe(3)                                // all national obs, not an empty slice
    expect(rows.every((r) => r['geo'] === '_T')).toBe(true)    // the metric's own natural rows
  })

  it('a REGIONAL calc metric under its own region still shows that region (natural pin kept)', () => {
    registerMetric('natv:gva-yoy', {
      label: { en: 'GVA YoY' }, additivity: 'non-additive',
      calc: { inputs: { cur: { measure: 'natv:gva' }, prev: { measure: 'natv:gva', at: { time: { $prev: 1 } } } }, expr: YOY_EXPR },
    })
    const browse: DataSpec = { type: 'pipeline', pipe: [{ op: 'source', metrics: ['natv:gva-yoy'] }], encoding: { label: 'id' } }
    const rows = interpretSpec(browse, foreignCtx, regStore)
    // adjara's own series: 2019 (first — null) then 2020 = (12/10 − 1)×100 = 20.
    expect(rows.map((r) => r['id'])).toEqual(['2019', '2020'])
    expect(rows[0]!['value']).toBeNull()
    expect(Number(rows[1]!['value'])).toBeCloseTo(20)
  })
})

// ── FF-BROWSE-WARM-COVERS-NATURAL — warm ≡ read across the re-merge wall (async store) ──
//
//  Drives a REAL ApiStore (fake server), warms EXACTLY the slices useNodeRows' warm walk
//  issues (extractRequirements → val+obs per req at the re-merged ctx), then renders via the
//  sync interpretSpec the live DOM drives. The warm neutralizes the foreign geo pin to '' so
//  the re-merge (reqCtx = {...ctx.dims, ...r.dims}) warms the metric's NATURAL slice — the
//  browse read must resolve from it WITHOUT a cold querySync.
const RAW_NATIONAL: RawObsRow[] = NATIONAL_GDP.map((o) => ({
  time_period:   String(o['time']),
  dim_key:       { measure: String(o['measure']), geo: String(o['geo']) },
  obs_value:     String(o['value']),
  obs_status:    'A',
  obs_attribute: {},
}))

const mapRow = (raw: RawObsRow): EngineRow => ({
  ...raw.dim_key,
  time:  Number(raw.time_period),
  value: raw.obs_value === null ? null : Number(raw.obs_value),
})

/** A fake /api/stats/observations that scopes RAW_NATIONAL by the wire params (server-side). */
function fakeFetch(raw: RawObsRow[]) {
  return vi.fn(async (url: string) => {
    const qs     = new URL(url, 'http://api.test').searchParams
    const from   = qs.get('from')
    const to     = qs.get('to')
    const filter = qs.get('filter') ? (JSON.parse(qs.get('filter')!) as Record<string, unknown>) : {}
    const data   = raw.filter((r) => {
      if (from && Number(r.time_period) < Number(from)) return false
      if (to   && Number(r.time_period) > Number(to))   return false
      for (const [dim, val] of Object.entries(filter)) {
        const rv = r.dim_key[dim]
        if (Array.isArray(val)) { if (!val.map(String).includes(String(rv))) return false }
        else if (String(rv) !== String(val)) return false
      }
      return true
    })
    return {
      ok: true, status: 200,
      headers: { get: () => null },
      json:    async () => ({ data }),
      text:    async () => '',
    } as unknown as Response
  })
}

/** nonTimeDims = ['geo']: geo flows into the wire filter; measure is pinned per-val. */
function makeApiStore(): ApiStore {
  return new ApiStore('http://api.test', 'GDP_DS', ['geo'], {}, mapRow)
}

/** Warm EXACTLY the slices useNodeRows warms: val + obs at each re-merged req ctx. */
async function warmLikeLive(api: ApiStore, spec: DataSpec, ctx: SectionContext): Promise<void> {
  for (const r of extractRequirements(spec, ctx)) {
    const reqCtx: SectionContext = { ...ctx, dims: { ...ctx.dims, ...r.dims } }
    await api.queryAsync({ type: 'val', code: r.code }, reqCtx)
    await api.queryAsync({ type: 'obs', measure: r.code }, reqCtx)
  }
}

describe('FF-BROWSE-WARM-COVERS-NATURAL — the natural browse read is warm-covered', () => {
  afterEach(() => vi.unstubAllGlobals())

  const calcBrowse: DataSpec = {
    type: 'pipeline', pipe: [{ op: 'source', metrics: ['natv:gdp-yoy'] }], encoding: { label: 'id' },
  }

  it('warm requirement neutralizes the foreign geo pin to the empty-wildcard', () => {
    const reqs = extractRequirements(calcBrowse, foreignCtx)
    expect(reqs.length).toBeGreaterThan(0)
    // Every req warms the whole-table superset: geo='' (NOT geo=adjara), so the re-merge wall
    // ({...ctx.dims, ...r.dims}) yields geo='' (unpinned), not the inherited foreign pin.
    for (const r of reqs) {
      expect(r.code).toBe('nat:GDP')
      expect(r.dims['geo']).toBe('')
    }
  })

  it('a calc browse resolves the REAL series off the warm — no cold querySync, no −100', async () => {
    vi.stubGlobal('fetch', fakeFetch(RAW_NATIONAL))
    const api = makeApiStore()
    await warmLikeLive(api, calcBrowse, foreignCtx)

    let rows!: EngineRow[]
    expect(() => { rows = interpretSpec(calcBrowse, foreignCtx, api) }).not.toThrow()
    // Byte-identical to the in-memory ExternalStore result over the same data.
    expect(rows).toEqual(interpretSpec(calcBrowse, foreignCtx, store))
    expect(rows[0]!['value']).toBeNull()
    expect(Number(rows[1]!['value'])).toBeCloseTo(12.5)
    for (const r of rows) expect(r['value']).not.toBe(-100)
  })

  it('a BASE national browse resolves its natural table off the warm (no cold throw)', async () => {
    vi.stubGlobal('fetch', fakeFetch(RAW_NATIONAL))
    const api = makeApiStore()
    const baseBrowse: DataSpec = {
      type: 'pipeline', pipe: [{ op: 'source', metrics: ['natv:gdp'] }], encoding: { label: 'id' },
    }
    await warmLikeLive(api, baseBrowse, foreignCtx)
    let rows!: EngineRow[]
    expect(() => { rows = interpretSpec(baseBrowse, foreignCtx, api) }).not.toThrow()
    expect(rows.length).toBe(3)                               // the national table, not empty
  })

  it('negative control — NOTHING warmed cold-crashes (the guard has teeth)', () => {
    vi.stubGlobal('fetch', fakeFetch(RAW_NATIONAL))
    const api = makeApiStore()                                // cache empty — no covering slice
    expect(() => interpretSpec(calcBrowse, foreignCtx, api)).toThrow(/cold|cache miss/)
  })
})
