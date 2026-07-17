// ── FF-DONUT-LABELS — non-crossing donut callouts, ANY data (round 12) ─────────
//
//  The layout claims an INVARIANT, not a heuristic: for any dataset, any slice
//  distribution — zero leader crossings, zero label-box overlaps, everything in
//  bounds, every visible slice labelled. This suite hammers the claim with the
//  distributions that break search-based placers (dense tiny-slice fans at 12
//  o'clock, one dominant + dust, alternating magnitudes, seeded randoms).

import { describe, it, expect, vi } from 'vitest'
import type { ChartOutput, AxisOutput } from '@statdash/charts'

vi.mock('@statdash/styles', () => ({
  cssVar: (_: string, fb: string) => fb,
  chartPalette: () => ['#111111', '#222222', '#333333', '#444444'],
  chartSequentialSample: (n: number) => Array.from({ length: n }, (_, i) => `#0080b${i % 10}`),
}))

import { build, DONUT_VIEW } from './donutGeometry'

const { W, H, LH_PCT } = DONUT_VIEW

type Pt = [number, number]

function makeOutput(values: number[], names?: string[]): ChartOutput {
  const y: AxisOutput = { unit: undefined, decimals: undefined }
  return {
    type: 'donut',
    categories: values.map((_, i) => names?.[i] ?? `კატეგორია ${i + 1} გრძელი სახელით`),
    series: [{
      name: 'S', color: '#00A896',
      data: values.map(v => ({ value: v, formatted: String(v) })),
    }],
    axes: { x: {}, y, y2: undefined },
    stacked: false, horizontal: false,
    legend: { show: true }, tooltip: { show: true }, annotations: [],
  } as ChartOutput
}

/** Parse the leader path (M/L polyline) back into points. */
function leaderPts(ld: string): Pt[] {
  return [...ld.matchAll(/[ML]([\d.]+),([\d.]+)/g)].map(m => [Number(m[1]), Number(m[2])] as Pt)
}

function segCross(a1: Pt, a2: Pt, b1: Pt, b2: Pt): boolean {
  const d = (a2[0] - a1[0]) * (b2[1] - b1[1]) - (a2[1] - a1[1]) * (b2[0] - b1[0])
  if (Math.abs(d) < 1e-9) return false
  const t = ((b1[0] - a1[0]) * (b2[1] - b1[1]) - (b1[1] - a1[1]) * (b2[0] - b1[0])) / d
  const u = ((b1[0] - a1[0]) * (a2[1] - a1[1]) - (b1[1] - a1[1]) * (a2[0] - a1[0])) / d
  return t > 0.001 && t < 0.999 && u > 0.001 && u < 0.999
}

function crossings(paths: Pt[][]): number {
  let n = 0
  for (let i = 0; i < paths.length; i++)
    for (let j = i + 1; j < paths.length; j++)
      for (let s = 0; s < paths[i]!.length - 1; s++)
        for (let t = 0; t < paths[j]!.length - 1; t++)
          if (segCross(paths[i]![s]!, paths[i]![s + 1]!, paths[j]![t]!, paths[j]![t + 1]!)) n++
  return n
}

/** Label box from the emitted Lbl (mirrors how the component paints it). */
function boxOf(l: { tx: number; ty: number; bh: number; anchor: string; pctText: string; lines: string[] }) {
  const chW = 5.6
  const wMax = Math.max(l.pctText.length, ...(l.lines.length ? l.lines.map(s => s.length) : [0])) * chW
  const x1 = l.anchor === 'start' ? l.tx : l.tx - wMax
  return { x1, y1: l.ty, x2: x1 + wMax, y2: l.ty + l.bh }
}

const boxesOverlap = (a: ReturnType<typeof boxOf>, b: ReturnType<typeof boxOf>) =>
  !(a.x2 < b.x1 || b.x2 < a.x1 || a.y2 <= b.y1 || b.y2 <= a.y1)

function mulberry(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const CASES: Array<{ name: string; values: number[] }> = [
  { name: 'the owner screenshot class — one dominant + a dust fan at 12 o\'clock',
    values: [42982, 7516, 6270, 5778, 4441, 4038, 3414, 2485, 2216, 1357, 476] },
  { name: 'ten equal slices', values: Array.from({ length: 10 }, () => 100) },
  { name: 'two slices', values: [95, 5] },
  { name: 'single slice', values: [1] },
  { name: 'sixteen tiny + one giant', values: [1000, ...Array.from({ length: 16 }, () => 3)] },
  { name: 'alternating large/small', values: Array.from({ length: 12 }, (_, i) => (i % 2 ? 5 : 500)) },
  ...Array.from({ length: 6 }, (_, k) => {
    const rnd = mulberry(k + 1)
    const n = 3 + Math.floor(rnd() * 15)
    return { name: `seeded random #${k + 1} (n=${n})`, values: Array.from({ length: n }, () => 1 + Math.floor(rnd() * 1000)) }
  }),
]

describe('FF-DONUT-LABELS — the non-crossing invariant holds on any data', () => {
  for (const showNames of [true, false]) {
    for (const c of CASES) {
      it(`${c.name} (names ${showNames ? 'on' : 'off'})`, () => {
        const { labels } = build(makeOutput(c.values), showNames)

        // (a) every visible slice is labelled
        expect(labels.length).toBe(c.values.filter(v => v > 0).length)

        // (b) zero leader crossings — the core claim
        expect(crossings(labels.map(l => leaderPts(l.ld)))).toBe(0)

        // (c) zero label-box overlaps
        const boxes = labels.map(boxOf)
        for (let i = 0; i < boxes.length; i++)
          for (let j = i + 1; j < boxes.length; j++)
            expect(boxesOverlap(boxes[i]!, boxes[j]!), `boxes ${i}/${j} overlap`).toBe(false)

        // (d) everything inside the viewbox (leaders and boxes)
        for (const l of labels) {
          for (const [x, y] of leaderPts(l.ld)) {
            expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThanOrEqual(W)
            expect(y).toBeGreaterThanOrEqual(0); expect(y).toBeLessThanOrEqual(H)
          }
          expect(l.ty).toBeGreaterThanOrEqual(0)
          expect(l.ty + l.bh).toBeLessThanOrEqual(H)
          expect(l.bh).toBeGreaterThanOrEqual(LH_PCT)
        }
      })
    }
  }
})
