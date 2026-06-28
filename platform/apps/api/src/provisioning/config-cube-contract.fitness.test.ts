// ── Fitness function — the config↔cube contract ──────────────────────────────
//
// The class of defect this gate exists to kill (GDP / REGIONAL / ACCOUNTS, all
// shipped under-pinned at one point): a page config that references DATA THAT
// DOES NOT EXIST, or that asks for a SINGLE VALUE without pinning every dimension
// of the cube. Under-pinning is silently wrong on a measure-aware store and
// catastrophically wrong on the live ApiStore — it reads whatever row the slice
// happens to return (carry-forward duplicates of an SNA balancing item, the wrong
// approach's GDP, the national total instead of one region). It renders; it is
// just wrong. This test makes that failure a BUILD failure, for ANY tenant/dataset.
//
// SOURCE OF TRUTH for the DSD = the canonical demo workbooks DATA/canonical/*.xlsx
// (the same SSOT the demo cube is generated from). We read, per dataset:
//   • dimensions      — STRUCTURE!dimensions  (comma list, `time` first)
//   • members per dim — the CL_<DIM> codelist sheet (the DSD's allowed codes)
// This is maintainable (the workbook is the data SSOT; codes can't drift from it)
// and NOT brittle (we validate against the codelist, the contract — never against
// the exact present-combos of DATA, which legitimately omit cells).
//
// The guard is GENERIC over datasets and dimensions (Law 1 — no privileged dims):
// it is hardcoded to nothing about gdp/geo/approach/account. A new dataset with a
// new dim is covered the moment it is declared in `dataSources[].config`.
//
// Needs no DATABASE_URL: reads the committed artifact + workbooks off disk.

import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
// xlsx is confined to the ingest ACL (ADR-0031 §5 / F-3) — we read workbooks through
// it, never `import xlsx` here. readWorkbook → sheet name → row-major Cell[][] matrix.
import { readWorkbook, type SheetMatrices, type Cell } from '../ingest/canonical/read-workbook.js'

const here = dirname(fileURLToPath(import.meta.url))
// src/provisioning → apps/api/provisioning/geostat.provisioning.json
const ARTIFACT_PATH = resolve(here, '../../provisioning/geostat.provisioning.json')
// src/provisioning → <repo>/DATA/canonical
const CANONICAL_DIR = resolve(here, '../../../../../DATA/canonical')

const TIME_DIM = 'time'

// ── Artifact types (structural — only the shape this guard walks) ─────────────
interface DataSourceEntry {
  name: string
  config: { datasetCode?: string; nonTimeDims?: string[] }
}
interface PageEntry { slug: string; config: PageConfig; status?: string }
interface PageConfig { id?: string; storeKey?: string; children?: unknown[] }
interface SiteConfigEntry { key: string; value: unknown }
/** Semantic-layer metric (the siteConfig 'metrics' blob — ManifestMetric wire shape). */
interface MetricEntry { id: string; code: string | string[]; dataSource?: string }
interface Artifact {
  pages: PageEntry[]
  dataSources?: DataSourceEntry[]
  siteConfig?: SiteConfigEntry[]
}

const MEASURE_DIM = 'measure'

/** Load the semantic-layer catalog (siteConfig 'metrics') as an id → MetricEntry map. */
function loadMetricCatalog(artifact: Artifact): Map<string, MetricEntry> {
  const entry = (artifact.siteConfig ?? []).find((s) => s.key === 'metrics')
  const list  = Array.isArray(entry?.value) ? (entry!.value as MetricEntry[]) : []
  return new Map(list.map((m) => [m.id, m]))
}

/**
 * Resolve a measure-dimension pin to its underlying DSD code(s) — the SAME
 * resolveMeasureRef contract, mirrored here so the DSD existence check sees the
 * REAL cube codes after the page migrated raw codes → metric-ids. A registered
 * metric-id expands to its `code`(s); a raw code (not a metric-id) passes through
 * unchanged (Postel / FF-RAW-CODE-IDENTICAL). Non-measure dims never pass here.
 */
function resolveMeasureCodes(value: string, catalog: Map<string, MetricEntry>): string[] {
  const metric = catalog.get(value)
  if (!metric) return [value]
  return Array.isArray(metric.code) ? metric.code : [metric.code]
}

// ── DSD derived from a canonical workbook ─────────────────────────────────────
interface Dsd {
  datasetCode: string
  nonTimeDims: string[]                  // declared in the artifact data source
  members: Record<string, Set<string>>  // dim → allowed codes (from CL_<DIM>)
}

