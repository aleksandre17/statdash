// ── HBarDivergingChart ─────────────────────────────────────────────────
//
//  Layout: [section col 10%] [label col 22%] [bar canvas 1fr]
//  Section label spans its data rows via CSS grid-row.
//  Two thin bars per row (one per series). Shared x-axis with tick labels.
//
//  Axis: sqrt scale — small values get proportionally longer bars.
//  Zero position is data-driven: balanced T-account ≈ center, positive-only ≈ left.
//  Negative bars extend left; tick labels show original units.
//
//  Height: no fixed height — rows size to content, chart grows as needed.
//

import { Fragment, useState, useCallback, useRef, useEffect } from 'react'
import { createPortal }                    from 'react-dom'
import type { ChartOutput }                from '@statdash/charts'

// ── Types ──────────────────────────────────────────────────────────────

interface BarPoint {
  value:      number
  formatted:  string
  color:      string
  seriesName: string
}

interface RowItem {
  cat:    string
  points: BarPoint[]
}

interface SectionEntry {
  label:    string
  rowStart: number
  rowEnd:   number
  items:    RowItem[]
}

interface Tip {
  x: number; y: number
  label: string; seriesName: string; formatted: string; color: string
}

// ── Axis helpers ────────────────────────────────────────────────────────

function niceAxisTicks(lo: number, hi: number): number[] {
  const mn    = Math.min(lo, 0)
  const mx    = Math.max(hi, 0)
  const range = mx - mn || 1
  const rough = range / 5
  const mag   = Math.pow(10, Math.floor(Math.log10(Math.max(rough, 1))))
  const step  = [1, 2, 2.5, 5, 10].map(p => p * mag).find(s => s >= rough) ?? mag * 10
  const start = Math.floor(mn / step) * step
  const end   = Math.ceil(mx  / step) * step
  const out: number[] = []
  for (let t = start; t <= end + step * 0.001; t = Math.round((t + step) * 1e9) / 1e9) {
    out.push(t)
  }
  return out
}

