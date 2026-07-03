// ── TreemapChart ────────────────────────────────────────────────────────
//
//  Left  column (35 %) : total block, full height
//  Right column (65 %) : 2×2 flex grid
//    top    row : 2 largest components side-by-side (flex-grow by value)
//    bottom row : 2 smallest components side-by-side (flex-grow by value)
//    row heights : proportional to row-sum (flex on the row itself)
//

import { useState }         from 'react'
import { createPortal }     from 'react-dom'
import type { ChartOutput } from '@statdash/charts'
import { fmtNum } from '@statdash/engine'
import { cssVar, chartPalette } from '@statdash/styles'

const GAP = 3

function isLight(hex: string): boolean {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return (r * 299 + g * 587 + b * 114) / 1000 > 160
}

interface Item {
  label: string; clean: string; op: string
  value: number; formatted: string
  color: string; isTotal: boolean
}
interface Cursor { x: number; y: number }

// ── Marker ───────────────────────────────────────────────────────────────
//
//  Contribution-role glyph in a tile's top-left corner: `=` on the total,
//  `+`/`-` on additive/subtractive components (interpreter-supplied prefix).
//  The GLYPH itself carries the meaning (not colour), so it stays readable
//  text — no aria-hidden — satisfying WCAG "no colour-only information".
//
function Marker({ op, light }: { op: string; light: boolean }) {
  if (!op) return null
  return (
    <span style={{
      position: 'absolute', top: 8, left: 11, pointerEvents: 'none',
      fontSize: 16, fontWeight: 700, lineHeight: 1,
      color: light ? 'var(--color-text-primary)' : 'var(--color-text-inverse)',
      opacity: 0.85,
    }}>
      {op}
    </span>
  )
}

// ── Tooltip ────────────────────────────────────────────────────────────

function Tooltip({ item, pct, cursor }: { item: Item; pct: string; cursor: Cursor }) {
  const fontFamily = typeof window !== 'undefined'
    ? (getComputedStyle(document.documentElement).getPropertyValue('--font-family-base').trim() || 'system-ui, sans-serif')
    : 'system-ui, sans-serif'
  return (
    <div style={{
      position: 'fixed', left: cursor.x + 16, top: cursor.y - 10,
      width: 210, background: 'var(--color-surface)', border: `1px solid ${item.color}`,
      borderRadius: 7, padding: '9px 11px', pointerEvents: 'none',
      boxShadow: '0 2px 10px rgba(0,0,0,0.12)', zIndex: 99999,
      fontFamily,
    }}>
      <div style={{ fontSize: 10, color: 'var(--color-text-muted)', lineHeight: 1.45, marginBottom: 5 }}>
        {item.clean}
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-primary)' }}>
        {item.formatted}
        {pct && <span style={{ fontWeight: 500, fontSize: 10, color: item.color, marginLeft: 7 }}>· {pct}</span>}
      </div>
    </div>
  )
}

// ── Block ──────────────────────────────────────────────────────────────