/** Extract the `code` column out of a CL_<DIM> matrix (row 0 = headers). */
function codesFromSheet(matrix: SheetMatrices[string], sheetName: string): Set<string> {
  if (!matrix || matrix.length === 0) throw new Error(`${sheetName}: empty codelist sheet`)
  const header = matrix[0].map((c: Cell) => String(c ?? ''))
  const codeCol = header.indexOf('code')
  if (codeCol < 0) throw new Error(`${sheetName}: no 'code' column (headers: ${header.join(',')})`)
  const out = new Set<string>()
  for (let r = 1; r < matrix.length; r++) {
    const cell = matrix[r][codeCol]
    if (cell !== null && cell !== undefined && cell !== '') out.add(String(cell))
  }
  return out
}

/** Read every CL_<DIM> codelist out of one canonical workbook, via the ingest ACL. */
function loadDsd(datasetCode: string, nonTimeDims: string[]): Dsd {
  const sheets = readWorkbook(readFileSync(resolve(CANONICAL_DIR, `${datasetCode}.xlsx`)))
  const members: Record<string, Set<string>> = {}
  for (const dim of nonTimeDims) {
    const sheetName = `CL_${dim.toUpperCase()}`
    const matrix = sheets[sheetName]
    if (!matrix) throw new Error(`${datasetCode}: missing codelist sheet '${sheetName}' for dim '${dim}'`)
    members[dim] = codesFromSheet(matrix, `${datasetCode}!${sheetName}`)
  }
  return { datasetCode, nonTimeDims, members }
}

