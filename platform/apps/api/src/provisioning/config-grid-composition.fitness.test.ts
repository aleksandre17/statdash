// ── FF-GRID-COMPOSITION (AR-5) — sections harness the maximal grid, not a weak ─
//   count-ladder; and the `wrap` nodes remain load-bearing distributed-style.
//
// The owner's AR-5 charge: the section groups were composed with the WEAKEST
// primitives — `columns` count-ladders (a discrete 2→1 step) and 0× `grid`, so
// the full power of CSS Grid was unused. The elevation:
//
//   • Every SIDE-BY-SIDE section group is now a `grid` with a real
//     `templateColumns` (intrinsic `repeat(auto-fit, minmax(min(100%,…), 1fr))`),
//     which reflows CONTINUOUSLY by container width — strictly more capable than a
//     `columns` count:2 hard step. So NO layout container may carry `count >= 2`.
//   • Every `grid` used for composition actually EXERCISES the grid capability
//     (carries templateColumns / columns) — no empty grids (metric-gaming guard).
//   • The 6 `wrap` nodes are KEPT (Chesterton's fence): each distributes a
//     responsive `aspectRatio` to a chart↔table TOGGLE (the FILL-vbar band, locked
//     by packages/styles panel-sizing.fitness.test.ts). They are distributed-STYLE
//     nodes, NOT lazy layout — replacing them with grid would break the toggle and
//     regress the verified definite-height. This gate forbids a `wrap` from losing
//     its aspectRatio (which would make it a genuinely pointless node).
//
// The remaining `columns count:1` on the accounts page are DELIBERATE full-width
// single-column stacking (one wraps a `repeat` that fans out to many sections —
// auto-fit would tile them). That is the correct primitive there and is NOT a
// regression; this gate targets side-by-side groups (count >= 2) only.
//
// No DATABASE_URL — reads the committed artifact off disk (sibling of the other
// provisioning fitness suites).

import { describe, it, expect, beforeAll } from 'vitest'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const ARTIFACT_PATH = resolve(here, '../../provisioning/geostat.provisioning.json')

interface NodeLike { type?: unknown; count?: unknown; templateColumns?: unknown; columns?: unknown; styles?: unknown; children?: unknown }
interface Artifact { pages: Array<{ config: NodeLike }> }

const asNode = (v: unknown): NodeLike => (v && typeof v === 'object' ? (v as NodeLike) : {})
const childrenOf = (n: NodeLike): NodeLike[] => (Array.isArray(n.children) ? n.children.map(asNode) : [])

function walk(node: NodeLike, visit: (n: NodeLike) => void): void {
  visit(node)
  for (const c of childrenOf(node)) walk(c, visit)
}

describe('FF-GRID-COMPOSITION (AR-5) — maximal grid, no weak count-ladder', () => {
  const grids: NodeLike[] = []
  const columnsNodes: NodeLike[] = []
  const wraps: NodeLike[] = []

  beforeAll(async () => {
    const artifact = JSON.parse(await readFile(ARTIFACT_PATH, 'utf8')) as Artifact
    for (const page of artifact.pages) {
      walk(asNode(page.config), (n) => {
        if (n.type === 'grid')    grids.push(n)
        if (n.type === 'columns') columnsNodes.push(n)
        if (n.type === 'wrap')    wraps.push(n)
      })
    }
  })

  it('the section groups actually adopt the grid primitive (non-vacuous)', () => {
    expect(grids.length).toBeGreaterThanOrEqual(8)
  })

  it('NO layout container uses a count-ladder of 2+ — side-by-side groups are grids', () => {
    const countOf = (n: NodeLike): number | undefined => {
      const c = n.count
      if (typeof c === 'number') return c
      if (c && typeof c === 'object') {
        const d = (c as { default?: unknown }).default
        return typeof d === 'number' ? d : undefined
      }
      return undefined
    }
    const offenders = [...grids, ...columnsNodes]
      .map(countOf)
      .filter((c): c is number => c !== undefined && c >= 2)
    expect(offenders, 'a side-by-side group must be a `grid` with templateColumns, never a `columns` count>=2 hard step').toEqual([])
  })

  it('every composition grid EXERCISES the grid capability (no empty/metric-gaming grid)', () => {
    const empty = grids.filter((g) => g.templateColumns === undefined && g.columns === undefined)
    expect(empty.length, 'every grid must carry templateColumns (or the columns shorthand) — an empty grid is a renamed div').toBe(0)
  })

  it('at least one grid uses the intrinsic auto-fit reflow (the container-driven headline)', () => {
    const autoFit = grids.filter((g) => typeof g.templateColumns === 'string' && /auto-fit|auto-fill/.test(g.templateColumns))
    expect(autoFit.length).toBeGreaterThanOrEqual(4)
  })

  it('the `wrap` nodes stay load-bearing distributed-style (aspectRatio → toggle band)', () => {
    // Chesterton's fence: a wrap without a distributed style IS a pointless node.
    // Every wrap here carries aspectRatio (the FILL-vbar band for the chart↔table toggle).
    expect(wraps.length).toBeGreaterThan(0)
    const stripped = wraps.filter((w) => {
      const s = asNode(w.styles)
      return (s as { aspectRatio?: unknown }).aspectRatio === undefined
    })
    expect(stripped.length, 'a `wrap` must distribute a style (here aspectRatio); an empty wrap should be deleted, not kept').toBe(0)
  })
})
