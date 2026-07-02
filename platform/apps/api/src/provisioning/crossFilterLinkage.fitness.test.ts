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
function queryFilter(node: Json | undefined): Json | undefined {
  return ((node?.data as Json | undefined)?.query as Json | undefined)?.filter as Json | undefined
}
interface FilterAction { type?: string; key?: string; fromField?: string; mode?: string; max?: number }
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

describe('regional cross-filter linkage web (committed provisioning)', () => {
  let regional: Page

  beforeAll(async () => {
    const artifact = JSON.parse(await readFile(ARTIFACT_PATH, 'utf8')) as Artifact
    const page = artifact.pages.find((p) => p.config.id === 'regional')
    expect(page, 'regional page present').toBeDefined()
    regional = page!
  })

  // FF-XF-REGION-TO-SECTOR — selecting a region re-scopes the sectoral-structure panels.
  // (`sectors` is now the State-A by-region donut — see FF-COMPOSITION-REPURPOSE — so it
  //  intentionally does NOT bind {$ctx:geo}; the sectoral panels that DO are these.)
  it('FF-XF-REGION-TO-SECTOR: the sectoral-structure + history panels bind {$ctx:geo}', () => {
    expect(ctxDim(queryFilter(findById(regional.config, 'sectors-multi')), 'geo')).toBe('geo')
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

  // FF-XF-SECTOR-EMIT — the newly authored links: the composition chart surfaces DRIVE a
  // sector selection (donut slice / stacked segment / area series → key=sector).
  it('FF-XF-SECTOR-EMIT: sectors-multi + sector-history charts emit key=sector on point:click', () => {
    expect(emitterFor(findById(regional.config, 'sectors-multi'),  'sector', 'point:click')).toBeDefined()
    expect(emitterFor(findById(regional.config, 'sector-history'), 'sector', 'point:click')).toBeDefined()
  })

  // FF-XF-SECTOR-EMIT reads the sector code — fromField must be the sector field, not the default key.
  it('FF-XF-SECTOR-EMIT: sector emitters read fromField=sector (the sector code, not the label)', () => {
    for (const id of ['sectors-multi', 'sector-history']) {
      const chart = emitterFor(findById(regional.config, id), 'sector', 'point:click')
      const action = handlers(chart).flatMap((h) => h.actions ?? []).find((a) => a.key === 'sector')
      expect(action?.fromField, `${id} emitter fromField`).toBe('sector')
    }
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
          expect(typeof a.key).toBe('string')
          expect(REGIONAL_DIMS.has(a.key ?? '')).toBe(true)
          if (a.mode !== undefined) expect(['replace', 'toggle', 'clear']).toContain(a.mode)
        }
      }
    }
  })

  // ── FF-COMPOSITION-REPURPOSE ────────────────────────────────────────────────
  //  The composition panel RE-PURPOSES by whether a region selection is active
  //  (`_regionSel` none/some, the 0-vs-1+ boundary — distinct from `_geoMode`'s
  //  0/1-vs-2+ comma threshold). State A (no region) = the `sectors` GDP-by-region
  //  DONUT (regions as slices, center = national total); State B (region[s]) = the
  //  `sectors-multi` sectoral-structure comparison. One authored swap, keyed on the
  //  raw `region` selection via the computed var.
  const sectionView = (id: string): Json | undefined =>
    (findById(regional.config, id)?.view as Json | undefined)?.visibleWhen as Json | undefined

  it('FF-COMPOSITION-REPURPOSE: by-region donut visibleWhen no selection; sectoral-structure visibleWhen region-selected', () => {
    // State A — the by-region donut shows only when NO region is selected.
    expect(sectionView('sectors')).toMatchObject({ op: 'eq', param: '_regionSel', is: 'none' })
    // State B — the sectoral-structure comparison shows only when region(s) selected.
    expect(sectionView('sectors-multi')).toMatchObject({ op: 'eq', param: '_regionSel', is: 'some' })
    // The State-A panel is genuinely a by-region DONUT: a donut chart encoding geo…
    const sectors = findById(regional.config, 'sectors')
    const donut = find(sectors, (n) => n.type === 'chart' && n.chartType === 'donut')
    expect(donut, 'sectors State-A panel is a donut').toBeDefined()
    expect(((sectors?.data as Json | undefined)?.encoding as Json | undefined)?.id, 'donut slices are regions (encoding id=geo)').toBe('geo')
    // …and clicking a slice DRIVES a region selection (the directional pin: region → sector view).
    expect(emitterFor(sectors, 'region', 'point:click'), 'by-region donut emits key=region').toBeDefined()
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
})
