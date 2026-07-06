// ── DonutChart — clamped leaders, fast greedy, strict bounds ───────────
//
//  View only. The label-placement engine + types live in donutGeometry.ts;
//  the hover tooltip lives in DonutTip.tsx. SVG text fills resolve design
//  tokens via cssVar (var() is invalid in SVG presentation attributes).

import { useState, useMemo } from 'react'
import type { ChartOutput } from '@statdash/charts'
import { cssVar } from '@statdash/styles'
import { build, fmtC, DONUT_VIEW } from './donutGeometry'
import { DonutTip } from './DonutTip'

const { W, H, CX, CY, EXPLODE_D, F_PCT, F_NAME, LH_PCT, LH_NAME } = DONUT_VIEW

// Outer numeric slice labels + leaders are gated on the declarative `output.dataLabels`
// flag (default OFF for donut per the ChartOutput contract — admin B4: numbers off the
// graph, hover-only). When off, the slice values live only in the hover tooltip; the
// legend still carries every category name and the centre keeps the rollup total. A
// config author sets `dataLabels: true` on the chart node to restore the leader labels.
// SHOW_NAMES = true additionally restores the name lines alongside the values.
const SHOW_NAMES  = false  // set true to restore name lines alongside percentages

export default function DonutChart({ output }: { output: ChartOutput }) {
  const showLabels = output.dataLabels ?? false
  const fontFamily = typeof window !== 'undefined'
    ? (getComputedStyle(document.documentElement).getPropertyValue('--font-family-base').trim() || 'system-ui, sans-serif')
    : 'system-ui, sans-serif'
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

        {showLabels && labels.map(lb => (
            <g key={lb.idx} opacity={hov !== null && hov !== lb.idx && act !== lb.idx ? 0.3 : 1} style={{ transition: 'opacity .15s' }}>
              <path d={lb.ld} fill="none" stroke={lb.color} strokeWidth="1.2" opacity="0.5" strokeLinecap="round" />
              <circle cx={lb.ax} cy={lb.ay} r="2" fill={lb.color} opacity="0.35" />
              <text x={lb.tx} y={lb.ty + LH_PCT / 2} textAnchor={lb.anchor} dominantBaseline="middle"
                    fontSize={F_PCT} fontWeight="700" fontFamily={fontFamily} fill={lb.color}>{lb.pctText}</text>
              {/* name lines hidden — set SHOW_NAMES = true to restore */}
              {SHOW_NAMES && lb.lines.map((line, li) => (
                  <text key={li} x={lb.tx} y={lb.ty + LH_PCT + li * LH_NAME + LH_NAME / 2}
                        textAnchor={lb.anchor} dominantBaseline="middle" fontSize={F_NAME} fontWeight="400"
                        fontFamily={fontFamily} fill={lb.color} opacity="0.72">{line}</text>
              ))}
            </g>
        ))}

        {hasC && (
            <g style={{ pointerEvents: 'none' }}>
              {cLbl && <text x={CX} y={CY - 13} textAnchor="middle" dominantBaseline="middle" fontSize="10.5" fill={cssVar('--color-text-faint', '#9AABB8')} fontFamily={fontFamily}>{cLbl}</text>}
              <text x={CX} y={CY + (cLbl ? 8 : 0)} textAnchor="middle" dominantBaseline="middle" fontSize="20" fontWeight="700" fill={cssVar('--color-text-primary', '#1A2332')} fontFamily={fontFamily}>{fmtC(output.total!)}</text>
            </g>
        )}

        {hov !== null && cur && <DonutTip s={slices[hov]!} cx={cur.x} cy={cur.y} />}
      </svg>

      {/* ── Legend ──
          Layout (wrap / spacing / truncation) is structural CSS in chart.css so
          it can step down responsively at narrow widths — a high-cardinality
          donut (10+ sectors) otherwise crowds and overlaps. Long names ellipsis-
          truncate with a native `title` tooltip (full name on hover), keeping the
          legend legible without overrunning the ring. Data-driven bits (swatch
          colour, hover dim) stay inline. Generic for any donut. */}
      <div className="donut-legend">
        {slices.map((s, i) => (
          <div
            key={i}
            className="donut-legend__item"
            style={{ opacity: hov !== null && hov !== i ? 0.4 : 1 }}
            title={s.name}
          >
            <span className="donut-legend__swatch" style={{ background: s.color }} />
            <span className="donut-legend__label">{s.name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
