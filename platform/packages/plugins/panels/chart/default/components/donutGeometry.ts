// ── donutGeometry — donut label-placement engine (pure, no React) ──────
//
//  Split out of DonutChart (one-concern-per-file). All geometry/layout math +
//  the slice/label types + the build() entry live here; the component file is
//  the SVG view. The single design-token touch is the slice fallback color,
//  resolved via cssVar (var() is invalid in the SVG fill it feeds).
//
//  LABEL LAYOUT — non-crossing BY CONSTRUCTION (round-12 supersedes the old
//  heuristic search). The prior engine searched a radius×angle grid per label
//  and dodged collisions with Bézier "pushes" — good, but a search can only
//  make crossings unlikely, never impossible (its last-resort fallback drew
//  through anything). This engine is the two-column callout layout of the
//  reference class (Datawrapper · ECharts alignLabels · AMCharts):
//
//    1. slices partition by MID-ANGLE into a RIGHT and a LEFT column;
//    2. within a side, anchors are Y-MONOTONE along the arc (sin is monotone
//       over each half), so sorting by angle sorts by anchor y;
//    3. labels stack in that SAME order, de-overlapped by an order-preserving
//       two-pass sweep (forward: no overlap; backward: pull back inside the
//       viewport) — order in ⇒ order out;
//    4. every leader is the same y-monotone 3-segment polyline (radial exit →
//       diagonal → horizontal into its column).
//
//  Invariant: two polylines whose start points share one vertical order and
//  whose end points share the SAME order, each y-monotone between two fixed
//  columns, form a planar wiring diagram — they cannot intersect. So for ANY
//  dataset, ANY slice distribution: zero leader crossings, zero label
//  overlaps, everything in bounds. Proven, not searched. The companion
//  fitness suite (donutLabelLayout.fitness.test.ts) hammers it with
//  adversarial distributions and asserts all three invariants.

import type { ChartOutput } from '@statdash/charts'
import { fmtNum } from '@statdash/engine'
import { cssVar, chartPalette, chartSequentialSample } from '@statdash/styles'

const W = 500, H = 300, CX = 250, CY = 150
const R = 100, RI = 65
const PAD = 0.042, EXPLODE_D = 9

// Nothing renders outside this rect — leaders included
const X0 = 2, X1 = W - 2, Y0 = 2, Y1 = H - 2

const F_PCT = 11, F_NAME = 9.5
const LH_PCT = F_PCT + 2, LH_NAME = F_NAME + 2
const CH_W = 5.6

// Column geometry: radial exit off the ring, then a diagonal into the fixed
// label column each side owns (Datawrapper's aligned-callout silhouette).
const COL_X    = R + 42          // column offset from CX (label text starts here)
const ROW_GAP  = 4               // min vertical clearance between label boxes
const EDGE_PAD = 4               // viewport top/bottom breathing

// View constants the component + tooltip render against.
export const DONUT_VIEW = { W, H, CX, CY, X0, Y0, EXPLODE_D, F_PCT, F_NAME, LH_PCT, LH_NAME } as const

type Pt = [number, number]

// ── Math helpers ───────────────────────────────────────────────────────

const pol = (r: number, a: number): Pt => [CX + r * Math.cos(a), CY + r * Math.sin(a)]

function sliceArc(s: number, e: number): string {
  const [x1, y1] = pol(R, s), [x2, y2] = pol(R, e)
  const [x3, y3] = pol(RI, e), [x4, y4] = pol(RI, s)
  const lg = e - s > Math.PI ? 1 : 0, f = (n: number) => n.toFixed(2)
  return `M${f(x1)} ${f(y1)} A${R} ${R} 0 ${lg} 1 ${f(x2)} ${f(y2)} L${f(x3)} ${f(y3)} A${RI} ${RI} 0 ${lg} 0 ${f(x4)} ${f(y4)}Z`
}

export const fmtC = (n: number) => fmtNum(n, 0)
const fmtV = (n: number) => fmtNum(n, 1)

export function wrap(t: string, m: number): string[] {
  if (!t) return []; const ws = t.split(' '), o: string[] = []; let c = ''
  for (const s of ws) { const n = c ? `${c} ${s}` : s; if (n.length <= m) c = n; else { if (c) o.push(c); c = s } }
  if (c) o.push(c); return o.length ? o : [t]
}