// ── Walk: collect every observation reference in a page (single-value + queries) ──
//
// `kind` distinguishes the two enforcement tiers:
//   'single'  → KPI value/trend/share-operand: MUST pin EVERY non-time dim.
//   'query'   → a section/panel DataSpec query: MAY fan out over dims (a breakdown
//               chart), so missing dims are allowed — but every PINNED code must
//               still exist in the DSD.
interface ObsSite {
  kind: 'single' | 'query'
  where: string            // human path for failure messages
  filter: Record<string, unknown>  // pinned dims (scalar codes only; ctx-refs/wildcards excluded)
  // dims explicitly present as a wildcard ('', '*', null) — pinned-but-open, not "missing"
  wildcardDims: Set<string>
  // dims bound to a ctx-ref ({$ctx}) — runtime-pinned, treated as satisfying the pin
  ctxDims: Set<string>
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

const isCtxRef = (v: unknown): boolean => isPlainObject(v) && '$ctx' in v
const isNeRef = (v: unknown): boolean => isPlainObject(v) && '$ne' in v
const isWildcard = (v: unknown): boolean => v === '' || v === null || v === '*'

/**
 * Classify a filter map into {pinned codes, wildcard dims, ctx-bound dims}.
 * A `$ne` exclusion (NeRef `{$ne}` / NeCtxRef `{$ctx,$ne}`) is NOT a concrete
 * pinned code — it removes a member from a fan-out (the rollup, per
 * FF-NO-ROLLUP-IN-COMPARISON). It binds no single code, so it is routed exactly
 * like a ctx/wildcard, never into `pinned` (else the code-existence check would
 * try to look up the literal `{$ne:…}` object as a member). A NeCtxRef also
 * carries `$ctx`, so it counts as ctx-bound (satisfies single-value pinning).
 */
function classifyFilter(filter: Record<string, unknown>): Pick<ObsSite, 'filter' | 'wildcardDims' | 'ctxDims'> {
  const pinned: Record<string, unknown> = {}
  const wildcardDims = new Set<string>()
  const ctxDims = new Set<string>()
  for (const [dim, val] of Object.entries(filter)) {
    if (dim === TIME_DIM) continue
    if (isCtxRef(val)) { ctxDims.add(dim); continue }   // covers NeCtxRef ({$ctx,$ne}) too
    if (isNeRef(val)) { wildcardDims.add(dim); continue } // {$ne} alone — fan-out minus rollup, no concrete pin
    if (isWildcard(val)) { wildcardDims.add(dim); continue }
    // Array = multi-value SDMX key selection (OR within dim) — each member is a code.
    pinned[dim] = val
  }
  return { filter: pinned, wildcardDims, ctxDims }
}

/**
 * A KPI value/trend/ObsRef carries `measure` + optional `filter` + optional `time`.
 * The spec's own `measure` field IS the pin on the `measure` dimension (the resolver
 * reads it as `ctx.dims.measure`), so we fold it into the pinned filter — it is not a
 * separate, optional thing the author must also list under `filter`.
 */
function obsFromSpec(spec: Record<string, unknown>, where: string): ObsSite | null {
  if (typeof spec.measure !== 'string') return null  // static trend / share have no top-level measure
  const filterRaw = isPlainObject(spec.filter) ? { ...spec.filter } : {}
  if (filterRaw.measure === undefined) filterRaw.measure = spec.measure
  return { kind: 'single', where, ...classifyFilter(filterRaw) }
}

/** Recursively collect every ObsSite reachable in a page config subtree. */
function collectObsSites(node: unknown, path: string, out: ObsSite[]): void {
  if (Array.isArray(node)) {
    node.forEach((n, i) => collectObsSites(n, `${path}[${i}]`, out))
    return
  }
  if (!isPlainObject(node)) return

  // ── KPI strip — each item carries value (single) + optional trend (single) ──
  if (node.type === 'kpi-strip' && Array.isArray(node.items)) {
    for (const item of node.items as Record<string, unknown>[]) {
      const id = String(item.id ?? '?')
      const value = item.value
      if (isPlainObject(value)) {
        if (value.type === 'share') {
          // share → two ObsRef operands (num, denom), each pins independently.
          for (const k of ['num', 'denom'] as const) {
            const ref = value[k]
            if (isPlainObject(ref)) {
              const o = obsFromSpec(ref, `kpi '${id}'.value.${k}`)
              if (o) out.push(o)
            }
          }
        } else {
          const o = obsFromSpec(value, `kpi '${id}'.value`)
          if (o) out.push(o)
        }
      }
      const trend = item.trend
      // static trends carry no measure → obsFromSpec returns null, correctly skipped.
      if (isPlainObject(trend)) {
        const o = obsFromSpec(trend, `kpi '${id}'.trend`)
        if (o) out.push(o)
      }
    }
  }

  // ── DataSpec query — section/panel data binding (fan-out tier) ──────────────
  if (node.type === 'query' && isPlainObject(node.query)) {
    const q = node.query as Record<string, unknown>
    const filterRaw = isPlainObject(q.filter) ? { ...q.filter } : {}
    // `query.measure` is a reference to the `measure` dim (string code | code[] | '*').
    // Fold it into the filter so its codes get the same existence check. '*' = wildcard.
    if (q.measure !== undefined && filterRaw.measure === undefined && q.measure !== '*') {
      filterRaw.measure = q.measure
    }
    const c = classifyFilter(filterRaw)
    out.push({ kind: 'query', where: `${path}.query`, ...c })
  }

  // Recurse into every child value (children, columns, data, items, …).
  for (const [k, v] of Object.entries(node)) collectObsSites(v, `${path}.${k}`, out)
}

// ── The suite ─────────────────────────────────────────────────────────────────

describe('config↔cube contract (every page DataSpec references data that exists, pinned)', () => {
  let artifact: Artifact
  let dsdByDataset: Map<string, Dsd>
  let pageDataset: Map<string, Dsd>  // page slug → DSD it binds to
  let metricCatalog: Map<string, MetricEntry>

  beforeAll(() => {
    artifact = JSON.parse(readFileSync(ARTIFACT_PATH, 'utf8')) as Artifact
    metricCatalog = loadMetricCatalog(artifact)

    // Build a DSD per declared data source, off the canonical workbook.
    dsdByDataset = new Map()
    for (const ds of artifact.dataSources ?? []) {
      const code = ds.config.datasetCode
      const dims = ds.config.nonTimeDims
      if (typeof code !== 'string' || !Array.isArray(dims)) continue
      dsdByDataset.set(ds.name, loadDsd(code, dims))
    }

    // Bind each page to its store (storeKey === dataSource.name, 1:1 here).
    pageDataset = new Map()
    for (const page of artifact.pages) {
      const key = page.config.storeKey
      if (typeof key !== 'string') continue          // container/landing pages bind no store
      const dsd = dsdByDataset.get(key)
      if (dsd) pageDataset.set(page.slug, dsd)
    }
  })

  it('every store-bound page maps to a DSD derived from a canonical workbook', () => {
    const bound = artifact.pages.filter((p) => typeof p.config.storeKey === 'string')
    expect(bound.length).toBeGreaterThan(0)
    for (const page of bound) {
      expect(pageDataset.has(page.slug)).toBe(true)
    }
  })

  // CHECK 2 (code existence) — applies to EVERY pinned code, both tiers.
  it('every pinned dimension code exists in that dataset’s codelist (no dangling reference)', () => {
    const violations: string[] = []
    for (const page of artifact.pages) {
      const dsd = pageDataset.get(page.slug)
      if (!dsd) continue
      const sites: ObsSite[] = []
      collectObsSites(page.config.children, `page '${page.slug}'`, sites)
      for (const site of sites) {
        for (const [dim, val] of Object.entries(site.filter)) {
          // A pin to a dim that isn't even a dimension of this cube is itself a defect.
          if (!dsd.nonTimeDims.includes(dim)) {
            violations.push(`${page.slug} · ${site.where}: pins unknown dimension '${dim}' (not in ${dsd.datasetCode} DSD)`)
            continue
          }
          const rawCodes = Array.isArray(val) ? val.map(String) : [String(val)]
          // On the `measure` dim, a pin MAY be a metric-id (post-migration): resolve
          // it through the catalog to its underlying DSD code(s) before the existence
          // check (mirrors the engine's resolveMeasureRef). Other dims pass through.
          const codes = dim === MEASURE_DIM
            ? rawCodes.flatMap((c) => resolveMeasureCodes(c, metricCatalog))
            : rawCodes
          for (const code of codes) {
            if (!dsd.members[dim].has(code)) {
              violations.push(`${page.slug} · ${site.where}: '${dim}=${code}' absent from CL_${dim.toUpperCase()} of ${dsd.datasetCode}`)
            }
          }
        }
      }
    }
    expect(violations, `dangling code references:\n${violations.join('\n')}`).toEqual([])
  })

  // CHECK 1 (pinning) — single-value contexts MUST pin every non-time dim.
  it('every single-value KPI pins every non-time dimension (no under-pinning)', () => {
    const violations: string[] = []
    for (const page of artifact.pages) {
      const dsd = pageDataset.get(page.slug)
      if (!dsd) continue
      const sites: ObsSite[] = []
      collectObsSites(page.config.children, `page '${page.slug}'`, sites)
      for (const site of sites) {
        if (site.kind !== 'single') continue   // 'query' tier may fan out (breakdown charts)
        for (const dim of dsd.nonTimeDims) {
          const pinned   = dim in site.filter
          const viaCtx   = site.ctxDims.has(dim)        // runtime-pinned from filter bar
          const wildcard = site.wildcardDims.has(dim)   // explicitly opened — a no-no for single-value
          if (wildcard) {
            violations.push(`${page.slug} · ${site.where}: dimension '${dim}' is wildcard-open in a single-value KPI (reads an arbitrary row)`)
          } else if (!pinned && !viaCtx) {
            violations.push(`${page.slug} · ${site.where}: dimension '${dim}' is under-pinned (single-value KPI must pin it to one code)`)
          }
        }
      }
    }
    expect(violations, `under-pinned single-value KPIs:\n${violations.join('\n')}`).toEqual([])
  })

  // CHECK 3 (metric.code ∈ DSD) — the semantic-layer contract: every metric in the
  // delivered catalog (siteConfig 'metrics') resolves to a measure code that EXISTS
  // in the CL_MEASURE of the dataset its `dataSource` names. A metric whose code is
  // not in its dataset's DSD is a dangling semantic definition — it would resolve a
  // referencing DataSpec to data that does not exist (the exact class CHECK 2 kills,
  // one layer up). Generic over datasets (Law 1).
  it('every catalog metric.code exists in its dataSource’s dataset DSD', () => {
    expect(metricCatalog.size, 'expected a non-empty semantic-layer catalog').toBeGreaterThan(0)
    const violations: string[] = []
    for (const metric of metricCatalog.values()) {
      const store = metric.dataSource
      if (typeof store !== 'string') {
        violations.push(`metric '${metric.id}': no dataSource (cannot bind to a dataset DSD)`)
        continue
      }
      const dsd = dsdByDataset.get(store)
      if (!dsd) {
        violations.push(`metric '${metric.id}': dataSource '${store}' is not a declared data source`)
        continue
      }
      const members = dsd.members[MEASURE_DIM]
      if (!members) {
        violations.push(`metric '${metric.id}': dataset ${dsd.datasetCode} has no CL_MEASURE codelist`)
        continue
      }
      const codes = Array.isArray(metric.code) ? metric.code : [metric.code]
      for (const code of codes) {
        if (!members.has(code)) {
          violations.push(`metric '${metric.id}': code '${code}' absent from CL_MEASURE of ${dsd.datasetCode} (dataSource '${store}')`)
        }
      }
    }
    expect(violations, `dangling metric definitions:\n${violations.join('\n')}`).toEqual([])
  })
})
