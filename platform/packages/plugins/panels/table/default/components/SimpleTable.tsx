// ── Mode A: SimpleTable ───────────────────────────────────────────────

import type { KeyboardEvent }      from 'react'
import type { DataRow, ColumnDef } from '@statdash/engine'
import type { AggType }            from './_footer'
import { getCellValue, colFmt }    from './_helpers'
import { computeAggregate, defaultFooterLabel } from './_footer'
import { StatusBadge, accentStyle } from '@statdash/react'
import { MappedCell }               from './MappedCell'

export interface SimpleTableProps {
  rows:              DataRow[]
  colLabel:          string
  columns:           ColumnDef[]
  indent:            boolean
  statusFlags:       boolean
  caption?:          string
  footer?:           Record<string, AggType>
  footerLabel?:      string
  highlightedLabel?: string
  /** Cross-filter row-select — present only when the node declares `on`. */
  onRowSelect?:      (row: DataRow) => void
  /** Currently-selected row ids (row.id) for aria-selected. */
  selectedIds?:      string[]
}

export function SimpleTable({ rows, colLabel, columns, indent, statusFlags, caption, footer, footerLabel, highlightedLabel, onRowSelect, selectedIds }: SimpleTableProps) {
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
    <div className="data-table__wrap scroll-fancy">
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
                {/* col.label is pre-resolved to the active locale by DataTable */}
                {col.label as string}
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
                    <span className="t-separator-dot" style={row.color ? { background: row.color } : undefined} />
                    {row.label}
                  </td>
                </tr>
              )
            }

            const labelStyle = indent && row.level
              ? { paddingLeft: `calc(${row.level} * 1.25rem + 1.25rem)` }
              : undefined

            const isHighlighted = !row.isTotal && highlightedLabel != null && row.label === highlightedLabel
            // Cross-filter row-select — a data row becomes a keyboard-operable
            // selection control ONLY when onRowSelect is supplied (node declares
            // `on`). WCAG 2.1 AA: focusable (tabIndex 0), Enter/Space activate,
            // aria-selected reflects the current selection. Totals are never
            // selectable. Absent onRowSelect ⇒ a plain, inert row (no regression).
            const isSelectable = !!onRowSelect && !row.isTotal
            const isSelected   = isSelectable && selectedIds != null && row.id != null && selectedIds.includes(String(row.id))
            const selectProps  = isSelectable
              ? {
                  onClick:    () => onRowSelect!(row),
                  onKeyDown:  (e: KeyboardEvent<HTMLTableRowElement>) => {
                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onRowSelect!(row) }
                  },
                  tabIndex:      0,
                  role:          'button',
                  'aria-pressed': isSelected,
                }
              : {}
            return (
              <tr
                key={row.id}
                {...selectProps}
                className={[
                  row.isTotal ? 'total' : '',
                  isHighlighted ? 'data-table__row--highlighted' : '',
                  isSelectable ? 'data-table__row--selectable' : '',
                  isSelected ? 'data-table__row--selected' : '',
                ].filter(Boolean).join(' ')}
              >
                <th scope="row" style={labelStyle}>
                  {!row.isTotal && (
                    <span className="t-dot" aria-hidden="true" style={row.color ? { background: row.color } : undefined} />
                  )}
                  {row.label}
                  {statusFlags && (
                    <StatusBadge status={row.provenance?.status ?? row.status} />
                  )}
                </th>
                {columns.map((col) => {
                  const val = getCellValue(row, col.key)
                  if (!col.bar) {
                    return (
                      <td key={col.key} className={`t-num${col.align === 'r' ? ' r' : ''}`}>
                        {col.valueMappings?.length
                          ? <MappedCell value={val} mappings={col.valueMappings} fallback={colFmt(col)(val)} />
                          : colFmt(col)(val)}
                      </td>
                    )
                  }
                  const { min, max } = barScale[col.key] ?? { min: 0, max: 1 }
                  return (
                    <td key={col.key}>
                      {row.isTotal ? (
                        <span className="bar-pct" style={{ color: 'var(--color-text-primary)' }}>{colFmt(col)(val)}</span>
                      ) : (
                        <div className="bar-cell" style={accentStyle(row.color)}>
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
