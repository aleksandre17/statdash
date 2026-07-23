// @vitest-environment node
//
// ── Fitness functions — the REGIONAL cross-filter linkage web (committed artifact)
//
//  The cross-filter MECHANISM (useNodeInteractions / applySelection / on[] / $ctx)
//  is proven by the engine-layer suites (applySelection.test, useNodeInteractions.test,
//  crossFilterKpi.fitness). THIS suite gates the AUTHORING: that the geostat regional
//  page actually WIRES the intended analytical web declaratively in the committed
//  provisioning JSON — the read bindings ({$ctx:geo}/{$ctx:sector}) on the panels that
//  should re-scope, and the on[] emitters on the surfaces that should drive a selection.
//
//  A hand-edit that drops a link (removes a $ctx ref or an on[] handler) fails here on
//  every run, with NO database — the file is read off disk and walked structurally.
//
//  Intended web (regional page):
//    region-select (map / table)      → sector donut + sectoral structure re-scope ($ctx:geo)
//    sector-select (dropdown / donut) → region bar + choropleth re-scope ($ctx:sector)
//    region + sector                  → intersection (both $ctx on the same panel)

import { describe, it, expect, beforeAll } from 'vitest'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const ARTIFACT_PATH = resolve(here, '../../provisioning/geostat.provisioning.json')

type Json = Record<string, unknown>
interface Page { config: { id?: string } & Json }
interface Artifact { pages: Page[] }

// ── tree helpers (generic, no privileged shape) ──────────────────────────────
function walk(node: unknown, visit: (n: Json) => void): void {
  if (Array.isArray(node)) { for (const c of node) walk(c, visit); return }
  if (node && typeof node === 'object') {
    visit(node as Json)
    for (const v of Object.values(node as Json)) walk(v, visit)
  }
}
function find(root: unknown, pred: (n: Json) => boolean): Json | undefined {
  let hit: Json | undefined
  walk(root, (n) => { if (!hit && pred(n)) hit = n })
  return hit
}
function findById(root: unknown, id: string): Json | undefined {
  return find(root, (n) => n.id === id)
}
function findAll(root: unknown, pred: (n: Json) => boolean): Json[] {
  const out: Json[] = []
  walk(root, (n) => { if (pred(n)) out.push(n) })
  return out
}
// the $ctx dim a filter slot binds, if any: { geo: { $ctx: 'geo' } } → 'geo'
function ctxDim(filter: unknown, slot: string): string | undefined {
  const f = (filter as Json | undefined)?.[slot] as Json | undefined
  return typeof f?.$ctx === 'string' ? (f.$ctx as string) : undefined
}
// The steward ObsQuery of a node's DataSpec — dialect-agnostic (W0/Z8): the ONE
// rest grammar carries it on the `source` HEAD (`data.pipe[0].query`); the legacy
// sugar carried it at `data.query` (kept so the fitness still bites a regression
// that re-enters the sugar form).
function obsQueryOf(data: Json | undefined): Json | undefined {
  if (!data) return undefined
  if (data.query && typeof data.query === 'object') return data.query as Json
  const head = Array.isArray(data.pipe) ? (data.pipe as unknown[])[0] : undefined
  if (head && typeof head === 'object' && (head as Json).op === 'source') {
    return (head as Json).query as Json | undefined
  }
  return undefined
}
function queryFilter(node: Json | undefined): Json | undefined {
  return obsQueryOf(node?.data as Json | undefined)?.filter as Json | undefined
}
interface FilterAction { type?: string; key?: string | Json; fromField?: string; mode?: string; max?: number }
interface Handler { event?: string; actions?: FilterAction[] }
function handlers(node: Json | undefined): Handler[] {
  return Array.isArray(node?.on) ? (node!.on as Handler[]) : []
}
// does the subtree rooted at `node` contain a chart that emits a filter on `key`?
function emitterFor(node: Json | undefined, key: string, event: string): Json | undefined {
  return find(node, (n) =>
    handlers(n).some((h) => h.event === event && (h.actions ?? []).some((a) => a.type === 'filter' && a.key === key)),
  )
}

const REGIONAL_DIMS = new Set(['region', 'sector', 'geo'])

