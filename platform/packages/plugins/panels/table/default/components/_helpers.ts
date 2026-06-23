// ── Table helpers — package-private (do not import outside this folder) ─

import type { DataRow, ColumnDef } from '@statdash/engine'
import { getFormatter }            from '@statdash/engine'

export const defaultFmt = (n: number) => {
  const abs = Math.abs(n), neg = n < 0 ? '-' : ''
  const s = abs.toFixed(1).replace(/\.?0+$/, '')
  const [int, dec] = s.split('.')
  return neg + int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + (dec ? '.' + dec : '')
}

export function getCellValue(row: DataRow, key: string): number {
  if (key === 'value') return row.value
  if (key === 'pct')   return row.pct ?? 0
  return Number((row as unknown as Record<string, unknown>)[key] ?? 0)
}

export function colFmt(col: ColumnDef): (n: number) => string {
  return col.format ? getFormatter(col.format) : defaultFmt
}