// ── Types ──────────────────────────────────────────────────────────────

export interface Slice { path: string; mid: number; color: string; pct: number; name: string; formatted: string }
export interface Lbl {
  idx: number; color: string; pctText: string
  lx: number; ly: number; ld: string
  ax: number; ay: number; tx: number; ty: number
  anchor: 'start' | 'end' | 'middle'; lines: string[]; bh: number
}

// ── Order-preserving column stack ──────────────────────────────────────
//
//  Rows arrive sorted by their ideal y (= anchor order along the arc). The
//  forward pass pushes each row below its predecessor; the backward pass
//  pulls the whole tail up when the stack runs past the viewport. Order is
//  never exchanged — the non-crossing invariant rests on exactly that.

interface Row { ideal: number; h: number; y: number }

/** Stack rows in-order inside [Y0..Y1]. The gap adapts: when the column is
 *  tight the clearance shrinks (to zero at the limit) instead of any row ever
 *  escaping the viewport or swapping order. Returns false when even gap-0
 *  cannot fit — the caller degrades (fewer/leaner rows). */
function stackColumn(rows: Row[]): boolean {
  const avail = (Y1 - EDGE_PAD) - (Y0 + EDGE_PAD)
  const total = rows.reduce((t, r) => t + r.h, 0)
  if (total > avail) return false
  const gap = rows.length > 1
    ? Math.min(ROW_GAP, (avail - total) / (rows.length - 1))
    : ROW_GAP
  let cursor = Y0 + EDGE_PAD
  for (const r of rows) {
    r.y = Math.max(r.ideal - r.h / 2, cursor)
    cursor = r.y + r.h + gap
  }
  let floor = Y1 - EDGE_PAD
  for (let i = rows.length - 1; i >= 0; i--) {
    const r = rows[i]!
    if (r.y + r.h > floor) r.y = floor - r.h
    floor = r.y - gap
  }
  return true
}

// ── Build ──────────────────────────────────────────────────────────────

interface Entry { idx: number; angle: number; pct: number; color: string; pctText: string; name: string }