// Extract the candidate dim string(s) a page-var value can resolve to. A constant
// string resolves to itself; an op:if derive (the AR-36/AR-38 state-bound seam) can
// resolve to either branch, so BOTH then/else must be known dims. Nested if supported.
function varDimValues(v: unknown): string[] {
  if (typeof v === 'string') return [v]
  if (v && typeof v === 'object') {
    const o = v as Json
    if (o.op === 'if') return [...varDimValues(o.then), ...varDimValues(o.else)]
  }
  return []
}
// Resolve a page var by name from any node's `vars` bag in the tree.
function pageVar(root: unknown, name: string): unknown {
  const holder = find(root, (n) =>
    n.vars !== undefined && typeof n.vars === 'object' && name in (n.vars as Json))
  return (holder?.vars as Json | undefined)?.[name]
}

describe('regional cross-filter linkage web (committed provisioning)', () => {
  let regional: Page

  beforeAll(async () => {
    const artifact = JSON.parse(await readFile(ARTIFACT_PATH, 'utf8')) as Artifact
    const page = artifact.pages.find((p) => p.config.id === 'regional')
    expect(page, 'regional page present').toBeDefined()
    regional = page!
  })

  // FF-XF-REGION-TO-SECTOR — selecting a region re-scopes the sectoral-structure panels.
  // (`sectors` is now the ONE composition PIVOT panel — see FF-COMPOSITION-PIVOT — whose
  //  geo filter follows the selection; the sector-history panel binds {$ctx:geo} too.)
  it('FF-XF-REGION-TO-SECTOR: the composition pivot + history panels bind {$ctx:geo}', () => {
    expect(ctxDim(queryFilter(findById(regional.config, 'sectors')), 'geo')).toBe('geo')
    expect(ctxDim(queryFilter(findById(regional.config, 'sector-history')), 'geo')).toBe('geo')
  })

  // FF-XF-SECTOR-TO-REGION — selecting a sector re-scopes the region comparison + choropleth.
  it('FF-XF-SECTOR-TO-REGION: the region-comparison bar + both choropleth maps bind {$ctx:sector}', () => {
    expect(ctxDim(queryFilter(findById(regional.config, 'regions-bar')), 'sector')).toBe('sector')
    expect(ctxDim(queryFilter(findById(regional.config, 'geo-map')), 'sector')).toBe('sector')
    expect(ctxDim(queryFilter(findById(regional.config, 'geo-map-range')), 'sector')).toBe('sector')
  })

  // FF-XF-INTERSECTION — region + sector compose on the same panel (both dims reactive).
  it('FF-XF-INTERSECTION: regions-bar + sectors-range bind BOTH {$ctx:geo} and {$ctx:sector}', () => {
    const bar = queryFilter(findById(regional.config, 'regions-bar'))
    expect(ctxDim(bar, 'geo')).toBe('geo')
    expect(ctxDim(bar, 'sector')).toBe('sector')
    const rng = queryFilter(findById(regional.config, 'sectors-range'))
    expect(ctxDim(rng, 'geo')).toBe('geo')
    expect(ctxDim(rng, 'sector')).toBe('sector')
  })

  // FF-XF-REGION-EMIT — the map + a comparison table DRIVE a region selection.
  it('FF-XF-REGION-EMIT: geo-map (selection:change) and a table (row:click) emit key=region', () => {
    const map = findById(regional.config, 'geo-map')
    expect(handlers(map).some((h) => h.event === 'selection:change'
      && (h.actions ?? []).some((a) => a.type === 'filter' && a.key === 'region'))).toBe(true)
    const tableEmitter = find(regional.config, (n) =>
      n.type === 'table' && handlers(n).some((h) => h.event === 'row:click'
        && (h.actions ?? []).some((a) => a.type === 'filter' && a.key === 'region')))
    expect(tableEmitter, 'a region-emitting table exists').toBeDefined()
  })

  // FF-XF-SECTOR-EMIT — the sector-history chart DRIVES a sector selection (area series →
  // key=sector). The composition PIVOT panel now drives the region axis (region-select is
  // the primary directional flow region → sectoral view); sector-directional lives on the
  // sector-history surface + the sector filter dropdown.
  it('FF-XF-SECTOR-EMIT: sector-history chart emits key=sector on point:click', () => {
    expect(emitterFor(findById(regional.config, 'sector-history'), 'sector', 'point:click')).toBeDefined()
  })

  // FF-XF-SECTOR-EMIT reads the sector code — fromField must be the sector field, not the default key.
  it('FF-XF-SECTOR-EMIT: sector emitter reads fromField=sector (the sector code, not the label)', () => {
    const chart = emitterFor(findById(regional.config, 'sector-history'), 'sector', 'point:click')
    const action = handlers(chart).flatMap((h) => h.actions ?? []).find((a) => a.key === 'sector')
    expect(action?.fromField, 'sector-history emitter fromField').toBe('sector')
  })

  // FF-XF-DECLARATIVE — every authored handler is pure JSON: a known trigger + filter actions
  // writing a string dim key (no functions, no privileged/unknown dims). Config = SSOT.
  it('FF-XF-DECLARATIVE: every on[] handler is a known trigger writing a string regional dim', () => {
    const emitters = findAll(regional.config, (n) => handlers(n).length > 0)
    expect(emitters.length).toBeGreaterThan(0)
    const triggers = new Set(['point:click', 'row:click', 'row:hover', 'selection:change'])
    for (const node of emitters) {
      for (const h of handlers(node)) {
        expect(triggers.has(h.event ?? '')).toBe(true)
        for (const a of h.actions ?? []) {
          expect(a.type).toBe('filter')
          // The action key is either a plain string dim OR a state-bound {$ctx:_var}
          // ref (the AR-38 rotation seam) — in EITHER case it must resolve to a KNOWN
          // regional dim, never a function/unknown shape (config = SSOT, Law 1/2).
          const key = a.key
          if (typeof key === 'string') {
            expect(REGIONAL_DIMS.has(key)).toBe(true)
          } else if (key && typeof key === 'object' && typeof (key as Json).$ctx === 'string') {
            const dims = varDimValues(pageVar(regional.config, (key as Json).$ctx as string))
            expect(dims.length, `on[] key {$ctx:${(key as Json).$ctx}} must resolve to a page var`).toBeGreaterThan(0)
            for (const d of dims) expect(REGIONAL_DIMS.has(d), `{$ctx} key resolves to '${d}'`).toBe(true)
          } else {
            throw new Error(`on[] filter key must be a string dim or a {$ctx} ref, got ${JSON.stringify(key)}`)
          }
          if (a.mode !== undefined) expect(['replace', 'toggle', 'clear']).toContain(a.mode)
        }
      }
    }
  })

  // ── FF-COMPOSITION-PIVOT (AR-36) ────────────────────────────────────────────
  //  The two visibleWhen A/B composition panels (by-region donut + sectoral-structure
  //  bar) are FOLDED into ONE `sectors` PIVOT panel: the OLAP mark + encoding channels
  //  + roll-up LEVEL bind to state (`{$ctx:…}`), so the panel rotates donut⇄bar and
  //  by-region⇄sector×geo with the selection — no visibleWhen fork, no sectors-multi.
  //  State A (no region): donut, x=geoLabel, no series, by:[geo]. State B (region[s]):
  //  stacked bar, x=sectorLabel, series=geoLabel, by:[sector,geo,time]. All from ONE
  //  query whose geo filter follows the selection.
  const sectionView = (id: string): Json | undefined =>
    (findById(regional.config, id)?.view as Json | undefined)?.visibleWhen as Json | undefined

  it('FF-COMPOSITION-PIVOT: ONE panel binds mark + encoding + roll-up to state (no visibleWhen fork)', () => {
    const sectors = findById(regional.config, 'sectors')
    expect(sectors, 'the composition pivot panel exists').toBeDefined()
    // The fold retires the second panel + the visibleWhen A/B fork entirely.
    expect(findById(regional.config, 'sectors-multi'), 'sectors-multi is retired').toBeUndefined()
    expect(sectionView('sectors'), 'the pivot panel is always visible (no visibleWhen fork)').toBeUndefined()
    // MARK binds to state (P3): donut ⇄ bar via {$ctx:_mark}.
    const chart = find(sectors, (n) => n.type === 'chart')
    expect((chart?.chartType as Json | undefined)?.$ctx, 'chartType (mark) binds to state').toBe('_mark')
    // ENCODING channels bind to state (P2): x/series rotate via {$ctx}; slices carry the region code.
    const enc = (sectors?.data as Json | undefined)?.encoding as Json | undefined
    expect((enc?.label as Json | undefined)?.$ctx, 'x channel binds to state').toBe('_xDim')
    expect((enc?.series as Json | undefined)?.$ctx, 'series channel binds to state').toBe('_seriesDim')
    expect(enc?.id, 'slices/segments carry the region code (encoding id=geo)').toBe('geo')
    // ROLL-UP LEVEL binds to state (the grain — P2 data model): aggregate by {$ctx:_byDims}.
    const pipe = (sectors?.data as Json | undefined)?.pipe as Json[] | undefined
    const agg  = pipe?.find((s) => s.op === 'aggregate')
    expect((agg?.by as Json | undefined)?.$ctx, 'roll-up grain binds to state').toBe('_byDims')
    // Clicking DRIVES a region selection (directional pin: region → sectoral view).
    expect(emitterFor(sectors, 'region', 'point:click'), 'composition pivot emits key=region').toBeDefined()
  })

  // ── FF-COMPARISON-SCOPES-TO-SELECTION ───────────────────────────────────────
  //  The bottom region-comparison bar scopes to the selected regions on region-select
  //  (State B → only the selected regions) while remaining the all-regions ranking in
  //  State A. ONE binding expresses both: geo:{$ctx:geo,$ne:_T} — $ctx follows the
  //  selection (empty → wildcard = all regions), $ne drops the _T aggregate row.
  it('FF-COMPARISON-SCOPES-TO-SELECTION: regions-bar geo binds {$ctx:geo} and excludes the _T aggregate', () => {
    const geo = (queryFilter(findById(regional.config, 'regions-bar'))?.geo) as Json | undefined
    expect(geo?.$ctx, 'follows the region selection').toBe('geo')
    expect(geo?.$ne, 'excludes the _T national-aggregate row').toBe('_T')
  })

  // ── FF-REGIONAL-KPI-GEO-BINDING ─────────────────────────────────────────────
  //  A regional KPI geo filter must resolve to the CONSTITUENT leaf regions, never
  //  the '_T' aggregate row and never a bare wildcard default. Binding
  //  {$ctx:geo, $ne:'_T'} achieves the correct value in EVERY state with ONE
  //  expression (mirrors FF-COMPARISON-SCOPES-TO-SELECTION on regions-bar):
  //   • no selection   → Σ of the 11 leaf regions = national, ONCE. A bare wildcard
  //     default ('') sums _T + leaves in the live data → the 2× double-count (161766);
  //     a '_T' default reads only the aggregate row (correct here but wrong below).
  //   • sector-select  → Σ of all leaf regions AT that sector = national-for-sector;
  //     a '_T' default would read the empty `geo=_T × sector=X` cell → 0.
  //   • region-select  → the selected regions ($ctx:geo overrides).
  it('FF-REGIONAL-KPI-GEO-BINDING: regional $ctx:geo refs bind $ne:_T (constituent regions), never a wildcard/_T default', () => {
    const geoRefs = findAll(regional.config, (n) => n.$ctx === 'geo')
    expect(geoRefs.length, 'the regional config carries $ctx:geo refs').toBeGreaterThan(0)
    for (const r of geoRefs) {
      // the wildcard/'_T' defaults were superseded by the $ne:'_T' constituent-regions binding
      expect('default' in r, `$ctx:geo ref must bind $ne:'_T', not default:'${r.default}'`).toBe(false)
    }
    const neRefs = geoRefs.filter((r) => r.$ne === '_T')
    expect(neRefs.length, 'regional geo refs use the $ne:_T constituent-regions binding').toBeGreaterThan(0)
  })

  // ══ AR-38 — directional SECTOR arm of the cross-filter ═══════════════════════
  //
  //  select sector → pin sector, DISPLAY geo (that sector across regions); compound
  //  region∧sector = intersection. The six composition derives now key on BOTH
  //  {$ctx:region} AND {$ctx:sector} with a SECTOR-PRIORITY tiebreaker. See
  //  work/DESIGN-directional-sector-crossfilter.md.

  // Faithful inlined mirror of resolveDirectional (packages/core/src/data/directional.ts)
  // — keeps this node-env committed-artifact suite engine-free (no dist dependency), as
  // the old evalDerive expr-mirror did. The LAW is now proven byte-identical to the six
  // (retired) op:if derives by the CORE parity fitness (directional.fitness.test.ts);
  // THIS gate proves the committed provisioning WIRES that op with the right focus/co/
  // priority/grain — a hand-edit to the _directional var that breaks a cell fails here.
  interface DirSpec { op: string; focus: string; co: string; priority: string[]; grain?: string[]; unselected?: string[] }
  function resolveDir(spec: DirSpec, dims: Record<string, string>): Record<string, string> {
    const f = spec.focus, c = spec.co
    const [fp, cp] = spec.priority
    const un = spec.unselected ?? ['']
    const grain = spec.grain ?? []
    const active = (k: string) => !un.includes(dims[k] ?? '')
    const fA = active(fp), cA = active(cp), bar = fA || cA
    return {
      _seriesDim: fA ? `${f}Label` : cA ? `${c}Label` : '',
      _xDim:      fA ? `${c}Label` : cA ? `${f}Label` : `${c}Label`,
      _mark:      bar ? 'bar' : 'donut',
      _byDims:    bar ? [f, c, ...grain].join(',') : c,
      _sortBy:    fA ? 'value' : cA ? `${f}Order` : 'value',
      _sortDir:   fA ? 'desc'  : cA ? 'asc'        : 'desc',
    }
  }

  const DERIVES = ['_xDim', '_seriesDim', '_mark', '_byDims', '_sortBy', '_sortDir'] as const
  // The acceptance spine (DESIGN §2). A/B = shipped region arm; C/D = the sector arm.
  const STATES: Record<string, Record<string, string>> = {
    A: { region: '',   sector: ''   },   // none      → donut of regions
    B: { region: 'R2', sector: ''   },   // region    → x=sector, series=geo
    C: { region: '',   sector: 'S1' },   // sector    → x=geo,    series=sector (across all regions)
    D: { region: 'R2', sector: 'S1' },   // compound  → x=geo,    series=sector (intersection)
  }
  const EXPECT: Record<string, Record<string, string>> = {
    A: { _xDim: 'geoLabel',    _seriesDim: '',           _mark: 'donut', _byDims: 'geo',             _sortBy: 'value',       _sortDir: 'desc' },
    B: { _xDim: 'sectorLabel', _seriesDim: 'geoLabel',   _mark: 'bar',   _byDims: 'sector,geo,time', _sortBy: 'sectorOrder', _sortDir: 'asc'  },
    C: { _xDim: 'geoLabel',    _seriesDim: 'sectorLabel', _mark: 'bar',  _byDims: 'sector,geo,time', _sortBy: 'value',       _sortDir: 'desc' },
    D: { _xDim: 'geoLabel',    _seriesDim: 'sectorLabel', _mark: 'bar',  _byDims: 'sector,geo,time', _sortBy: 'value',       _sortDir: 'desc' },
  }

  // FF-DIRECTIONAL-TRUTH-TABLE — the ONE op:directional var (the six op:if derives,
  // retired — AR-42 P2) resolves the 4-state matrix end-to-end; a hand-edit to the
  // _directional spec that breaks a cell fails here.
  it('FF-DIRECTIONAL-TRUTH-TABLE: the ONE op:directional var resolves the A/B/C/D acceptance spine', () => {
    const spec = pageVar(regional.config, '_directional') as DirSpec | undefined
    expect(spec, 'the _directional var exists').toBeDefined()
    expect(spec!.op, 'the directional op').toBe('directional')
    for (const [s, dims] of Object.entries(STATES)) {
      const out = resolveDir(spec!, dims)
      for (const d of DERIVES) expect(out[d], `state ${s} · ${d}`).toBe(EXPECT[s][d])
    }
  })

  // FF-DIRECTIONAL-TRUTH-TABLE (robustness) — a leftover/stray sector='_T' must count as
  // UNSELECTED (the page-declared unselected sentinel set), never an active selection.
  it('FF-DIRECTIONAL-TRUTH-TABLE: sector="_T" is treated as unselected (sentinel-robust)', () => {
    const spec = pageVar(regional.config, '_directional') as DirSpec
    const out = resolveDir(spec, { region: '', sector: '_T' })
    for (const d of DERIVES) expect(out[d], `_T≡none · ${d}`).toBe(EXPECT.A[d])
  })

  // FF-SECTOR-COMPOUND-FILTER — the composition query narrows to the selected sector while
  // still excluding the _T aggregate: {$ne:_T, $ctx:sector}. Replicates the store wire rule
  // (buildObsFilterParam $ne+$ctx branch): sector='' → NO positive pin (fetch broad, exclude
  // _T client-side = all real sectors, State B); sector=X → positive pin X (States C/D).
  it('FF-SECTOR-COMPOUND-FILTER: composition sector clause is {$ne:_T,$ctx:sector} on both stores', () => {
    const sec = queryFilter(findById(regional.config, 'sectors'))?.sector as Json | undefined
    expect(sec?.$ne, 'excludes the _T total row').toBe('_T')
    expect(sec?.$ctx, 'narrows to the selected sector').toBe('sector')
    const wirePin = (dims: Record<string, string>) => {
      const v = dims[sec!.$ctx as string]
      return v !== undefined && v !== '' && v !== null ? v : undefined
    }
    expect(wirePin({ sector: '' }), 'State B: no positive pin → all real sectors').toBeUndefined()
    expect(wirePin({ sector: 'S1' }), 'State C/D: positive pin S1').toBe('S1')
  })

  // FF-DIM-SENTINEL-SYMMETRY — region and sector share the '' unselected sentinel; every
  // FILTER-position {$ctx:sector} ref is guarded — $ne:'_T' (query-path, the geo mirror) OR
  // default:'_T' (KPI-path aggregate pin) — never bare (which would wildcard+double-count the
  // _T total against its leaves), and the sector PARAM no longer defaults to '_T'.
  it('FF-DIM-SENTINEL-SYMMETRY: sector param defaults to "" and every filter sector ref is guarded', () => {
    // the sector param (select → multi-select, portal review batch) defaults to ''
    // (peer with region), not '_T'; label renamed სექტორი→დარგები with the switch
    const sectorParam = find(regional.config, (n) =>
      (n.type === 'select' || n.type === 'multi-select') &&
      typeof n.label === 'object' && /სექტორ|დარგ/.test(JSON.stringify(n.label)))
    expect(sectorParam?.default, 'sector param default flipped _T→""').toBe('')
    // filter-position sector refs only (value of a `sector:` slot) — excludes derive expr leaves
    const sectorRefs = findAll(regional.config, (n) =>
      typeof n.sector === 'object' && n.sector !== null && (n.sector as Json).$ctx === 'sector')
      .map((n) => n.sector as Json)
    expect(sectorRefs.length, 'filter-position $ctx:sector refs exist').toBeGreaterThan(0)
    for (const r of sectorRefs) {
      expect(r.$ne === '_T' || r.default === '_T',
        `sector ref guarded ($ne:_T | default:_T): ${JSON.stringify(r)}`).toBe(true)
    }
    // partition: query-path panels use the $ne:_T geo-mirror; KPIs keep the default:_T aggregate pin
    expect(sectorRefs.filter((r) => r.$ne === '_T').length,
      'query-path sector refs use $ne:_T (4 companions + composition)').toBeGreaterThanOrEqual(5)
    expect(sectorRefs.filter((r) => r.default === '_T').length,
      'KPI-path sector refs keep default:_T').toBeGreaterThanOrEqual(10)
  })

  // FF-SECTOR-DERIVE-AGNOSTIC — extends FF-PIVOT-AGNOSTIC: the directional relation is
  // ONE declared, dimension-blind op (its dims/params live in focus/co/priority as data,
  // no function/getRows/fn escape hatch), and the six hand-authored op:if derives are
  // RETIRED (the Strangler delete — special-case → declaration).
  it('FF-SECTOR-DERIVE-AGNOSTIC: the directional relation is ONE declared, dim-blind op (no code)', () => {
    const spec = pageVar(regional.config, '_directional') as DirSpec
    expect(spec, 'the _directional var exists').toBeDefined()
    expect(spec.focus).toBe('sector')
    expect(spec.co).toBe('geo')
    expect(spec.priority).toEqual(['sector', 'region'])
    const json = JSON.stringify(spec)
    expect(/getRows|=>|"fn"|function/.test(json), 'directional carries no function/fn escape').toBe(false)
    // the six hand-authored op:if derives are retired — the special-case is gone.
    for (const d of DERIVES)
      expect(pageVar(regional.config, d), `hand-authored derive ${d} retired`).toBeUndefined()
  })
})
