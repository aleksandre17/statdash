// ── Footer aggregate computation — package-private ─────────────────────
//
//  IMF/Eurostat pattern: table declares aggregate per column key.
//  Renderer computes — data layer unchanged.
//
//  'sum'  → Σ(dataRows)        rendered with col.format
//  'avg'  → Σ / n              rendered with col.format
//  'cagr' → (last/first)^(1/(n-1))−1  rendered as sign_pct (always %)
//

import type { DataRow, ColumnDef } from '@geostat/engine'
import { getFormatter }            from '@geostat/engine'
import { getCellValue, colFmt }    from './_helpers'

export type AggType = 'sum' | 'avg' | 'cagr'

export function computeAggregate(col: ColumnDef, dataRows: DataRow[], aggType: AggType): string | null {
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
export function defaultFooterLabel(footer: Record<string, AggType>): string {
  const types = [...new Set(Object.values(footer))]
  if (types.length === 1) {
    if (types[0] === 'sum')  return 'სულ'
    if (types[0] === 'avg')  return 'საშუალო'
    if (types[0] === 'cagr') return 'CAGR'
  }
  return 'სულ / საშუალო'
}

// OBS_STATUS labels moved to @geostat/engine OBS_STATUS_LABELS [N14].
// StatusBadge component in @geostat/react is the shared rendering surface.
