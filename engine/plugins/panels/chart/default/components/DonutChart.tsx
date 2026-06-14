// ── DonutChart — clamped leaders, fast greedy, strict bounds ───────────

import { useState, useMemo } from 'react'
import type { ChartOutput } from '@geostat/engine'
import { fmtNum } from '@geostat/engine'

const W = 500, H = 300, CX = 250, CY = 150
const R = 100, RI = 65
const PAD = 0.042, EXPLODE_D = 9

// Nothing renders outside this rect — leaders included
const X0 = 2, X1 = W - 2, Y0 = 2, Y1 = H - 2

const BOX_GAP = 5, DONUT_CLEAR = R + 8
const F_PCT = 11, F_NAME = 9.5
const LH_PCT = F_PCT + 2, LH_NAME = F_NAME + 2
const CH_W = 5.6

// Search grid — deliberately coarse for speed
const RS = R + 28, RE = 190, RSTEP = 6, ASTEP = 0.08

type Pt = [number, number]
interface Box { x1: number; y1: number; x2: number; y2: number }

// ── Math helpers ───────────────────────────────────────────────────────

const pol = (r: number, a: number): Pt => [CX + r * Math.cos(a), CY + r * Math.sin(a)]

const clampX = (x: number) => Math.max(X0, Math.min(X1, x))
const clampY = (y: number) => Math.max(Y0, Math.min(Y1, y))

function sliceArc(s: number, e: number): string {
  const [x1, y1] = pol(R, s), [x2, y2] = pol(R, e)
  const [x3, y3] = pol(RI, e), [x4, y4] = pol(RI, s)
  const lg = e - s > Math.PI ? 1 : 0, f = (n: number) => n.toFixed(2)
  return `M${f(x1)} ${f(y1)} A${R} ${R} 0 ${lg} 1 ${f(x2)} ${f(y2)} L${f(x3)} ${f(y3)} A${RI} ${RI} 0 ${lg} 0 ${f(x4)} ${f(y4)}Z`
}

const fmtC = (n: number) => fmtNum(n, 0)
const fmtV = (n: number) => fmtNum(n, 1)

function wrap(t: string, m: number): string[] {
  if (!t) return []; const ws = t.split(' '), o: string[] = []; let c = ''
  for (const s of ws) { const n = c ? `${c} ${s}` : s; if (n.length <= m) c = n; else { if (c) o.push(c); c = s } }
  if (c) o.push(c); return o.length ? o : [t]
}

// ── Geometry ───────────────────────────────────────────────────────────

const boxHit = (a: Box, b: Box) =>
    !(a.x2 + BOX_GAP < b.x1 || b.x2 + BOX_GAP < a.x1 || a.y2 + BOX_GAP < b.y1 || b.y2 + BOX_GAP < a.y1)

function touchesDonut(b: Box): boolean {
  for (const x of [b.x1, (b.x1 + b.x2) / 2, b.x2])
    for (const y of [b.y1, (b.y1 + b.y2) / 2, b.y2])
      if (Math.hypot(x - CX, y - CY) < DONUT_CLEAR) return true
  return false
}

function segCross(a1: Pt, a2: Pt, b1: Pt, b2: Pt): boolean {
  const d = (a2[0] - a1[0]) * (b2[1] - b1[1]) - (a2[1] - a1[1]) * (b2[0] - b1[0])
  if (Math.abs(d) < 1e-9) return false
  const t = ((b1[0] - a1[0]) * (b2[1] - b1[1]) - (b1[1] - a1[1]) * (b2[0] - b1[0])) / d
  const u = ((b1[0] - a1[0]) * (a2[1] - a1[1]) - (b1[1] - a1[1]) * (a2[0] - a1[0])) / d
  return t > 0.02 && t < 0.98 && u > 0.02 && u < 0.98
}

function polysCross(a: Pt[], b: Pt[]): boolean {
  for (let i = 0; i < a.length - 1; i++)
    for (let j = 0; j < b.length - 1; j++)
      if (segCross(a[i], a[i + 1], b[j], b[j + 1])) return true
  return false
}

