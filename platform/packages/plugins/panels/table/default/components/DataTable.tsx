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

import type { DataRow }                        from '@statdash/engine'
import type { ColumnDef, TableConfig }         from '@statdash/engine'
import { SimpleTable }                         from './SimpleTable'
import { PivotTable }                          from './PivotTable'

// ── DataTable (public) ────────────────────────────────────────────────

export default function DataTable({
  rows,
  colLabel    = 'კომპონენტი',
  columns,
  valueLabel  = 'მლნ ₾',
  // color omitted — CSS var(--sc) cascades from page/section wrapper
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
        indent={indent ?? false}
        statusFlags={statusFlags ?? false}
        caption={caption}
        footer={footer}
        footerLabel={footerLabel}
        highlightedLabel={highlightedLabel}
      />
}
