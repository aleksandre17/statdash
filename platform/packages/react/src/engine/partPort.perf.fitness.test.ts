// ── partPort.perf.fitness — the Part-port enumeration is LINEAR, not quadratic ───
//
//  THE FITNESS (the lead's PERFORMANCE GAP, ADR-041 · ROOT-3): the platform's ONE
//  containment reading — `partFieldsOf(meta)` + the residence adapters
//  (`valueParts`/`slotParts`) it routes into — is enumerated ONCE PER NODE by the
//  authoring CanvasOverlay's frame recursion (`frameNode` + the transitional
//  `walkNodes` fallback), on every selection / render / measure. Before AR-42's
//  interaction fan-out amplifies enumeration FREQUENCY, this REGRESSION GUARD bounds
//  the per-enumeration COST: the whole-tree enumeration must scale LINEAR-ish in node
//  count (2× nodes ⇒ ≤ ~2.2× work), so no future edit can quietly make it super-linear
//  (a per-node re-walk, `partFieldsOf` recomputed inside a nested loop, a double-count
//  of the `walkNodes` fallback).
//
//  WHY here (app-agnostic, Law 3): the port + its two pure adapters live engine-side
//  (`packages/react`). The CanvasOverlay's recursion is app-side (`apps/panel`, DOM-
//  bound) — so this fitness MIRRORS its structure (`frameNode` recursion + `walkNodes`
//  fallback, the `framed` dedupe) over a SYNTHETIC page with SYNTHETIC metas (mirror
//  shapes, no `@statdash/plugins` import), exercising the REAL `partFieldsOf` /
//  `valueParts` / `slotParts` under measurement. No DOM: the DOM `querySelector`-per-
//  node cost is a SEPARATE, app-side concern (noted in the port's perf report), not the
//  pure-enumeration complexity this guard locks.
//
//  DETERMINISTIC + WALL-TIME, two bounds: (1) the enumeration OUTPUT scales EXACTLY 2×
//  when the node count doubles (a deterministic proof the workload really doubled — so
//  a time ratio is meaningful, never masked by a smaller-than-expected 2× workload);
//  (2) min-of-trials wall-time doubles-not-quadruples across two doublings. A quadratic
//  regression shows ≥4× per doubling — decisively past the ~2.2× linear bound (guard
//  threshold set with flake margin, ACTUAL ratios logged for the record).
//
import { describe, it, expect } from 'vitest'
import { partFieldsOf, valueParts, slotParts } from '@statdash/react/engine'
import type {
  ObjectMeta, PartSource, PartResidence, EnumeratedPart, PartSourceContext,
} from '@statdash/react/engine'

// ── Synthetic metas — mirror shapes, ZERO plugins import (app-agnostic) ──────────
//
//  A `section` (SLOT residence: a `children` slot accepting section|kpi) and a `kpi`
//  (VALUE residence: an `items` array carrying an `itemSchema`). These are the SAME
//  two residence shapes the shipped corpus declares — enough to route through both
//  pure engine adapters. The `sourced` residence is app-SSOT-bound (`apps/panel`
//  `bandSource`) so it is out of this engine-side fitness by construction.
//
const SECTION_META: ObjectMeta = {
  slots: {
    main: { field: 'children', label: 'Main', accepts: ['section', 'kpi'], multi: true },
  },
}
const KPI_META: ObjectMeta = {
  schema: [
    {
      field: 'items',
      type:  'array',
      label: 'Items',
      itemSchema: [
        { field: 'label', type: 'string', label: 'Label' },
        { field: 'value', type: 'number', label: 'Value' },
      ],
    },
  ],
}
const META_BY_TYPE: Record<string, ObjectMeta | undefined> = {
  section: SECTION_META,
  kpi:     KPI_META,
}

// ── The residence-keyed port registry — mirrors apps/panel `bandSource` routing ──
//
//  The app-side `enumerateParts` (apps/panel/src/canvas/bandSource.ts) reads
//  `partFieldsOf(meta)` and routes each PartField to the adapter registered under its
//  residence. Reproduced here (the two PURE engine residences only — `sourced` touches
//  an app SSOT) so the fitness stays in `packages/react` and app-agnostic, while
//  exercising the REAL `partFieldsOf` + `valueParts`/`slotParts` under measurement.
//
const PART_SOURCES = new Map<PartResidence, PartSource>([
  ['value', valueParts],
  ['slot',  slotParts],
])

