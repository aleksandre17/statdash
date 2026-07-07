// ── ExportMenu [N16] ─────────────────────────────────────────────────────
//
//  Compact download control: ONE icon button (WAI-ARIA menu button) that opens a
//  role="menu" of the registered export formats. Replaces the former
//  one-button-per-format `.export-bar` toolbar — the admin's "takes too much
//  space" clutter (dozens of format buttons per page) collapses to a single icon
//  per scope, rendered alongside the section header's other icon controls.
//
//  The download logic is UNCHANGED: selecting a format calls onExport(fmt) (the
//  `data:export` bus path the shells use) or, standalone, the internal
//  useExport().exportAs — the SAME `downloadExport` seam (CSV BOM / xlsx OOXML
//  preserved). This component owns UI + a11y ONLY, never serialization.
//
//  A11Y — WAI-ARIA menu button pattern (WCAG 2.1 AA):
//    • trigger <button aria-haspopup="menu" aria-expanded aria-label> (localized)
//    • Enter / Space / ArrowDown open + focus the first item (Enter/Space via the
//      native button click; ArrowDown/ArrowUp via keydown), Escape closes and
//      returns focus to the trigger, ArrowUp/Down roving, Home/End, Tab closes,
//      click-outside closes.
//    • role="menu" / role="menuitem" — one item per registered format.
//    • The glyph (arrow into a tray) is aria-hidden; token-driven currentColor.
//
import './feedback.css'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type { ComponentType, KeyboardEvent } from 'react'
import { useExport }                  from '../../engine/hooks/useExport'
import { useT }                       from '../../context/SiteContext'
import type { DataRow, ExportMeta, ExportFormatId } from '@statdash/engine'
import { InjectionToken } from '../../engine/di/InjectionToken'

export const EXPORT_MENU = new InjectionToken<ComponentType<ExportMenuProps>>('export-menu')

export interface ExportMenuProps {
  rows:      DataRow[]
  meta:      ExportMeta
  /** Optional extra CSS class on the (relative) root wrapper. */
  className?: string
  /**
   * CSS class for the trigger BUTTON. Lets a host render the icon in its own
   * sibling-icon style — the section header passes `section__icon-btn` so the
   * download glyph matches the copy-link / info icons exactly. Defaults to the
   * component's own `.export-menu__trigger` (used by standalone panels).
   */
  triggerClassName?: string
  /**
   * Optional bus-aware export callback (see ExportBarProps history): when
   * provided, called on item click instead of the internal download, so shells
   * dispatch `data:export` on the bus. When absent, the internal `useExport`
   * download runs (backward compat). `format` is a registry id — the registry is
   * the SSOT.
   */
  onExport?: (format: ExportFormatId) => void
}

/** Download glyph — arrow into a tray. Token-driven (currentColor), sized to the
 *  sibling header icons (13px). Purely decorative → aria-hidden. */
function DownloadIcon() {
  return (
    <svg
      width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3v12" />
      <path d="M7 11l5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  )
}

export function ExportMenu({ rows, meta, className, triggerClassName, onExport }: ExportMenuProps) {
  const t                     = useT('feedback')
  const { formats, exportAs } = useExport(rows, meta)

  const [open, setOpen] = useState(false)
  const rootRef    = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const itemRefs   = useRef<(HTMLButtonElement | null)[]>([])
  const menuId     = useId()

  const closeAndReturn = useCallback(() => {
    setOpen(false)
    triggerRef.current?.focus()
  }, [])

  const choose = useCallback((fmt: ExportFormatId) => {
    if (onExport) onExport(fmt)
    else exportAs(fmt)
    setOpen(false)
    triggerRef.current?.focus()
  }, [onExport, exportAs])

  // Focus the first item when the menu opens (keyboard + mouse both land here).
  useEffect(() => {
    if (open) itemRefs.current[0]?.focus()
  }, [open])

  // Click-outside closes (no focus return — the pointer moved the intent away).
  useEffect(() => {
    if (!open) return
    const onDocPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDocPointer)
    return () => document.removeEventListener('pointerdown', onDocPointer)
  }, [open])

  // Guard AFTER all hooks (hook-order stability): nothing to export ⇒ render
  // nothing, so callers need no conditional wrapper.
  if (formats.length === 0 || rows.length === 0) return null

  const onTriggerKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    // Enter/Space open via the native button click; ArrowDown/Up open here.
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      setOpen(true)
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  const onItemKeyDown = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const last = formats.length - 1
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); itemRefs.current[i === last ? 0 : i + 1]?.focus(); break
      case 'ArrowUp':   e.preventDefault(); itemRefs.current[i === 0 ? last : i - 1]?.focus(); break
      case 'Home':      e.preventDefault(); itemRefs.current[0]?.focus(); break
      case 'End':       e.preventDefault(); itemRefs.current[last]?.focus(); break
      case 'Escape':    e.preventDefault(); closeAndReturn(); break
      case 'Tab':       setOpen(false); break // let Tab move focus out naturally
    }
  }

  return (
    <div className={`export-menu${className ? ` ${className}` : ''}`} ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className={triggerClassName ?? 'export-menu__trigger'}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={t('export.toolbar')}
        title={t('export.toolbar')}
        onClick={() => setOpen(o => !o)}
        onKeyDown={onTriggerKeyDown}
      >
        <DownloadIcon />
      </button>
      {open && (
        <div id={menuId} role="menu" className="export-menu__list" aria-label={t('export.toolbar')}>
          {formats.map((fmt, i) => (
            <button
              key={fmt}
              ref={el => { itemRefs.current[i] = el }}
              type="button"
              role="menuitem"
              tabIndex={-1}
              className="export-menu__item"
              onClick={() => choose(fmt as ExportFormatId)}
              onKeyDown={e => onItemKeyDown(e, i)}
            >
              {t('export.download', { fmt: fmt.toUpperCase() })}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
