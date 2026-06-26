// ── Fitness function — FF-NO-ROLLUP-IN-COMPARISON ────────────────────────────
//
// The class of defect this gate exists to kill (REGIONAL GAP 2, shipped): a
// per-MEMBER comparison/breakdown panel (a `query` DataSpec that FANS OUT over a
// dimension — a regional bar chart, a sectoral donut, a choropleth) that does NOT
// exclude that dimension's ROLLUP member. The cube carries the rollup row
// alongside the members (geo `_T` = national total next to the regions; sector
// `_T` = "all activities" next to the sectors; approach `_Z`). When the fan-out
// dim is left unpinned, the read returns ALL members INCLUDING the rollup, and the
// `aggregate by:[dim]` then surfaces `_T` as just another "member" — a single bar
// that IS the sum of the others, a donut slice that doubles the total, a map bound
// to the rollup instead of the regions. It renders; it is silently, catastrophically
// wrong (and on the live ApiStore the rollup, being the largest value, dominates).
// This test makes that failure a BUILD failure, for ANY tenant/dataset/dimension.
//
// THE INVARIANT (Law 1 — generic, no privileged dims):
//   A `query` that AGGREGATES (fans out) over a cube dim D, where D has a ROLLUP
//   member in its codelist, MUST in its query.filter either
//     (a) exclude every rollup member of D via `$ne`  (NeRef / NeCtxRef), or
//     (b) pin D to a concrete NON-rollup scalar / array (a fixed member list).
//   A bare `{$ctx}` ref does NOT satisfy this — a ctx dim can resolve to ''
//   (wildcard) and then the fan includes the rollup again. The rollup must be
//   excluded structurally, in the config, not left to a runtime param value.
//
// ROLLUP DETECTION (SSOT = the canonical codelists, same as the config↔cube guard):
//   An SDMX-style special code is `_`-prefixed (`_T` total, `_Z` not-applicable);
//   real members never are. So D "has a rollup" ⇔ CL_<D> contains a `_`-prefixed
//   code. Hardcoded to NOTHING about geo/sector/approach (a new dataset/dim with a
//   `_`-rollup is covered the moment it is declared in `dataSources[].config`).
//
// Sibling of `config-cube-contract.fitness.test.ts`; reads the same committed
// artifact + canonical workbooks off disk (no DATABASE_URL).

import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
// xlsx is confined to the ingest ACL (ADR-0031 §5 / F-3) — read workbooks through it.
import { readWorkbook, type SheetMatrices, type Cell } from '../ingest/canonical/read-workbook.js'

const here = dirname(fileURLToPath(import.meta.url))
const ARTIFACT_PATH = resolve(here, '../../provisioning/geostat.provisioning.json')
const CANONICAL_DIR = resolve(here, '../../../../../DATA/canonical')

const TIME_DIM = 'time'
/** An SDMX-style special/rollup code is `_`-prefixed (`_T`, `_Z`); real members are not. */
const isRollupCode = (code: string): boolean => code.startsWith('_')

// ── Artifact types (structural — only the shape this guard walks) ─────────────
interface DataSourceEntry { name: string; config: { datasetCode?: string; nonTimeDims?: string[] } }
interface PageEntry { slug: string; config: PageConfig }
interface PageConfig { storeKey?: string; children?: unknown[] }
interface Artifact { pages: PageEntry[]; dataSources?: DataSourceEntry[] }

// ── DSD derived from a canonical workbook: which dims have a rollup member ─────
interface Dsd {
  datasetCode: string
  nonTimeDims: string[]
  rollups: Record<string, Set<string>>  // dim → its rollup (`_`-prefixed) codes
}

function codesFromSheet(matrix: SheetMatrices[string], sheetName: string): string[] {
  if (!matrix || matrix.length === 0) throw new Error(`${sheetName}: empty codelist sheet`)
  const header = matrix[0].map((c: Cell) => String(c ?? ''))
  const codeCol = header.indexOf('code')
  if (codeCol < 0) throw new Error(`${sheetName}: no 'code' column`)
  const out: string[] = []
  for (let r = 1; r < matrix.length; r++) {
    const cell = matrix[r][codeCol]
    if (cell !== null && cell !== undefined && cell !== '') out.push(String(cell))
  }
  return out
}

function loadDsd(datasetCode: string, nonTimeDims: string[]): Dsd {
  const sheets = readWorkbook(readFileSync(resolve(CANONICAL_DIR, `${datasetCode}.xlsx`)))
  const rollups: Record<string, Set<string>> = {}
  for (const dim of nonTimeDims) {
    const sheetName = `CL_${dim.toUpperCase()}`
    const matrix = sheets[sheetName]
    if (!matrix) throw new Error(`${datasetCode}: missing codelist sheet '${sheetName}' for dim '${dim}'`)
    rollups[dim] = new Set(codesFromSheet(matrix, `${datasetCode}!${sheetName}`).filter(isRollupCode))
  }
  return { datasetCode, nonTimeDims, rollups }
}