function fmtTick(v: number): string {
  const abs = Math.abs(v), neg = v < 0 ? '-' : ''
  return neg + Math.round(abs).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

// ── Component ──────────────────────────────────────────────────────────

export default function HBarDivergingChart({ output }: { output: ChartOutput }) {
  const { categories, series, groups = [], compact = false } = output
  const [tip, setTip] = useState<Tip | null>(null)

  const hasGroups = groups.length > 0

  // ── Measure grid height → derive visual density ──────────────────────
  const gridRef   = useRef<HTMLDivElement>(null)
  const [gridH, setGridH] = useState(0)

  useEffect(() => {
    const el = gridRef.current
    if (!el) return
    const obs = new ResizeObserver(([e]) => setGridH(e.contentRect.height))
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  // ── Build section / row data ─────────────────────────────────────────

  const sections: SectionEntry[] = []
  let totalRows = 0

  if (hasGroups) {
    let catIdx = 0
    for (const g of groups) {
      const rowStart = totalRows + 1
      const items: RowItem[] = []
      for (let i = 0; i < g.length; i++) {
        const gi = catIdx + i
        items.push({
          cat: categories[gi] ?? '',
          points: series.map(s => ({
            value:      s.data[gi]?.value     ?? 0,
            formatted:  s.data[gi]?.formatted ?? '',
            color:      s.data[gi]?.thresholdColor ?? s.color,
            seriesName: s.name,
          })),
        })
      }
      totalRows += g.length
      sections.push({ label: g.label, rowStart, rowEnd: totalRows + 1, items })
      catIdx += g.length
    }
  } else {
    const items: RowItem[] = categories.map((cat, gi) => ({
      cat,
      points: series.map(s => ({
        value:      s.data[gi]?.value     ?? 0,
        formatted:  s.data[gi]?.formatted ?? '',
        color:      s.data[gi]?.thresholdColor ?? s.color,
        seriesName: s.name,
      })),
    }))
    totalRows = items.length
    sections.push({ label: '', rowStart: 1, rowEnd: totalRows + 1, items })
  }

  // ── Axis ─────────────────────────────────────────────────────────────

  const allVals = series.flatMap(s => s.data.map(p => p.value))
  const dataMin = allVals.length ? Math.min(...allVals) : 0
  const dataMax = allVals.length ? Math.max(...allVals) : 100

  // Signed square-root scale: small values get proportionally longer bars
  // than a linear scale — makes the chart readable when values span orders
  // of magnitude. Tick labels remain in original units; only positions scale.
  const scaleV = (v: number) => Math.sign(v) * Math.pow(Math.abs(v), 0.5)

  // Nice tick scale for the positive range (labels in original units)
  const posTicks = niceAxisTicks(0, dataMax)
  const axMax    = posTicks[posTicks.length - 1] ?? Math.max(dataMax, 1)
  const axMaxS   = scaleV(axMax)

  // Negative bound: data-driven in scaled space (10% padding beyond actual min).
  // Zero falls proportionally — balanced T-account ≈ 50%, positive-only ≈ 0%.
  const axMinS   = dataMin < 0 ? scaleV(dataMin) * 1.1 : 0
  const axRangeS = axMaxS - axMinS

  // toX: maps raw value → canvas % using the power scale
  const toX   = (v: number) => ((scaleV(v) - axMinS) / axRangeS) * 100
  const zeroX = toX(0)

  // Ticks to display: positive nice ticks only (zero always visible via zero line)
  const visTicks = posTicks.filter(t => t <= axMax)

  // ── Tooltips ─────────────────────────────────────────────────────────

  const showTip = useCallback((e: React.MouseEvent, item: RowItem, pt: BarPoint) => {
    setTip({ x: e.clientX, y: e.clientY, label: item.cat, seriesName: pt.seriesName, formatted: pt.formatted, color: pt.color })
  }, [])
  const moveTip = useCallback((e: React.MouseEvent) => {
    setTip(t => t ? { ...t, x: e.clientX, y: e.clientY } : null)
  }, [])
  const hideTip = useCallback(() => setTip(null), [])

  // ── Visual density — all values adapt to measured row height ────────────
  //
  //  rowH  = available height divided evenly across rows (from ResizeObserver)
  //  barH  = bar thickness:  7 px (compact) … 22 px (spacious)
  //  barGap= between series: 2 px          … 7  px
  //  padV  = cell top+bottom:5 px          … 18 px
  //  radius= bar corner:     1 px          … 3  px  (never pill-shaped)
  //  lFs   = label font:    10 px          … 12 px

  const rowH   = gridH > 0 && totalRows > 0 ? gridH / totalRows : 40
  const barH   = Math.max(15, Math.min(22, Math.round(rowH * 0.28)))
  const barGap = Math.max(2,  Math.min(7,  Math.round(rowH * 0.08)))
  const padV   = Math.max(5,  Math.min(14, Math.round(rowH * 0.17)))
  const radius = Math.min(Math.round(barH / 2), 3)
  const lFs    = rowH > 55 ? 12 : 11

  // ── Responsive column widths (percentage-based) ───────────────────────

  const gridCols = hasGroups
    ? 'minmax(90px, 10%) minmax(160px, 22%) 1fr'
    : 'minmax(160px, 25%) 1fr'

  const labelCol = hasGroups ? 2 : 1
  const barCol   = hasGroups ? 3 : 2

  return (
    // flex column: grid scrolls (flex:1), axis+legend fixed at bottom
    <div style={{
      width: '100%', height: '100%', overflowX: 'hidden',
      display: 'flex', flexDirection: 'column',
      fontFamily: 'BPG Arial, Roboto, sans-serif', boxSizing: 'border-box',
    }}>

      {/* Floating tooltip — portal escapes any transformed ancestor stacking context */}
      {tip && createPortal(
        <div style={{
          position: 'fixed', left: tip.x + 14, top: tip.y - 52,
          background: 'var(--color-surface)', border: '1px solid var(--color-border-frame)', borderRadius: 5,
          padding: '6px 10px', boxShadow: '0 4px 16px rgba(0,0,0,.10)',
          zIndex: 99999, pointerEvents: 'none', minWidth: 130,
        }}>
          <div style={{ fontSize: 10, color: '#718096', marginBottom: 1 }}>{tip.label}</div>
          <div style={{ fontSize: 10, color: '#94A3B8', marginBottom: 4 }}>{tip.seriesName}</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: tip.color }}>{tip.formatted}</div>
        </div>,
        document.body,
      )}

      {/* ── Chart grid ────────────────────────────────────────────────
           flex:1        → fills available height (parent minus axis+legend)
           minmax rows   → each row is ≥ content; if space available rows grow
                           to fill; if rows exceed available height → scrolls    */}
      <div
        ref={gridRef}
        style={{
          flex: 1, minWidth: 0,
          overflowY: 'auto', overflowX: 'hidden',
          display: 'grid',
          gridTemplateColumns: gridCols,
          gridTemplateRows: `repeat(${totalRows}, minmax(min-content, 1fr))`,
        }}
      >

        {/* Section headers — each spans its data rows */}
        {hasGroups && sections.map(({ label, rowStart, rowEnd }) => (
          <div key={`sh-${label}`} style={{
            gridColumn: 1,
            gridRow: `${rowStart} / ${rowEnd}`,
            borderRight: '1px solid #E2E8F0',
            borderBottom: '2px solid #CBD5E0',
            padding: `${padV}px 8px ${padV}px 6px`,
            display: 'flex', alignItems: 'center',
          }}>
            <span style={{
              fontSize: lFs, fontWeight: 700, color: '#2D3748',
              lineHeight: 1.4, wordBreak: 'break-word' as const,
            }}>
              {label}
            </span>
          </div>
        ))}

        {/* Data rows */}
        {sections.flatMap(({ rowStart, items }) =>
          items.map((item, i) => {
            const row       = rowStart + i
            const isLast    = i === items.length - 1
            const rowBorder = isLast ? '2px solid #CBD5E0' : '1px solid #F0F4F8'

            return (
              <Fragment key={`row-${row}`}>

                {/* Label — wraps to show full name */}
                <div style={{
                  gridColumn: labelCol, gridRow: row,
                  display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                  padding: `${padV}px 10px ${padV}px 4px`,
                  borderBottom: rowBorder,
                  borderRight: '1px solid #E2E8F0',
                }}>
                  <span style={{
                    fontSize: lFs, color: 'var(--color-text-secondary)', textAlign: 'right',
                    lineHeight: 1.4, wordBreak: 'break-word' as const,
                  }}>
                    {item.cat}
                  </span>
                </div>

                {/* Bar canvas — overflow:hidden clips bars that go beyond axMin */}
                <div
                  onMouseMove={moveTip}
                  onMouseLeave={hideTip}
                  style={{
                    gridColumn: barCol, gridRow: row,
                    position: 'relative', overflow: 'hidden',
                    borderBottom: rowBorder,
                    display: 'flex', flexDirection: 'column',
                    justifyContent: 'center', gap: barGap,
                    padding: `${padV}px 4px`,
                  }}
                >
                  {/* Gridlines at positive ticks */}
                  {visTicks.map(tick => (
                    <div key={tick} style={{
                      position: 'absolute', top: 0, bottom: 0,
                      left: `${toX(tick)}%`, width: 1,
                      background: '#E8EDF2', pointerEvents: 'none',
                    }} />
                  ))}
                  {/* Zero line */}
                  <div style={{
                    position: 'absolute', top: 0, bottom: 0,
                    left: `${toX(0)}%`, width: 1,
                    background: '#94A3B8', pointerEvents: 'none',
                  }} />

                  {/* One bar per series — in compact mode, skip zero-value slots entirely */}
                  {item.points.map((pt, pi) => (compact && pt.value === 0) ? null : (
                    <div
                      key={pi}
                      style={{ position: 'relative', height: barH, flexShrink: 0 }}
                      onMouseEnter={e => showTip(e, item, pt)}
                    >
                      {pt.value !== 0 && (
                        <div style={{
                          position:     'absolute',
                          top: 0, bottom: 0,
                          left:         `${toX(Math.min(pt.value, 0))}%`,
                          width:        `${Math.abs(toX(pt.value) - zeroX)}%`,
                          minWidth:     2,
                          background:   pt.color,
                          borderRadius: radius,
                          transition:   'width 0.4s ease',
                        }} />
                      )}
                    </div>
                  ))}
                </div>

              </Fragment>
            )
          })
        )}
      </div>

      {/* ── X-axis tick labels ────────────────────────────────────── */}
      <div style={{ flexShrink: 0, display: 'grid', gridTemplateColumns: gridCols, borderTop: '1px solid #CBD5E0' }}>
        {hasGroups && <div />}
        <div />
        <div style={{ position: 'relative', height: 22, padding: '0 4px' }}>
          {visTicks.map(tick => (
            <div key={tick} style={{
              position: 'absolute', left: `${toX(tick)}%`,
              transform: 'translateX(-50%)',
              fontSize: 10, color: '#718096', top: 4, whiteSpace: 'nowrap',
            }}>
              {fmtTick(tick)}
            </div>
          ))}
          {/* Zero label */}
          <div style={{
            position: 'absolute', left: `${toX(0)}%`,
            transform: 'translateX(-50%)',
            fontSize: 10, color: '#718096', top: 4, whiteSpace: 'nowrap',
          }}>
            0
          </div>
        </div>
      </div>

      {/* ── Series legend ─────────────────────────────────────────── */}
      {series.length > 1 && (
        <div style={{
          flexShrink: 0,
          display: 'flex', justifyContent: 'center', gap: 24,
          padding: '10px 0 8px', flexWrap: 'wrap',
        }}>
          {series.map(s => (
            <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 14, height: 14, background: s.color, borderRadius: 2, flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{s.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}