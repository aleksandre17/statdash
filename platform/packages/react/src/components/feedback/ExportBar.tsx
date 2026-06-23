// ── ExportBar [N16] ─────────────────────────────────────────────────────
//
//  Accessible download bar — one button per registered export format.
//  Renders nothing when rows are empty or no formats are registered,
//  so callers need no conditional guard.
//
import './feedback.css'
import type { ComponentType } from 'react'
import { useExport }                  from '../../engine/hooks/useExport'
import { useT }                       from '../../context/SiteContext'
import type { DataRow, ExportMeta }   from '@statdash/engine'
import { InjectionToken } from '../../engine/di/InjectionToken'

export const EXPORT_BAR = new InjectionToken<ComponentType<ExportBarProps>>('export-bar')

export interface ExportBarProps {
  rows:      DataRow[]
  meta:      ExportMeta
  /** Optional extra CSS class on the container. */
  className?: string
  /**
   * Optional bus-aware export callback.
   * When provided, called on button click instead of (or in addition to) the
   * internal download logic, so shells can dispatch `data:export` commands.
   * When absent, the internal `useExport` download runs as before (backward compat).
   */
  onExport?: (format: 'csv' | 'xlsx') => void
}

export function ExportBar({ rows, meta, className, onExport }: ExportBarProps) {
  const t                     = useT('feedback')
  const { formats, exportAs } = useExport(rows, meta)
  if (formats.length === 0 || rows.length === 0) return null

  const handleClick = (fmt: 'csv' | 'xlsx') => {
    if (onExport) {
      onExport(fmt)
    } else {
      exportAs(fmt)
    }
  }

  return (
    <div
      className={`export-bar${className ? ` ${className}` : ''}`}
      role="toolbar"
      aria-label={t('export.toolbar')}
    >
      {formats.map(fmt => (
        <button
          key={fmt}
          type="button"
          className="export-bar__btn"
          aria-label={t('export.download', { fmt: fmt.toUpperCase() })}
          onClick={() => handleClick(fmt as 'csv' | 'xlsx')}
        >
          {'↓'} {fmt.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