// ── Filter-value classification (mirrors the runtime resolver / store-filter) ──
const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/** Rollup members this filter value EXCLUDES via `$ne` (NeRef or NeCtxRef). */
function excludedRollups(fv: unknown): Set<string> {
  if (isPlainObject(fv) && '$ne' in fv) {
    const ne = fv.$ne
    const list = Array.isArray(ne) ? ne.map(String) : [String(ne)]
    return new Set(list.filter(isRollupCode))
  }
  return new Set()
}

/** A concrete scalar / array pin (NOT a ctx-ref, NOT a wildcard, NOT a `$ne`). */
function pinnedMembers(fv: unknown): string[] | null {
  if (typeof fv === 'string') return fv === '' || fv === '*' ? null : [fv]
  if (typeof fv === 'number') return [String(fv)]
  if (Array.isArray(fv)) return fv.map(String)
  return null  // {$ctx} (may be empty → wildcard) / {$ne} / null all fail to pin concretely
}

// ── A fan-out query site: the dims it aggregates over + how its filter treats them ──
interface FanSite {
  where: string
  fannedDims: Set<string>                  // dims in an aggregate `by`
  filter: Record<string, unknown>          // raw query.filter
}

/** Collect the dims a query's pipe fans out over (aggregate `by` is the canonical signal). */
function fannedDimsOf(pipe: unknown): Set<string> {
  const out = new Set<string>()
  if (!Array.isArray(pipe)) return out
  for (const step of pipe) {
    if (isPlainObject(step) && step.op === 'aggregate' && Array.isArray(step.by)) {
      for (const d of step.by) if (typeof d === 'string') out.add(d)
    }
  }
  return out
}

/** Recursively collect every fan-out `query` site in a page subtree. */
function collectFanSites(node: unknown, path: string, out: FanSite[]): void {
  if (Array.isArray(node)) { node.forEach((n, i) => collectFanSites(n, `${path}[${i}]`, out)); return }
  if (!isPlainObject(node)) return

  if (node.type === 'query' && isPlainObject(node.query)) {
    const q = node.query as Record<string, unknown>
    const fannedDims = fannedDimsOf(node.pipe)
    fannedDims.delete(TIME_DIM)  // time is never a rollup-member dim here
    if (fannedDims.size > 0) {
      const filter = isPlainObject(q.filter) ? q.filter : {}
      out.push({ where: `${path}.query`, fannedDims, filter })
    }
  }

  for (const [k, v] of Object.entries(node)) collectFanSites(v, `${path}.${k}`, out)
}

// ── The suite ─────────────────────────────────────────────────────────────────
describe('FF-NO-ROLLUP-IN-COMPARISON (a fan-out query must exclude the rollup of every dim it fans over)', () => {
  let artifact: Artifact
  let pageDataset: Map<string, Dsd>

  beforeAll(() => {
    artifact = JSON.parse(readFileSync(ARTIFACT_PATH, 'utf8')) as Artifact
    const dsdByDataset = new Map<string, Dsd>()
    for (const ds of artifact.dataSources ?? []) {
      const code = ds.config.datasetCode
      const dims = ds.config.nonTimeDims
      if (typeof code !== 'string' || !Array.isArray(dims)) continue
      dsdByDataset.set(ds.name, loadDsd(code, dims))
    }
    pageDataset = new Map()
    for (const page of artifact.pages) {
      const key = page.config.storeKey
      if (typeof key !== 'string') continue
      const dsd = dsdByDataset.get(key)
      if (dsd) pageDataset.set(page.slug, dsd)
    }
  })

  // Sanity: the guard is actually exercising real fan-out sites (else it is vacuous).
  it('finds fan-out query sites to check (guard is not vacuous)', () => {
    let total = 0
    for (const page of artifact.pages) {
      if (!pageDataset.has(page.slug)) continue
      const sites: FanSite[] = []
      collectFanSites(page.config.children, page.slug, sites)
      total += sites.length
    }
    expect(total).toBeGreaterThan(0)
  })

  it('every dim a query fans over has its rollup excluded ($ne) or is pinned to non-rollup members', () => {
    const violations: string[] = []
    for (const page of artifact.pages) {
      const dsd = pageDataset.get(page.slug)
      if (!dsd) continue
      const sites: FanSite[] = []
      collectFanSites(page.config.children, `page '${page.slug}'`, sites)

      for (const site of sites) {
        for (const dim of site.fannedDims) {
          const rollups = dsd.rollups[dim]
          if (!rollups || rollups.size === 0) continue   // dim has no rollup → nothing to pollute

          const fv = site.filter[dim]
          const excluded = excludedRollups(fv)
          const pinned   = pinnedMembers(fv)

          // (b) pinned to a concrete member list that contains NO rollup → safe.
          if (pinned && pinned.every((m) => !isRollupCode(m))) continue

          // (a) every rollup member of this dim is $ne-excluded → safe.
          const unexcluded = [...rollups].filter((r) => !excluded.has(r))
          if (unexcluded.length === 0) continue

          violations.push(
            `${site.where}: fans over '${dim}' but does not exclude rollup ${JSON.stringify(unexcluded)} ` +
            `(add ${dim}:{"$ne":"${unexcluded[0]}"} or pin '${dim}' to explicit members) ` +
            `[${dsd.datasetCode}]`,
          )
        }
      }
    }
    expect(violations, `rollup-in-comparison defects:\n${violations.join('\n')}`).toEqual([])
  })
})
