// ── FF-DATA-BOUNDED — every author-plane single-value binding names a GOVERNED noun ──
//
//  AR-52 W2 (Canon C1 "data first, always" — "a number on any surface traces to a
//  governed handle"). This is the BITING half of the Strangler's second act (STUDY §F3):
//  the corpus was migrated off raw SDMX coordinate codes (`"measure": "B5G"`) onto
//  governed metric handles (`"measure": "accounts.gni"`), and THIS gate keeps it that
//  way. It fails the build the moment a page's single-value author binding names a raw
//  cube code instead of a catalog metric-id — the exact regression that let D5 stall at
//  "mechanism shipped, adoption pending".
//
//  ── The plane boundary this gate encodes (Law 11 · C3 "projection with a plane") ────
//  It scans the AUTHOR plane only: the single-value KPI bindings (value / trend / share
//  operands) an author reaches through the governed noun picker. It deliberately does
//  NOT touch:
//    • the SEMANTIC catalog (siteConfig 'metrics') — that is where codes are DEFINED
//      (steward plane); a metric's own `code` / calc-input coordinates are raw by design.
//    • fan-out `type:'query'` DataSpecs — a breakdown chart / computed-column pipeline
//      is a steward-plane data instrument (raw coordinate editors demote to the steward
//      plane, per the W2 outcome), and some carry raw-code filter exprs by necessity
//      (`measure == 'P1'` matches the RESOLVED cube row, not a handle).
//  So "author-plane raw-source configs" == the single-value bindings scanned here; the
//  DoD's "corpus scan: 0 author-plane raw-source configs" is exactly this suite green.
//
//  Coordinate PARITY of the migration (a governed id resolves to the SAME DSD code the
//  raw code did) is proved separately by config-cube-contract.fitness (resolveMeasureRef
//  mirror) + packages/core bind-parity. This gate proves ADOPTION, not resolution.
//
//  Needs no DATABASE_URL: reads the committed provisioning artifact off disk.

import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const ARTIFACT_PATH = resolve(here, '../../provisioning/geostat.provisioning.json')

interface PageEntry { slug: string; config: { children?: unknown[] } }
interface SiteConfigEntry { key: string; value: unknown }
interface MetricEntry { id: string }
interface Artifact { pages: PageEntry[]; siteConfig?: SiteConfigEntry[] }

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/** The set of governed metric-ids the delivered catalog declares (the author's nouns). */
function loadCatalogIds(artifact: Artifact): Set<string> {
  const entry = (artifact.siteConfig ?? []).find((s) => s.key === 'metrics')
  const list  = Array.isArray(entry?.value) ? (entry!.value as MetricEntry[]) : []
  return new Set(list.map((m) => m.id))
}

/** One author-plane single-value measure pin found in a page (for the failure message). */
interface Pin { where: string; measure: string }

/**
 * Collect the SINGLE-VALUE author measure pins under a KPI strip item spec — the
 * value/trend (point/yoy/cagr) and both share operands (num/denom). These are the
 * bindings an author makes through the governed noun picker; each MUST be a metric-id.
 * A missing / non-string / share-wrapper `measure` is skipped (no scalar pin there).
 */
function pinsFromKpiSpec(spec: unknown, where: string, out: Pin[]): void {
  if (!isPlainObject(spec)) return
  if (spec.type === 'share') {
    pinsFromKpiSpec(spec.num, `${where}.num`, out)
    pinsFromKpiSpec(spec.denom, `${where}.denom`, out)
    return
  }
  if (typeof spec.measure === 'string') out.push({ where, measure: spec.measure })
}

/**
 * Walk a page subtree, collecting author-plane single-value measure pins. Recursion
 * STOPS at any `type:'query'` node — a fan-out DataSpec is a steward-plane data
 * instrument, out of the author-plane scan (its raw-code filters/exprs are by design).
 */
function collectAuthorPins(node: unknown, path: string, out: Pin[]): void {
  if (Array.isArray(node)) {
    node.forEach((n, i) => collectAuthorPins(n, `${path}[${i}]`, out))
    return
  }
  if (!isPlainObject(node)) return
  if (node.type === 'query') return  // steward-plane fan-out DataSpec — not author-plane

  if (node.type === 'kpi-strip' && Array.isArray(node.items)) {
    for (const item of node.items as Record<string, unknown>[]) {
      const id = String(item.id ?? '?')
      pinsFromKpiSpec(item.value, `${path} · kpi '${id}'.value`, out)
      pinsFromKpiSpec(item.trend, `${path} · kpi '${id}'.trend`, out)
    }
  }
  for (const [k, v] of Object.entries(node)) collectAuthorPins(v, `${path}.${k}`, out)
}

describe('FF-DATA-BOUNDED — every author-plane single-value binding names a governed metric-id', () => {
  let artifact: Artifact
  let catalogIds: Set<string>

  beforeAll(() => {
    artifact = JSON.parse(readFileSync(ARTIFACT_PATH, 'utf8')) as Artifact
    catalogIds = loadCatalogIds(artifact)
  })

  it('the delivered catalog exposes governed nouns (the gate has something to bind against)', () => {
    expect(catalogIds.size).toBeGreaterThan(0)
  })

  it('the scan actually reaches author bindings (the guard is running, not vacuous)', () => {
    const pins: Pin[] = []
    for (const page of artifact.pages) collectAuthorPins(page.config.children, `page '${page.slug}'`, pins)
    // The corpus has many KPI strips across the SNA / regional pages — a real, non-empty
    // author surface. If this ever drops to zero the walker has silently stopped matching.
    expect(pins.length).toBeGreaterThan(10)
  })

  it('NO author-plane single-value binding names a raw cube code (all resolve to catalog ids)', () => {
    const violations: string[] = []
    for (const page of artifact.pages) {
      const pins: Pin[] = []
      collectAuthorPins(page.config.children, `page '${page.slug}'`, pins)
      for (const pin of pins) {
        if (!catalogIds.has(pin.measure)) {
          violations.push(`${pin.where}: measure '${pin.measure}' is not a governed metric-id (raw source binding)`)
        }
      }
    }
    expect(violations, `ungoverned author bindings (migrate these onto metric handles):\n${violations.join('\n')}`).toEqual([])
  })

  it('the guard bites — a planted raw code IS detected', () => {
    // A synthetic page whose KPI binds a raw SDMX code must be caught by the same walker.
    const planted: PageEntry = {
      slug: 'planted',
      config: { children: [{ type: 'kpi-strip', items: [{ id: 'x', value: { type: 'point', measure: 'B5G' } }] }] },
    }
    const pins: Pin[] = []
    collectAuthorPins(planted.config.children, `page '${planted.slug}'`, pins)
    const offenders = pins.filter((p) => !catalogIds.has(p.measure))
    expect(offenders.map((o) => o.measure)).toEqual(['B5G'])
  })
})
