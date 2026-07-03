// ── Mode B: PivotTable ────────────────────────────────────────────────
//
//  Long DataRow[] → cross-classified display (Eurostat pattern).
//  Single ColumnDef → flat one-row header.
//  Multiple ColumnDefs → two-row grouped header:
//    row 1: series names (colSpan = columns.length each)
//    row 2: column labels repeated per series
//

import type { KeyboardEvent }      from 'react'
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
  /**
   * Cross-filter select — present only when the node declares `on`. In a pivot the
   * SERIES/column (not the row) is the selectable axis member: in the rotated (State B)
   * composition the ROWS are the co-dimension (sectors) and the SERIES are the focus
   * dimension (regions), so a click on a region COLUMN adds/removes that region. The
   * emitted datum is a representative row of that series, whose `id` carries the
   * series member's identity (e.g. the region code) — the SAME shape SimpleTable emits,
   * so the shared `on[]` handler (`fromField:id`) resolves identically in both states.
   */
  onRowSelect?:  (row: DataRow) => void
  /** Currently-selected ids (representative row.id) for aria-pressed + highlight. */
  selectedIds?:  string[]
}

// Pivot value cells are ALWAYS numeric figures (getCellValue → formatter → t-num),
// so a column is RIGHT-aligned by default (IMF/Eurostat statistical-table
// convention). This is the SINGLE SOURCE for a column's horizontal alignment —
// the header (series/sub) th and the body td both derive from it, so a header
// always sits directly above its digits. Root cause of the owner's misalignment:
// the header hardcoded `r` while the body keyed on `col.align`, so a numeric
// column with no explicit `align` rendered header=right / body=left. `align:'l'`
// opts a column back to left for BOTH header and body, in lockstep.
const alignClass = (col: ColumnDef): string => (col.align === 'l' ? '' : 'r')

export function PivotTable({ rows, colLabel, columns, caption, footer, footerLabel, seriesFormat, seriesOrder, onRowSelect, selectedIds }: PivotTableProps) {
  // Preserve source order (first appearance) — respects pipeline sort steps
  const labels    = [...new Map(rows.map((r) => [r.label, true])).keys()]
  const allSeries = [...new Map(rows.map((r) => [r.series ?? '', true])).keys()]
  const series    = seriesOrder
    ? [...seriesOrder.filter((s) => allSeries.includes(s)), ...allSeries.filter((s) => !seriesOrder.includes(s))]
    : allSeries

  const cellMap   = new Map(rows.map((r) => [`${r.label}::${r.series ?? ''}`, r]))
  const cell      = (label: string, s: string) => cellMap.get(`${label}::${s}`)

  // ── Cross-filter on the SERIES axis (the pivot's selectable member) ──────────
  //  A column header becomes a keyboard-operable selection control ONLY when
  //  onRowSelect is supplied (node declares `on`) — WCAG 2.1 AA, mirroring
  //  SimpleTable's row affordance. The emitted datum is a representative row of the
  //  series (first non-total cell), whose `id` identifies the series member; the
  //  shared handler reads it exactly as it reads a SimpleTable row's id (SSOT).
  //  Absent onRowSelect ⇒ a plain, inert header (no regression for read-only pivots).
  const seriesRep = (s: string): DataRow | undefined =>
    rows.find((r) => (r.series ?? '') === s && !r.isTotal && !r.isSeparator)
  const seriesSelected = (s: string): boolean => {
    const rep = seriesRep(s)
    return rep?.id != null && selectedIds != null && selectedIds.includes(String(rep.id))
  }
  const seriesSelectProps = (s: string): Record<string, unknown> => {
    if (!onRowSelect) return {}
    const rep = seriesRep(s)
    if (!rep) return {}
    return {
      onClick:        () => onRowSelect(rep),
      onKeyDown:      (e: KeyboardEvent<HTMLTableCellElement>) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onRowSelect(rep) }
      },
      tabIndex:       0,
      role:           'button',
      'aria-pressed': seriesSelected(s),
    }
  }
  const seriesSelectClass = (s: string): string =>
    !onRowSelect ? '' : [
      'data-table__col--selectable',
      seriesSelected(s) ? 'data-table__col--selected' : '',
    ].filter(Boolean).join(' ')
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
    <div className="data-table__wrap scroll-fancy">
      <table className="data-table" aria-label={caption}>
        {caption && <caption className="data-table__caption">{caption}</caption>}
        <thead>
          {multiCol ? (
            <>
              {/* Row 1 — series group headers */}
              <tr>
                <th scope="col" rowSpan={2} style={{ width: '30%' }}>{colLabel}</th>
                {series.map((s) => (
                  <th
                    key={s}
                    scope="colgroup"
                    colSpan={columns.length}
                    className={`r t-col-group ${seriesSelectClass(s)}`.trim()}
                    {...seriesSelectProps(s)}
                  >
                    {s}
                  </th>
                ))}
              </tr>
              {/* Row 2 — sub-column labels */}
              <tr>
                {series.flatMap((s) =>
                  columns.map((col) => (
                    <th key={`${s}-${col.key}`} scope="col" className={`${alignClass(col)} t-col-sub`.trim()}>
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
              {/* Flat pivot: one column per series, so the series header aligns to
                  that single column — SAME source as its body cells (SSOT). */}
              {series.map((s) => (
                <th
                  key={s}
                  scope="col"
                  className={`${columns[0] ? alignClass(columns[0]) : 'r'} ${seriesSelectClass(s)}`.trim()}
                  {...seriesSelectProps(s)}
                >
                  {s}
                </th>
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
                      <td key={`${s}-${col.key}`} className={`t-num ${alignClass(col)}`.trim()}>
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
                    <td key={`${s}-${col.key}`} className={`t-num ${alignClass(col)}`.trim()}>
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
