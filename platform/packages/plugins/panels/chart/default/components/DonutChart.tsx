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

// SHOW_LABELS = false  → outer labels + leaders hidden; legend shown instead.
// SHOW_LABELS = true   → restores full label placement (placeAll kept intact).
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
              {cLbl && <text x={CX} y={CY - 13} textAnchor="middle" dominantBaseline="middle" fontSize="10.5" fill={cssVar('--color-text-faint', '#9AABB8')} fontFamily="BPG Arial, Roboto, sans-serif">{cLbl}</text>}
              <text x={CX} y={CY + (cLbl ? 8 : 0)} textAnchor="middle" dominantBaseline="middle" fontSize="20" fontWeight="700" fill={cssVar('--color-text-primary', '#1A2332')} fontFamily="BPG Arial, Roboto, sans-serif">{fmtC(output.total!)}</text>
            </g>
        )}

        {hov !== null && cur && <DonutTip s={slices[hov]!} cx={cur.x} cy={cur.y} />}
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
            <span style={{ fontSize: 10, color: 'var(--color-text-secondary)', lineHeight: 1.3 }}>
              {s.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
