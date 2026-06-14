import './data-table.css'

// ── DataTable — Grammar of Graphics renderer ──────────────────────────
//
//  Receives DataRow[] from interpretSpec — same data that feeds Chart.
//  Auto-detects render mode from data shape:
//
//  Mode A — SimpleTable  (series absent):
//    colLabel | col₁ | col₂ | … | [bar]
//    Supports: isSeparator, isTotal, indent (level), statusFlags, multi-column.
//
//  Mode B — PivotTable  (series present):
//    colLabel | series₁ col₁ | series₁ col₂ | series₂ col₁ | …
//    Single-column series → flat header.
//    Multi-column series  → two-row grouped header (Eurostat cross-classified).
//
//  Column declarations (ColumnDef[]) are JSON-serializable — constructor-safe.
//  valueLabel is a shorthand for a single 'value' column (backward compat).
//
//  GoG golden rule: data is never pivoted in the data layer.
//  PivotTable pivots for display — data stays long format (Tidy Data).
//

import type { DataRow }   from '@geostat/engine'
import type { ColumnDef, TableConfig } from '@geostat/engine'
import { getFormatter }   from '@geostat/engine'

// ── Helpers ───────────────────────────────────────────────────────────

const defaultFmt = (n: number) => {
  const abs = Math.abs(n), neg = n < 0 ? '-' : ''
  const s = abs.toFixed(1).replace(/\.?0+$/, '')
  const [int, dec] = s.split('.')
  return neg + int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + (dec ? '.' + dec : '')
}

function getCellValue(row: DataRow, key: string): number {
  if (key === 'value') return row.value
  if (key === 'pct')   return row.pct ?? 0
  return Number((row as unknown as Record<string, unknown>)[key] ?? 0)
}

function colFmt(col: ColumnDef): (n: number) => string {
  return col.format ? getFormatter(col.format) : defaultFmt
}

// ── Footer aggregate computation ──────────────────────────────────────
//
//  IMF/Eurostat pattern: table declares aggregate per column key.
//  Renderer computes — data layer unchanged.
//
//  'sum'  → Σ(dataRows)        rendered with col.format
//  'avg'  → Σ / n              rendered with col.format
//  'cagr' → (last/first)^(1/(n-1))−1  rendered as sign_pct (always %)
//
type AggType = 'sum' | 'avg' | 'cagr'

function computeAggregate(col: ColumnDef, dataRows: DataRow[], aggType: AggType): string | null {
  const values = dataRows.map((r) => getCellValue(r, col.key))
  if (!values.length) return null
  const fmt = colFmt(col)

  switch (aggType) {
    case 'sum':
      return fmt(values.reduce((a, b) => a + b, 0))
    case 'avg':
      return fmt(values.reduce((a, b) => a + b, 0) / values.length)
    case 'cagr': {
      if (values.length < 2) return null
      const first = values[0], last = values[values.length - 1]
      if (!first) return null
      const cagr = ((last / first) ** (1 / (values.length - 1)) - 1) * 100
      return getFormatter('sign_pct')(cagr)
    }
  }
}

// Default footer row label derived from table footer config
function defaultFooterLabel(footer: Record<string, AggType>): string {
  const types = [...new Set(Object.values(footer))]
  if (types.length === 1) {
    if (types[0] === 'sum')  return 'სულ'
    if (types[0] === 'avg')  return 'საშუალო'
    if (types[0] === 'cagr') return 'CAGR'
  }
  return 'სულ / საშუალო'
}

const STATUS_LABELS: Record<string, string> = {
  p: 'წინასწარი',
  e: 'შეფასებული',
  r: 'განახლებული',
  c: 'კონფიდენციალური',
}

// ── DataTable (public) ────────────────────────────────────────────────

export default function DataTable({
  rows,
  colLabel    = 'კომპონენტი',
  columns,
  valueLabel  = 'მლნ ₾',
  color       = '#0080BE',
  indent      = false,
  statusFlags = false,
  caption,
  footer,
  footerLabel,
  seriesFormat,
  seriesOrder,
  highlightedLabel,
}: TableConfig & { rows: DataRow[]; highlightedLabel?: string }) {
  const effectiveCols: ColumnDef[] = columns ?? [{ key: 'value', label: valueLabel }]
  const isMultiSeries = rows.some((r) => r.series !== undefined)

  return isMultiSeries
    ? <PivotTable
        rows={rows}
        colLabel={colLabel ?? 'კომპონენტი'}
        columns={effectiveCols}
        footer={footer}
        caption={caption}
        footerLabel={footerLabel}
        seriesFormat={seriesFormat}
        seriesOrder={seriesOrder}
      />
    : <SimpleTable
        rows={rows}
        colLabel={colLabel ?? 'კომპონენტი'}
        columns={effectiveCols}
        color={color ?? '#0080BE'}
        indent={indent ?? false}
        statusFlags={statusFlags ?? false}
        caption={caption}
        footer={footer}
        footerLabel={footerLabel}
        highlightedLabel={highlightedLabel}
      />
}