function Block({
  item, flexGrow, pct, hovered, onEnter, onMove, onLeave,
}: {
  item: Item; flexGrow: number; pct: string
  hovered: Item | null
  onEnter: (e: React.MouseEvent) => void
  onMove:  (e: React.MouseEvent) => void
  onLeave: () => void
}) {
  const fontFamily = typeof window !== 'undefined'
    ? (getComputedStyle(document.documentElement).getPropertyValue('--font-family-base').trim() || 'system-ui, sans-serif')
    : 'system-ui, sans-serif'
  const light = isLight(item.color)
  const dim   = hovered && hovered.label !== item.label
  return (
    <div
      style={{
        flex: flexGrow, position: 'relative', minWidth: 0, minHeight: 0,
        background: item.color, borderRadius: 4, overflow: 'hidden',
        cursor: 'default', opacity: dim ? 0.7 : 1, transition: 'opacity 0.15s',
      }}
      onMouseEnter={onEnter}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
    >
      <Marker op={item.op} light={light} />
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column', gap: 2,
        alignItems: 'center', justifyContent: 'center',
        padding: '4px 10px', pointerEvents: 'none',
        color: light ? 'var(--color-text-primary)' : 'var(--color-text-inverse)', overflow: 'hidden',
      }}>
        <span style={{
          fontSize: 12, fontFamily,
          textAlign: 'center', lineHeight: 1.3,
          overflow: 'hidden', display: '-webkit-box',
          WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
        }}>
          {item.clean}
        </span>
        <span style={{
          fontSize: 15, fontWeight: 700, lineHeight: 1.2,
          fontFamily,
        }}>
          {item.formatted}
        </span>
        {pct && (
          <span style={{
            fontSize: 11, opacity: 0.85, lineHeight: 1.2,
            fontFamily,
          }}>
            {pct}
          </span>
        )}
      </div>
    </div>
  )
}

// ── Component ──────────────────────────────────────────────────────────

