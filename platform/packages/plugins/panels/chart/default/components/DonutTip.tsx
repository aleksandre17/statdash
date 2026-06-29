// ── DonutTip — donut slice hover tooltip (SVG) ─────────────────────────
//
//  Split out of DonutChart (one-concern-per-file; keeps the chart under the
//  body ceiling). Text fills resolve design tokens at render via cssVar —
//  `var()` is invalid in SVG presentation attributes, so the token value is
//  read from the computed cascade and passed as a literal (theme-aware:
//  a [data-tenant] override re-tints with zero edits here).

import { fmtNum } from '@statdash/engine'
import { cssVar } from '@statdash/styles'
import type { Slice } from './donutGeometry'
import { wrap, DONUT_VIEW } from './donutGeometry'

const { W, H, X0, Y0 } = DONUT_VIEW

export function DonutTip({ s, cx, cy }: { s: Slice; cx: number; cy: number }) {
  const fontFamily = typeof window !== 'undefined'
    ? (getComputedStyle(document.documentElement).getPropertyValue('--font-family-base').trim() || 'system-ui, sans-serif')
    : 'system-ui, sans-serif'
  const ls = wrap(s.name, 22), h = 10 + ls.length * 15 + 20 + 10
  const bx = Math.min(Math.max(cx + 14, X0), W - 214)
  const by = Math.min(Math.max(cy - h - 10, Y0), H - h - Y0)
  return (
      <g style={{ pointerEvents: 'none' }}>
        <rect x={bx} y={by} width={210} height={h} rx="7" fill={cssVar('--color-surface', 'white')} stroke={s.color} strokeWidth="1" filter="url(#dsh)" />
        {ls.map((l, i) => (
            <text key={i} x={bx + 10} y={by + 10 + i * 15 + 7.5} fontSize="10" fontWeight="400" fill={cssVar('--color-text-muted', '#5A7A8A')} fontFamily={fontFamily} dominantBaseline="middle">{l}</text>
        ))}
        <text x={bx + 10} y={by + 10 + ls.length * 15 + 10} fontSize="11" fontWeight="700" fill={cssVar('--color-text-primary', '#1A2332')} fontFamily={fontFamily} dominantBaseline="middle">
          {s.formatted}{!s.formatted.includes('%') && <tspan fontSize="10" fontWeight="600" fill={s.color}>{` · ${fmtNum(s.pct * 100, 1)}%`}</tspan>}
        </text>
      </g>
  )
}