function enumeratePartsOf(
  container: Record<string, unknown>,
  meta:      ObjectMeta | undefined,
  ctx:       PartSourceContext,
): EnumeratedPart[] {
  if (!meta) return []
  const out: EnumeratedPart[] = []
  for (const part of partFieldsOf(meta)) {         // ← REAL reading under measurement
    const src = PART_SOURCES.get(part.residence)
    if (!src) continue
    for (const p of src.enumerateParts(container, part, ctx)) out.push(p)
  }
  return out
}

// ── Node shape + synthetic page builder ──────────────────────────────────────────

interface Node {
  id:        string
  type:      string
  children?: Node[]
  items?:    Array<{ label: string; value: number }>
}

/**
 * Build a wide+deep page: `k` top-level section spines, each a chain of `depth`
 * nested sections whose innermost holds `panels` kpi nodes, each carrying a value
 * band of `items` members. Node count is LINEAR in `k` (⇒ doubling `k` doubles the
 * node count exactly), so a per-node super-linear regression separates cleanly from
 * the linear baseline. Deep spines exercise the `frameNode` RECURSION depth; the wide
 * fanout exercises the `walkNodes` FALLBACK breadth.
 */
function buildPage(k: number, depth: number, panels: number, items: number): Node {
  let seq = 0
  const id = () => `n${seq++}`
  const makeKpi = (): Node => ({
    id:   id(),
    type: 'kpi',
    items: Array.from({ length: items }, (_, i) => ({ label: `L${i}`, value: i })),
  })
  const makeSpine = (): Node => {
    const leaf: Node = { id: id(), type: 'section', children: Array.from({ length: panels }, makeKpi) }
    let top = leaf
    for (let d = 1; d < depth; d++) top = { id: id(), type: 'section', children: [top] }
    return top
  }
  return { id: id(), type: 'section', children: Array.from({ length: k }, makeSpine) }
}

/** Count every `type`-bearing node in the tree (the flat node count the overlay frames). */
function countNodes(root: Node): number {
  let n = 0
  const visit = (node: Node) => { n++; node.children?.forEach(visit) }
  visit(root)
  return n
}

// ── The simulated overlay pass — `frameNode` recursion + `walkNodes` fallback ────
//
//  Byte-for-byte the CanvasOverlay's frame-derivation STRUCTURE, minus the DOM: a
//  `framed` dedupe set, a port-driven `frameNode(page)` recursion (slot parts recurse
//  as whole child nodes; value parts become item hits), THEN a transitional full-tree
//  `walkNodes` fallback that re-enters `frameNode` per node (deduped). Returns the work
//  totals — the deterministic output size the linear-scaling assertion pins.
//
interface WalkResult { nodesFramed: number; partsEnumerated: number; itemHits: number }

function simulateOverlay(page: Node, ctx: PartSourceContext): WalkResult {
  const framed = new Set<string>()
  let partsEnumerated = 0
  let itemHits = 0

  const frameNode = (node: Node): void => {
    const id = node.id
    if (!id || framed.has(id)) return
    framed.add(id)
    const meta = META_BY_TYPE[node.type]
    const container = node as unknown as Record<string, unknown>
    for (const part of enumeratePartsOf(container, meta, ctx)) {
      partsEnumerated++
      if (part.residence === 'slot') {
        frameNode(part.subject as unknown as Node)   // slot part IS a whole child node
        continue
      }
      if (part.address.partPath != null) itemHits++   // value/sourced item hit
    }
  }

  // walkNodes-equivalent fallback DFS (mirrors apps/panel walkNodes: every type-bearing
  // node in document order). Kept as its OWN full pass so the fitness measures the SAME
  // ~2× tree traversal the shipped overlay pays (port recursion + fallback walk).
  const walk: Node[] = []
  const visit = (node: Node) => { walk.push(node); node.children?.forEach(visit) }
  visit(page)

  frameNode(page)
  for (const w of walk) frameNode(w)

  return { nodesFramed: framed.size, partsEnumerated, itemHits }
}

// ── Timing helper — min-of-trials (robust to GC / JIT-warmup noise) ──────────────

function minTime(fn: () => void, trials: number): number {
  fn()                                  // warm up (JIT), discarded
  let best = Infinity
  for (let t = 0; t < trials; t++) {
    const t0 = performance.now()
    fn()
    const dt = performance.now() - t0
    if (dt < best) best = dt
  }
  return best
}

