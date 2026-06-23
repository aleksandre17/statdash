import './feedback.css'
import type { ComponentType, ReactNode } from 'react'
import { useT } from '../../context/SiteContext'
import { InjectionToken } from '../../engine/di/InjectionToken'

// ── EmptyState — no-data result ───────────────────────────────────────
//
//  Shared, app-agnostic feedback component (engine/react layer). Used by
//  every data panel shell (chart/table/map) when interpretSpec returns [].
//
//  i18n: default title/desc come from the 'feedback' namespace (registered
//  in ./i18n.ts, imported by the feedback barrel). Callers may override any
//  of icon/title/desc — an explicit string wins over the translated default
//  (Principle of Least Astonishment: a passed prop is never silently ignored).
//
//  Icon: inline SVG (currentColor) — not an emoji. SVG is cross-platform
//  deterministic, scales cleanly, and inherits .empty-state colour. The
//  default is an "empty inbox / no-rows" glyph; callers may pass any ReactNode.
//

export const EMPTY_STATE = new InjectionToken<ComponentType<EmptyStateProps>>('empty-state')

export interface EmptyStateProps {
  /** Custom icon node — overrides the default SVG glyph. */
  icon?:  ReactNode
  /** Overrides the translated default title. */
  title?: string
  /** Overrides the translated default description. */
  desc?:  string
}

function DefaultEmptyIcon(): ReactNode {
  // 24×24 "empty data tray" glyph — strokes use currentColor so the icon
  // inherits .empty-state colour and high-contrast theme overrides.
  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M3 14l2.5-8.5A1.5 1.5 0 0 1 6.94 4h10.12a1.5 1.5 0 0 1 1.44 1.5L21 14" />
      <path d="M3 14h5l1.2 2.4a1 1 0 0 0 .9.6h3.8a1 1 0 0 0 .9-.6L16 14h5v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4z" />
    </svg>
  )
}

export function EmptyState({ icon, title, desc }: EmptyStateProps): ReactNode {
  const t = useT('feedback')

  const resolvedTitle = title ?? t('empty.title')
  const resolvedDesc  = desc  ?? t('empty.desc')

  return (
    <div className="empty-state" role="status">
      <div className="empty-state__icon">{icon ?? <DefaultEmptyIcon />}</div>
      <p className="empty-state__title">{resolvedTitle}</p>
      {resolvedDesc && <p className="empty-state__desc">{resolvedDesc}</p>}
    </div>
  )
}