function segHitsBox(x1: number, y1: number, x2: number, y2: number, b: Box): boolean {
  const bx1 = b.x1 - 1, by1 = b.y1 - 1, bx2 = b.x2 + 1, by2 = b.y2 + 1
  if (x1 >= bx1 && x1 <= bx2 && y1 >= by1 && y1 <= by2) return true
  if (x2 >= bx1 && x2 <= bx2 && y2 >= by1 && y2 <= by2) return true
  const dx = x2 - x1, dy = y2 - y1; let tE = 0, tX = 1
  for (const [p, q] of [[-dx, x1 - bx1], [dx, bx2 - x1], [-dy, y1 - by1], [dy, by2 - y1]] as Pt[]) {
    if (Math.abs(p) < 1e-9) { if (q < 0) return false }
    else { const r = q / p; if (p < 0) tE = Math.max(tE, r); else tX = Math.min(tX, r); if (tE > tX) return false }
  }
  return true
}

function polyHitsBoxes(pts: Pt[], boxes: Box[]): boolean {
  for (let i = 0; i < pts.length - 1; i++)
    for (const b of boxes)
      if (segHitsBox(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], b)) return true
  return false
}

// ── Cubic Bézier flatten (with clamping) ───────────────────────────────

function flatCubic(p0: Pt, c1: Pt, c2: Pt, p3: Pt): Pt[] {
  const N = 10, pts: Pt[] = []
  for (let i = 0; i <= N; i++) {
    const t = i / N, u = 1 - t
    pts.push([
      clampX(u * u * u * p0[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p3[0]),
      clampY(u * u * u * p0[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p3[1]),
    ])
  }
  return pts
}

// ── Leader builder ─────────────────────────────────────────────────────
//
// Cubic Bézier: exits donut radially, arrives at label horizontally.
// Control points are CLAMPED to SVG bounds so the curve cannot escape.
// Push parameter swings the curve outward to dodge obstacles.

function buildLeader(
    sx: number, sy: number, ex: number, ey: number,
    sliceAngle: number, boxes: Box[], routes: Pt[][],
): { d: string; pts: Pt[]; ok: boolean } | null {

  const f = (n: number) => n.toFixed(1)
  const rdx = Math.cos(sliceAngle), rdy = Math.sin(sliceAngle)
  const dist = Math.hypot(ex - sx, ey - sy)
  const arm = Math.max(15, Math.min(dist * 0.38, 50))
  const endDir = ex > CX ? 1 : -1

  // Try pushes: 0, then outward, then inward
  const pushes = [0, 10, 20, 35, 50, -10, -20, -35]

  for (const push of pushes) {
    const c1: Pt = [
      clampX(sx + rdx * arm + rdx * push),
      clampY(sy + rdy * arm + rdy * push),
    ]
    const eDist = Math.hypot(ex - CX, ey - CY) || 1
    const eDx = (ex - CX) / eDist, eDy = (ey - CY) / eDist
    const c2: Pt = [
      clampX(ex - endDir * arm * 0.7 + eDx * push * 0.5),
      clampY(ey + eDy * push * 0.5),
    ]

    const start: Pt = [sx, sy], end: Pt = [ex, ey]
    const pts = flatCubic(start, c1, c2, end)

    // Check bounds (should pass due to clamping, but verify)
    const oob = pts.some(([x, y]) => x < X0 || x > X1 || y < Y0 || y > Y1)
    if (oob) continue

    // Check donut
    if (pts.some(([x, y]) => Math.hypot(x - CX, y - CY) < R + 2)) continue

    // Check label boxes
    if (polyHitsBoxes(pts, boxes)) continue

    // Check leader crossings
    if (routes.some(r => polysCross(pts, r))) continue

    const d = `M${f(sx)},${f(sy)} C${f(c1[0])},${f(c1[1])} ${f(c2[0])},${f(c2[1])} ${f(ex)},${f(ey)}`
    return { d, pts, ok: true }
  }

  // Absolute fallback: straight line (clamped)
  const pts: Pt[] = [[sx, sy], [ex, ey]]
  const d = `M${f(sx)},${f(sy)} L${f(ex)},${f(ey)}`
  return { d, pts, ok: false }
}

// ── Candidate ──────────────────────────────────────────────────────────

interface Cand {
  ax: number; ay: number; tx: number; ty: number
  anchor: 'start' | 'end' | 'middle'
  lines: string[]; bh: number; box: Box; score: number
}

function tryPos(a: number, r: number, base: number, pct: string, name: string, showNames: boolean): Cand | null {
  const cos = Math.cos(a), sin = Math.sin(a)
  const [ax, ay] = pol(r, a)

  const horiz = Math.abs(cos) >= Math.abs(sin)
  const right = horiz ? cos >= 0 : false
  const down = !horiz ? sin >= 0 : false

  let avail = horiz
      ? (right ? X1 - ax - 6 : ax - X0 - 6)
      : Math.min(ax - X0, X1 - ax) * 2 - 6
  if (avail < 30) return null

  const maxCh = Math.max(6, Math.floor((avail - 12) / CH_W))
  const lines = showNames ? wrap(name, maxCh) : []
  const longest = showNames ? Math.max(pct.length, ...lines.map(l => l.length)) : pct.length
  const bw = longest * CH_W + 12, bh = showNames ? LH_PCT + lines.length * LH_NAME : LH_PCT

  let anchor: 'start' | 'end' | 'middle', tx: number, ty: number
  let x1: number, y1: number, x2: number, y2: number

  if (horiz) {
    if (right) { anchor = 'start'; tx = ax + 5; x1 = ax; x2 = ax + bw + 5 }
    else { anchor = 'end'; tx = ax - 5; x1 = ax - bw - 5; x2 = ax }
    y1 = ay - bh / 2; y2 = ay + bh / 2; ty = ay - bh / 2
  } else {
    anchor = 'middle'; tx = ax; x1 = ax - bw / 2 - 2; x2 = ax + bw / 2 + 2
    if (down) { y1 = ay + 2; y2 = ay + bh + 2; ty = ay + 2 }
    else { y1 = ay - bh - 2; y2 = ay - 2; ty = ay - bh - 2 }
  }

  if (x1 < X0 || x2 > X1 || y1 < Y0 || y2 > Y1) return null
  const box: Box = { x1, y1, x2, y2 }
  if (touchesDonut(box)) return null

  const score = Math.abs(a - base) * 140 + Math.abs(r - (showNames ? RS : R + 14)) * 2
  return { ax, ay, tx, ty, anchor, lines, bh, box, score }
}

// ── Types ──────────────────────────────────────────────────────────────

interface Slice { path: string; mid: number; color: string; pct: number; name: string; formatted: string }
interface Lbl {
  idx: number; color: string; pctText: string
  lx: number; ly: number; ld: string
  ax: number; ay: number; tx: number; ty: number
  anchor: 'start' | 'end' | 'middle'; lines: string[]; bh: number
}

// ── Greedy placement ───────────────────────────────────────────────────

function placeAll(
    entries: { idx: number; angle: number; pct: number; color: string; pctText: string; name: string }[],
    showNames: boolean,
): Lbl[] {
  const rsStart = showNames ? RS : R + 14
  const reEnd   = showNames ? RE : 160
  const sorted = [...entries].sort((a, b) => b.pct - a.pct)
  const boxes: Box[] = [], routes: Pt[][] = [], result: Lbl[] = []

  for (const e of sorted) {
    const [lx, ly] = pol(R + 5, e.angle)

    let bestCand: Cand | null = null
    let bestLead: { d: string; pts: Pt[] } | null = null
    let bestScore = Infinity

    // Build angle list once
    const angles: number[] = [e.angle]
    for (let da = ASTEP; da <= 2.5; da += ASTEP)
      angles.push(e.angle + da, e.angle - da)

    for (let r = rsStart; r <= reEnd; r += RSTEP) {
      for (const a of angles) {
        const c = tryPos(a, r, e.angle, e.pctText, e.name, showNames)
        if (!c || c.score >= bestScore) continue
        if (boxes.some(b => boxHit(c.box, b))) continue

        const lead = buildLeader(lx, ly, c.ax, c.ay, e.angle, boxes, routes)
        if (!lead || !lead.ok) continue

        // Clearance bonus
        let cl = 300
        for (const b of boxes) {
          const dx = Math.max(0, b.x1 - c.box.x2, c.box.x1 - b.x2)
          const dy = Math.max(0, b.y1 - c.box.y2, c.box.y1 - b.y2)
          cl = Math.min(cl, Math.sqrt(dx * dx + dy * dy))
        }

        const total = c.score - Math.min(cl, 50) * 2
        if (total < bestScore) {
          bestScore = total; bestCand = c; bestLead = lead
        }
      }
      // Early exit: if we found something at this radius with good score, stop
      if (bestCand && bestScore < 50) break
    }

    if (bestCand && bestLead) {
      boxes.push(bestCand.box)
      routes.push(bestLead.pts)
      result.push({
        idx: e.idx, color: e.color, pctText: e.pctText,
        lx, ly, ld: bestLead.d,
        ax: bestCand.ax, ay: bestCand.ay, tx: bestCand.tx, ty: bestCand.ty,
        anchor: bestCand.anchor, lines: bestCand.lines, bh: bestCand.bh,
      })
    }
  }

  return result
}

// ── Build ──────────────────────────────────────────────────────────────

function build(output: ChartOutput, showNames: boolean) {
  const pts = output.series[0]?.data ?? [], cats = output.categories
  const tot = pts.reduce((s, p) => s + p.value, 0)
  if (!tot) return { slices: [] as Slice[], labels: [] as Lbl[] }
  const isPct = (pts[0]?.formatted ?? '').includes('%')
  let ang = -Math.PI / 2
  const slices: Slice[] = [], entries: Parameters<typeof placeAll>[0] = []
  pts.forEach((pt, i) => {
    const pct = pt.value / tot
    const sw = Math.max(pct * 2 * Math.PI - PAD, 0.001)
    const s = ang + PAD / 2, e = s + sw; ang = e + PAD / 2
    const mid = (s + e) / 2, color = pt.thresholdColor ?? '#6B7B8D'
    slices.push({ path: sliceArc(s, e), mid, color, pct, name: cats[i] ?? '', formatted: pt.formatted })
    if (pct > 0) entries.push({ idx: i, angle: mid, pct, color, pctText: isPct ? pt.formatted : fmtV(pt.value), name: cats[i] ?? '' })
  })
  return { slices, labels: placeAll(entries, showNames) }
}

// ── Tooltip ────────────────────────────────────────────────────────────

function Tip({ s, cx, cy }: { s: Slice; cx: number; cy: number }) {
  const ls = wrap(s.name, 22), h = 10 + ls.length * 15 + 20 + 10
  const bx = Math.min(Math.max(cx + 14, X0), W - 214)
  const by = Math.min(Math.max(cy - h - 10, Y0), H - h - Y0)
  return (
      <g style={{ pointerEvents: 'none' }}>
        <rect x={bx} y={by} width={210} height={h} rx="7" fill="white" stroke={s.color} strokeWidth="1" filter="url(#dsh)" />
        {ls.map((l, i) => (
            <text key={i} x={bx + 10} y={by + 10 + i * 15 + 7.5} fontSize="10" fontWeight="400" fill="#5A7A8A" fontFamily="BPG Arial, Roboto, sans-serif" dominantBaseline="middle">{l}</text>
        ))}
        <text x={bx + 10} y={by + 10 + ls.length * 15 + 10} fontSize="11" fontWeight="700" fill="#1A2332" fontFamily="BPG Arial, Roboto, sans-serif" dominantBaseline="middle">
          {s.formatted}{!s.formatted.includes('%') && <tspan fontSize="10" fontWeight="600" fill={s.color}>{` · ${fmtNum(s.pct * 100, 1)}%`}</tspan>}
        </text>
      </g>
  )
}

// ── Component ──────────────────────────────────────────────────────────
//
// SHOW_LABELS = false  → outer labels + leaders hidden; legend shown instead.
// SHOW_LABELS = true   → restores full label placement (placeAll kept intact).
//
const SHOW_LABELS = true   // set false to hide all outer labels + leaders
const SHOW_NAMES  = false  // set true to restore name lines alongside percentages

export default function DonutChart({ output }: { output: ChartOutput }) {
  const { slices, labels } = useMemo(() => build(output, SHOW_NAMES), [output])
  const [hov, setHov] = useState<number | null>(null)
  const [act, setAct] = useState<number | null>(null)
  const [cur, setCur] = useState<{ x: number; y: number } | null>(null)
  if (!slices.length) return null
  const hasC = output.total !== undefined, cLbl = output.centerLabel ?? output.axes.y.unit ?? ''

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ flex: 1, minHeight: 0, display: 'block' }}
           preserveAspectRatio="xMidYMid meet" overflow="hidden"
           aria-label={output.series[0]?.name}
           onMouseMove={e => { const svg = e.currentTarget, pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; const p = pt.matrixTransform(svg.getScreenCTM()!.inverse()); setCur({ x: p.x, y: p.y }) }}
           onMouseLeave={() => { setHov(null); setCur(null) }}>
        <defs><filter id="dsh" x="-15%" y="-30%" width="130%" height="160%"><feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.12" /></filter></defs>

        {slices.map((s, i) => {
          const isA = act === i, isH = hov === i
          const [dx, dy] = isA ? [Math.cos(s.mid) * EXPLODE_D, Math.sin(s.mid) * EXPLODE_D] : [0, 0]
          return <path key={i} d={s.path} fill={s.color} opacity={hov !== null && !isH && !isA ? 0.5 : 1}
                       transform={isA ? `translate(${dx.toFixed(2)} ${dy.toFixed(2)})` : undefined}
                       style={{ cursor: 'pointer', transition: 'opacity .15s, transform .18s ease' }}
                       onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(null)}
                       onClick={() => setAct(p => p === i ? null : i)} />
        })}

        {SHOW_LABELS && labels.map(lb => (
            <g key={lb.idx} opacity={hov !== null && hov !== lb.idx && act !== lb.idx ? 0.3 : 1} style={{ transition: 'opacity .15s' }}>
              <path d={lb.ld} fill="none" stroke={lb.color} strokeWidth="1.2" opacity="0.5" strokeLinecap="round" />
              <circle cx={lb.ax} cy={lb.ay} r="2" fill={lb.color} opacity="0.35" />
              <text x={lb.tx} y={lb.ty + LH_PCT / 2} textAnchor={lb.anchor} dominantBaseline="middle"
                    fontSize={F_PCT} fontWeight="700" fontFamily="BPG Arial, Roboto, sans-serif" fill={lb.color}>{lb.pctText}</text>
              {/* name lines hidden — set SHOW_NAMES = true to restore */}
              {SHOW_NAMES && lb.lines.map((line, li) => (
                  <text key={li} x={lb.tx} y={lb.ty + LH_PCT + li * LH_NAME + LH_NAME / 2}
                        textAnchor={lb.anchor} dominantBaseline="middle" fontSize={F_NAME} fontWeight="400"
                        fontFamily="BPG Arial, Roboto, sans-serif" fill={lb.color} opacity="0.72">{line}</text>
              ))}
            </g>
        ))}

        {hasC && (
            <g style={{ pointerEvents: 'none' }}>
              {cLbl && <text x={CX} y={CY - 13} textAnchor="middle" dominantBaseline="middle" fontSize="10.5" fill="#9AABB8" fontFamily="BPG Arial, Roboto, sans-serif">{cLbl}</text>}
              <text x={CX} y={CY + (cLbl ? 8 : 0)} textAnchor="middle" dominantBaseline="middle" fontSize="20" fontWeight="700" fill="#1A2332" fontFamily="BPG Arial, Roboto, sans-serif">{fmtC(output.total!)}</text>
            </g>
        )}

        {hov !== null && cur && <Tip s={slices[hov]!} cx={cur.x} cy={cur.y} />}
      </svg>

      {/* ── Legend ── */}
      <div style={{
        flexShrink: 0, display: 'flex', flexWrap: 'wrap',
        justifyContent: 'center', gap: '4px 14px',
        padding: '4px 8px 6px', fontFamily: 'BPG Arial, Roboto, sans-serif',
      }}>
        {slices.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, opacity: hov !== null && hov !== i ? 0.4 : 1, transition: 'opacity .15s' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
            <span style={{ fontSize: 10, color: '#4A5568', lineHeight: 1.3 }}>
              {s.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}