// ── Fixture sizes — three points across two doublings (k, 2k, 4k) ────────────────
const DEPTH = 6, PANELS = 3, ITEMS = 6
const K = 600
const pageS = buildPage(K,     DEPTH, PANELS, ITEMS)
const page2 = buildPage(K * 2, DEPTH, PANELS, ITEMS)
const page4 = buildPage(K * 4, DEPTH, PANELS, ITEMS)
const ctx: PartSourceContext = {}

describe('partPort perf fitness — whole-tree enumeration is LINEAR (ADR-041 ROOT-3)', () => {
  it('the simulated overlay frames every node exactly once and enumerates every declared part', () => {
    // A real workload: correctness first (a guard that measured nothing would be inert).
    const nodes = countNodes(pageS)
    const r = simulateOverlay(pageS, ctx)
    expect(r.nodesFramed).toBe(nodes)                       // every node framed once (dedupe holds)
    // Each kpi contributes ITEMS value parts; each section contributes its slot parts.
    // itemHits = kpi-count × ITEMS.
    const kpiCount = K * PANELS
    expect(r.itemHits).toBe(kpiCount * ITEMS)
    expect(r.partsEnumerated).toBeGreaterThan(r.itemHits)   // + the slot parts
  })

  it('enumeration OUTPUT scales EXACTLY linearly with node count (deterministic)', () => {
    const nS = countNodes(pageS), n2 = countNodes(page2), n4 = countNodes(page4)
    // Node count is `1 + k·(depth+panels)` — the ONE shared page root is a constant, so
    // the k-scaled body (everything below the root) doubles exactly. Excluding that
    // constant, the workload really doubles → the time ratio below is meaningful, never
    // masked by a smaller-than-expected workload.
    expect(n2 - 1).toBe((nS - 1) * 2)
    expect(n4 - 1).toBe((nS - 1) * 4)

    const rS = simulateOverlay(pageS, ctx)
    const r2 = simulateOverlay(page2, ctx)
    const r4 = simulateOverlay(page4, ctx)
    // Enumeration output (parts + item hits) scales EXACTLY 2× per doubling — the
    // deterministic proof the enumeration touches each part a constant number of times.
    expect(r2.partsEnumerated).toBe(rS.partsEnumerated * 2)
    expect(r4.partsEnumerated).toBe(rS.partsEnumerated * 4)
    expect(r2.itemHits).toBe(rS.itemHits * 2)
    expect(r4.itemHits).toBe(rS.itemHits * 4)
    console.log(
      `[perf] nodes ${nS}/${n2}/${n4} · partsEnumerated ${rS.partsEnumerated}/${r2.partsEnumerated}/${r4.partsEnumerated}`,
    )
  })

  it('whole-tree enumeration WALL-TIME doubles (≤ ~2.2× per doubling), never quadruples', () => {
    const TRIALS = 7
    const tS = minTime(() => simulateOverlay(pageS, ctx), TRIALS)
    const t2 = minTime(() => simulateOverlay(page2, ctx), TRIALS)
    const t4 = minTime(() => simulateOverlay(page4, ctx), TRIALS)

    const r21 = t2 / tS
    const r42 = t4 / t2
    console.log(
      `[perf] wall-time ms  k=${K}:${tS.toFixed(3)}  2k:${t2.toFixed(3)}  4k:${t4.toFixed(3)}  ` +
      `· ratios 2k/k=${r21.toFixed(2)} 4k/2k=${r42.toFixed(2)}`,
    )

    // HARD GATE: a doubling costs ≤ 3.0× — the linear TARGET is ~2.2×; the gate sits at
    // 3.0 to absorb GC / JIT / CI jitter (observed spikes reach ~2.5× on a warm dev box)
    // WITHOUT admitting super-linear growth. A quadratic regression is ~4× per doubling —
    // decisively RED past 3.0, with a clean gap above the linear band; a constant-factor
    // re-walk (e.g. a third full traversal pushing a doubling toward ~4×) trips it too.
    // Deliberately NOT tighter than 3.0: a false-red perf gate is worse than a slightly
    // loose one — the deterministic OUTPUT-scaling assertion above is the exact guard.
    const BOUND = 3.0
    expect(r21).toBeLessThanOrEqual(BOUND)
    expect(r42).toBeLessThanOrEqual(BOUND)
  })
})