// ── Mode A: SimpleTable ───────────────────────────────────────────────

interface SimpleTableProps {
  rows:              DataRow[]
  colLabel:          string
  columns:           ColumnDef[]
  color:             string
  indent:            boolean
  statusFlags:       boolean
  caption?:          string
  footer?:           Record<string, AggType>
  footerLabel?:      string
  highlightedLabel?: string
}

function SimpleTable({ rows, colLabel, columns, color, indent, statusFlags, caption, footer, footerLabel, highlightedLabel }: SimpleTableProps) {
  const dataRows = rows.filter((r) => !r.isTotal && !r.isSeparator)
  const totalCols = 1 + columns.length
  const hasTfoot  = !!footer && Object.keys(footer).length > 0

  // Per-column bar scale — computed once, used in every row cell.
  const barScale = Object.fromEntries(
    columns.filter((c) => c.bar).map((c) => {
      const min = typeof c.bar === 'object' && c.bar.min !== undefined ? c.bar.min : 0
      const max = typeof c.bar === 'object' && c.bar.max !== undefined
        ? c.bar.max
        : Math.max(...dataRows.map((r) => getCellValue(r, c.key)), 1)
      return [c.key, { min, max }]
    }),
  )

  return (
    <div className="data-table__wrap">
      <table className="data-table" aria-label={caption}>
        {caption && <caption className="data-table__caption">{caption}</caption>}
        <thead>
          <tr>
            <th scope="col">{colLabel}</th>
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={col.align === 'r' ? 'r' : ''}
                style={col.width ? { width: col.width } : col.bar ? { width: '40%' } : undefined}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            if (row.isSeparator) {
              return (
                <tr key={row.id} className="t-separator">
                  <td colSpan={totalCols}>
                    <span className="t-separator-dot" style={{ background: row.color ?? color }} />
                    {row.label}
                  </td>
                </tr>
              )
            }

            const labelStyle = indent && row.level
              ? { paddingLeft: `calc(${row.level} * 1.25rem + 1.25rem)` }
              : undefined

            const isHighlighted = !row.isTotal && highlightedLabel != null && row.label === highlightedLabel
            return (
              <tr key={row.id} className={[row.isTotal ? 'total' : '', isHighlighted ? 'data-table__row--highlighted' : ''].filter(Boolean).join(' ')}>
                <th scope="row" style={labelStyle}>
                  {!row.isTotal && (
                    <span className="t-dot" aria-hidden="true" style={{ background: row.color ?? color }} />
                  )}
                  {row.label}
                  {statusFlags && row.status && row.status !== 'A' && (
                    <span className={`t-status t-status--${row.status}`}>
                      {STATUS_LABELS[row.status] ?? row.status}
                    </span>
                  )}
                </th>
                {columns.map((col) => {
                  const val = getCellValue(row, col.key)
                  if (!col.bar) {
                    return (
                      <td key={col.key} className={`t-num${col.align === 'r' ? ' r' : ''}`}>
                        {colFmt(col)(val)}
                      </td>
                    )
                  }
                  const { min, max } = barScale[col.key] ?? { min: 0, max: 1 }
                  return (
                    <td key={col.key}>
                      {row.isTotal ? (
                        <span className="bar-pct" style={{ color: '#1A2332' }}>{colFmt(col)(val)}</span>
                      ) : (
                        <div className="bar-cell" style={{ '--sc': row.color ?? color } as React.CSSProperties}>
                          <div className="bar-track">
                            <div className="bar-fill" style={{ width: `${Math.max(0, (val - min) / (max - min)) * 100}%` }} />
                          </div>
                          <span className="bar-pct">{colFmt(col)(val)}</span>
                        </div>
                      )}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
        {hasTfoot && footer && (
          <tfoot>
            <tr className="t-footer">
              <th scope="row">{footerLabel ?? defaultFooterLabel(footer)}</th>
              {columns.map((col) => (
                <td key={col.key} className={`t-num${col.align === 'r' ? ' r' : ''}`}>
                  {footer[col.key] ? computeAggregate(col, dataRows, footer[col.key]) ?? '—' : '—'}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}

// ── Mode B: PivotTable ────────────────────────────────────────────────
//
//  Long DataRow[] → cross-classified display (Eurostat pattern).
//  Single ColumnDef → flat one-row header.
//  Multiple ColumnDefs → two-row grouped header:
//    row 1: series names (colSpan = columns.length each)
//    row 2: column labels repeated per series
//

interface PivotTableProps {
  rows:          DataRow[]
  colLabel:      string
  columns:       ColumnDef[]
  caption?:      string
  footer?:       Record<string, AggType>
  footerLabel?:  string
  seriesFormat?: Record<string, string>
  seriesOrder?:  string[]
}

function PivotTable({ rows, colLabel, columns, caption, footer, footerLabel, seriesFormat, seriesOrder }: PivotTableProps) {
  // Preserve source order (first appearance) — respects pipeline sort steps
  const labels    = [...new Map(rows.map((r) => [r.label, true])).keys()]
  const allSeries = [...new Map(rows.map((r) => [r.series ?? '', true])).keys()]
  const series    = seriesOrder
    ? [...seriesOrder.filter((s) => allSeries.includes(s)), ...allSeries.filter((s) => !seriesOrder.includes(s))]
    : allSeries

  const cellMap   = new Map(rows.map((r) => [`${r.label}::${r.series ?? ''}`, r]))
  const cell      = (label: string, s: string) => cellMap.get(`${label}::${s}`)
  const dataLabels = labels.filter((lbl) => {
    const r = cell(lbl, series[0] ?? '')
    return !r?.isTotal && !r?.isSeparator
  })

  const multiCol  = columns.length > 1
  const hasTfoot  = !!footer && Object.keys(footer).length > 0

  // Legacy per-series formatter (seriesFormat takes priority over col.format)
  const seriesFmt = (s: string, col: ColumnDef): (n: number) => string =>
    seriesFormat?.[s] ? getFormatter(seriesFormat[s]) : colFmt(col)

  const totalCols = 1 + series.length * columns.length

  return (
    <div className="data-table__wrap">
      <table className="data-table" aria-label={caption}>
        {caption && <caption className="data-table__caption">{caption}</caption>}
        <thead>
          {multiCol ? (
            <>
              {/* Row 1 — series group headers */}
              <tr>
                <th scope="col" rowSpan={2} style={{ width: '30%' }}>{colLabel}</th>
                {series.map((s) => (
                  <th key={s} scope="colgroup" colSpan={columns.length} className="r t-col-group">
                    {s}
                  </th>
                ))}
              </tr>
              {/* Row 2 — sub-column labels */}
              <tr>
                {series.flatMap((s) =>
                  columns.map((col) => (
                    <th key={`${s}-${col.key}`} scope="col" className="r t-col-sub">
                      {col.label}
                    </th>
                  ))
                )}
              </tr>
            </>
          ) : (
            <tr>
              <th scope="col" style={{ width: '30%' }}>{colLabel}</th>
              {series.map((s) => (
                <th key={s} scope="col" className="r">{s}</th>
              ))}
            </tr>
          )}
        </thead>
        <tbody>
          {labels.map((label) => {
            const firstRow   = cell(label, series[0] ?? '')
            const isTotal    = firstRow?.isTotal
            const isSeparator = firstRow?.isSeparator

            if (isSeparator) {
              return (
                <tr key={label} className="t-separator">
                  <td colSpan={totalCols}>
                    <span className="t-separator-dot" style={{ background: firstRow?.color }} />
                    {label}
                  </td>
                </tr>
              )
            }

            return (
              <tr key={label} className={isTotal ? 'total' : ''}>
                <th scope="row">
                  {!isTotal && firstRow?.color && (
                    <span className="t-dot" aria-hidden="true" style={{ background: firstRow.color }} />
                  )}
                  {label}
                </th>
                {series.flatMap((s) =>
                  columns.map((col) => {
                    const row = cell(label, s)
                    return (
                      <td key={`${s}-${col.key}`} className={`t-num${col.align === 'r' ? ' r' : ''}`}>
                        {row !== undefined ? seriesFmt(s, col)(getCellValue(row, col.key)) : '—'}
                      </td>
                    )
                  })
                )}
              </tr>
            )
          })}
        </tbody>
        {hasTfoot && footer && (
          <tfoot>
            <tr className="t-footer">
              <th scope="row">{footerLabel ?? defaultFooterLabel(footer)}</th>
              {series.flatMap((s) =>
                columns.map((col) => {
                  const seriesRows = dataLabels
                    .map((lbl) => cell(lbl, s))
                    .filter((r): r is DataRow => r !== undefined)
                  return (
                    <td key={`${s}-${col.key}`} className={`t-num${col.align === 'r' ? ' r' : ''}`}>
                      {footer[col.key] ? computeAggregate(col, seriesRows, footer[col.key]) ?? '—' : '—'}
                    </td>
                  )
                })
              )}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}