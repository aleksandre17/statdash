// ── Mode B: PivotTable ────────────────────────────────────────────────
//
//  Long DataRow[] → cross-classified display (Eurostat pattern).
//  Single ColumnDef → flat one-row header.
//  Multiple ColumnDefs → two-row grouped header:
//    row 1: series names (colSpan = columns.length each)
//    row 2: column labels repeated per series
//

import type { DataRow, ColumnDef } from '@statdash/engine'
import { getFormatter }            from '@statdash/engine'
import type { AggType }            from './_footer'
import { getCellValue, colFmt }    from './_helpers'
import { computeAggregate, defaultFooterLabel } from './_footer'

export interface PivotTableProps {
  rows:          DataRow[]
  colLabel:      string
  columns:       ColumnDef[]
  caption?:      string
  footer?:       Record<string, AggType>
  footerLabel?:  string
  seriesFormat?: Record<string, string>
  seriesOrder?:  string[]
}

export function PivotTable({ rows, colLabel, columns, caption, footer, footerLabel, seriesFormat, seriesOrder }: PivotTableProps) {
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
                      {/* col.label is pre-resolved to the active locale by DataTable */}
                      {col.label as string}
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