function placeAll(entries: Entry[], showNames: boolean): Lbl[] {
  const f = (n: number) => n.toFixed(1)
  const result: Lbl[] = []

  // 1. Partition by side and sort by the ANCHOR Y itself (sin) — never by the
  //    raw angle: mid-angles live in [-π/2, 3π/2) and the right half WRAPS
  //    (its top spans both ends of that range), so an angle sort inverts the
  //    order across the wrap and the wiring invariant dies (the 16-dust-slices
  //    regression this file's fitness suite pins). sin has no wrap.
  const bySinAsc = (a: Entry, b: Entry) => Math.sin(a.angle) - Math.sin(b.angle)
  const right = entries.filter(e => Math.cos(e.angle) >= 0).sort(bySinAsc)
  const left  = entries.filter(e => Math.cos(e.angle) < 0).sort(bySinAsc)

  for (const [side, dir] of [[right, 1], [left, -1]] as Array<[Entry[], 1 | -1]>) {
    if (side.length === 0) continue
    const colX  = CX + dir * COL_X
    const avail = dir === 1 ? X1 - colX - 6 : colX - X0 - 6
    const maxCh = Math.max(6, Math.floor((avail - 6) / CH_W))

    // 2. Measure rows at their ideal y (the arc projection), in arc order —
    //    then de-overlap, degrading honestly when the column is over capacity:
    //    names drop first (pct-only rows), and only past even THAT limit the
    //    smallest slices lose their callout (ECharts overflow school) — the
    //    numbers stay reachable in the tooltip, and the invariants never bend.
    const measure = (names: boolean): Row[] => side.map((e) => {
      const lines = names ? wrap(e.name, maxCh) : []
      const h = names ? LH_PCT + lines.length * LH_NAME : LH_PCT
      return { ideal: CY + (R + 26) * Math.sin(e.angle), h, y: 0 }
    })
    let names = showNames
    let rows = measure(names)
    if (!stackColumn(rows) && names) { names = false; rows = measure(false) }
    let kept = side
    if (!stackColumn(rows)) {
      const capacity = Math.max(1, Math.floor(((Y1 - EDGE_PAD) - (Y0 + EDGE_PAD)) / LH_PCT))
      const keepSet = new Set([...side].sort((a, b) => b.pct - a.pct).slice(0, capacity).map(e => e.idx))
      kept = side.filter(e => keepSet.has(e.idx))
      rows = kept.map((e) => ({ ideal: CY + (R + 26) * Math.sin(e.angle), h: LH_PCT, y: 0 }))
      stackColumn(rows)
    }

    // 3. Emit labels + their y-monotone 3-segment leaders.
    kept.forEach((e, i) => {
      const row = rows[i]!
      const lines = names ? wrap(e.name, maxCh) : []
      const yMid = row.y + row.h / 2

      // THE non-crossing construction (two-verticals wiring): (1) a HORIZONTAL
      // from the slice edge to the side's common exit vertical Ex — horizontals
      // are parallel, they cannot cross each other; (2) a DIAGONAL from Ex to
      // the label column — both endpoint sets sit on two fixed verticals in
      // the SAME y-order, and straight segments between two order-matched
      // verticals cannot intersect (the wiring-diagram lemma); (3) the short
      // horizontal into the text. Segments of different kinds live in disjoint
      // x half-planes (left of Ex / between Ex and the column / past it), so
      // cross-kind intersections are impossible too. Straight diagonals from
      // the raw arc — ANY variant we tried — invert in flat clusters at the
      // poles (the 16-dust fitness case); this construction cannot.
      const p0 = pol(R + 2, e.angle)              // slice edge
      const p1: Pt = [CX + dir * (R + 16), p0[1]] // common exit vertical, same y
      const p2: Pt = [colX - dir * 8, yMid]       // diagonal lands beside the column
      const p3: Pt = [colX - dir * 3, yMid]       // short horizontal into the text
      const ld = `M${f(p0[0])},${f(p0[1])} L${f(p1[0])},${f(p1[1])} L${f(p2[0])},${f(p2[1])} L${f(p3[0])},${f(p3[1])}`

      result.push({
        idx: e.idx, color: e.color, pctText: e.pctText,
        lx: p0[0], ly: p0[1], ld,
        ax: p3[0], ay: yMid,
        tx: colX, ty: row.y,
        anchor: dir === 1 ? 'start' : 'end',
        lines, bh: row.h,
      })
    })
  }

  return result
}

export function build(output: ChartOutput, showNames: boolean) {
  const pts = output.series[0]?.data ?? [], cats = output.categories
  const tot = pts.reduce((s, p) => s + p.value, 0)
  if (!tot) return { slices: [] as Slice[], labels: [] as Lbl[] }
  const isPct = (pts[0]?.formatted ?? '').includes('%')

  // A donut shows categorical structure, so each slice should read as its own
  // hue — same rule as the treemap (TreemapChart.tsx). A `palette:"sequential"`
  // chart reads as ONE quantity split into ordered classes → paint every slice
  // from the single-hue ramp (sampled so N slices span light→dark). Otherwise:
  // distribute the categorical palette when the series carries ≤1 distinct
  // threshold colour, else respect the per-slice semantic colours.
  const sequential = output.palette === 'sequential'
  const distinct   = new Set(pts.map(p => p.thresholdColor).filter(Boolean))
  const distribute = distinct.size <= 1
  const palette    = sequential ? chartSequentialSample(pts.length) : chartPalette()

  let ang = -Math.PI / 2
  const slices: Slice[] = [], entries: Entry[] = []
  pts.forEach((pt, i) => {
    const pct = pt.value / tot
    const sw = Math.max(pct * 2 * Math.PI - PAD, 0.001)
    const s = ang + PAD / 2, e = s + sw; ang = e + PAD / 2
    const color = sequential
      ? palette[i]!
      : distribute
        ? palette[i % palette.length]!
        : (pt.thresholdColor ?? cssVar('--color-text-muted', '#6B7B8D'))
    const mid = (s + e) / 2
    slices.push({ path: sliceArc(s, e), mid, color, pct, name: cats[i] ?? '', formatted: pt.formatted })
    if (pct > 0) entries.push({ idx: i, angle: mid, pct, color, pctText: isPct ? pt.formatted : fmtV(pt.value), name: cats[i] ?? '' })
  })
  return { slices, labels: placeAll(entries, showNames) }
}