export default function TreemapChart({ output }: { output: ChartOutput }) {
  const fontFamily = typeof window !== 'undefined'
    ? (getComputedStyle(document.documentElement).getPropertyValue('--font-family-base').trim() || 'system-ui, sans-serif')
    : 'system-ui, sans-serif'
  const [hovered, setHovered] = useState<Item | null>(null)
  const [cursor,  setCursor]  = useState<Cursor | null>(null)

  const pts  = output.series[0]?.data ?? []
  const cats = output.categories
  if (!pts.length) return null

  // `||` not `??`: an unmapped measure yields color '' from the lookup pipe
  // (an empty STRING, which `??` would keep → a transparent, invisible block).
  // Fall back to the theme accent so every tile paints. The total tile keeps
  // this accent as its anchor colour; components draw from the palette below.
  const accent = cssVar('--color-accent', '#0080BE')
  const base   = output.series[0]?.color || accent

  // A treemap carrying contribution-role markers is an additive DECOMPOSITION
  // (total = Σ parts of ONE measure family): every tile reads as a single hue —
  // the themed accent — and the +/= glyph (not colour) carries the structure.
  // A FLAT categorical treemap instead distributes the palette so distinct
  // categories stay distinguishable (or respects per-row semantic colours when
  // present). Agnostic: keyed on marker PRESENCE, not on any measure name (Law 1);
  // token-driven + theme-aware (dark parity via cssVar), never a hardcoded hex.
  // (WCAG: per-tile label/marker contrast is handled by isLight() below.)
  const hasMarkers = cats.some((l) => /^\([=+\-]\) /.test(l ?? ''))
  const compColors = cats
    .map((l, i) => (pts[i] && !(l ?? '').startsWith('(=) ') ? pts[i]!.thresholdColor : undefined))
  const distinct   = new Set(compColors.filter(Boolean))
  const distribute = !hasMarkers && distinct.size <= 1
  const palette    = chartPalette()
  let ci = 0

  const items: Item[] = cats
    .map((rawLabel, i) => {
      const label = rawLabel ?? ''
      const pt    = pts[i]
      if (!pt) return null
      const isTotal = label.startsWith('(=) ')
      const color   = hasMarkers
        ? accent
        : isTotal
          ? (pt.thresholdColor || base)
          : distribute
            ? palette[ci++ % palette.length]!
            : (pt.thresholdColor || base)
      return {
        label,
        clean:     label.replace(/^\(.\) /, ''),
        op:        label.match(/^\((.)\) /)?.[1] ?? '',
        value:     pt.value,
        formatted: pt.formatted,
        color,
        isTotal,
      }
    })
    .filter((it): it is Item => it !== null)

  const totalItem  = items.find(it => it.isTotal)
  const components = items.filter(it => !it.isTotal).sort((a, b) => b.value - a.value)
  const totalValue = totalItem?.value ?? components.reduce((s, it) => s + it.value, 0)
  const pctOf      = (it: Item) => totalValue > 0
    ? fmtNum((it.value / totalValue) * 100, 1) + '%' : ''

  // Split into two rows: 2 largest on top, rest on bottom
  const topRow = components.slice(0, 2)
  const botRow = components.slice(2)
  const topSum = topRow.reduce((s, it) => s + it.value, 0)
  const botSum = botRow.reduce((s, it) => s + it.value, 0)

  function handlers(it: Item) {
    return {
      onEnter: (e: React.MouseEvent) => { setHovered(it); setCursor({ x: e.clientX, y: e.clientY }) },
      onMove:  (e: React.MouseEvent) => setCursor({ x: e.clientX, y: e.clientY }),
      onLeave: () => { setHovered(null); setCursor(null) },
    }
  }

  return (
    // minHeight floor: the treemap fills its parent via height:100%, but on
    // mobile the chart wrapper is height:auto (indefinite), against which 100%
    // collapses to 0 → a blank panel. The token floor keeps it visible at every
    // width; on desktop the parent's definite height wins (floor is inert).
    <div style={{
      display: 'flex', height: '100%', gap: GAP,
      minHeight: 'var(--size-panel-min-height, 14rem)',
    }}>

      {/* ── Left: total (35%) ── */}
      {totalItem && (() => {
        const light = isLight(totalItem.color)
        const h     = handlers(totalItem)
        const dim   = hovered && hovered.label !== totalItem.label
        return (
          <div
            style={{
              width: '30%', flexShrink: 0, position: 'relative',
              background: totalItem.color, borderRadius: 4, overflow: 'hidden',
              cursor: 'default', opacity: dim ? 0.7 : 1, transition: 'opacity 0.15s',
            }}
            onMouseEnter={h.onEnter}
            onMouseMove={h.onMove}
            onMouseLeave={h.onLeave}
          >
            <Marker op={totalItem.op} light={light} />
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', flexDirection: 'column', gap: 3,
              alignItems: 'center', justifyContent: 'center',
              padding: 12, textAlign: 'center', pointerEvents: 'none',
              color: light ? 'var(--color-text-primary)' : 'var(--color-text-inverse)',
            }}>
              <span style={{ fontSize: 12, fontFamily, lineHeight: 1.35 }}>
                {totalItem.clean}
              </span>
              <span style={{ fontSize: 17, fontWeight: 700, fontFamily, lineHeight: 1.2 }}>
                {totalItem.formatted}
              </span>
            </div>
          </div>
        )
      })()}

      {/* ── Right: 2×2 grid ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: GAP, minWidth: 0 }}>

        {/* Top row */}
        {topRow.length > 0 && (
          <div style={{ flex: topSum, display: 'flex', gap: GAP, minHeight: 0 }}>
            {topRow.map((it, i) => {
              const h = handlers(it)
              return (
                <Block
                  key={it.label || i}
                  item={it} flexGrow={it.value} pct={pctOf(it)}
                  hovered={hovered}
                  onEnter={h.onEnter} onMove={h.onMove} onLeave={h.onLeave}
                />
              )
            })}
          </div>
        )}

        {/* Bottom row */}
        {botRow.length > 0 && (
          <div style={{ flex: botSum, display: 'flex', gap: GAP, minHeight: 0 }}>
            {botRow.map((it, i) => {
              const h = handlers(it)
              return (
                <Block
                  key={it.label || i}
                  item={it} flexGrow={it.value} pct={pctOf(it)}
                  hovered={hovered}
                  onEnter={h.onEnter} onMove={h.onMove} onLeave={h.onLeave}
                />
              )
            })}
          </div>
        )}
      </div>

      {hovered && cursor && createPortal(
        <Tooltip item={hovered} pct={hovered.isTotal ? '' : pctOf(hovered)} cursor={cursor} />,
        document.body,
      )}
    </div>
  )
}