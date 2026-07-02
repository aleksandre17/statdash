// ── PanelLayout — generic collapsible panel card ──────────────────────
//
//  Framework primitive in engine/react. Zero app-specific strings or colours.
//
//  Responsibilities:
//    · Title + optional label + optional subtitle
//    · Collapse/expand with WCAG 2.1 AA keyboard support
//    · Optional role-based view toggle — the ONE view-toggle mechanism
//      (useViewToggle). PanelLayout is CONTROLLED: the caller owns the active
//      role (persisted via useViewToggle) and toggles child visibility with
//      resolveViewState; PanelLayout only renders the button group. It does NOT
//      switch children by index (the retired bespoke path) — all children stay
//      mounted so toggling is instant + a11y-safe, exactly like the section shell.
//    · --sc CSS custom property set on root only when color prop is provided
//    · Optional actions slot (export bar, info button, …)
//
//  Intentionally NOT in this component:
//    · i18n — all visible strings come from the caller via props
//    · Data awareness — structural container only
//
//  CSS: ./PanelLayout.css (co-located — DESIGN-styles-arch §2.1)
//
import './PanelLayout.css'
import type { BodyStyleAttrs } from '@statdash/styles'
import { useState, type CSSProperties, type ReactNode, type ComponentType } from 'react'
import { ChevronIcon } from './icons'
import { InjectionToken } from '../engine/di/InjectionToken'

/**
 * Controlled, role-based view-toggle descriptor. The caller (a shell) derives
 * this from `useViewToggle` — the single view-toggle mechanism — and pre-resolves
 * the per-role labels to concrete strings, so PanelLayout stays i18n-free (it
 * renders whatever strings it is handed). PanelLayout owns NO toggle state.
 */
export interface PanelViewToggle {
  /** Distinct, declaration-ordered roles. Toggle renders only when length >= 2. */
  roles:      string[]
  /** role → already-locale-resolved label. */
  labels:     Record<string, string>
  /** The active role (from useViewToggle). */
  active:     string | undefined
  /** Persist a new active role (useViewToggle.setActiveRole). */
  onSelect:   (role: string) => void
  /** aria-label for the toggle group — caller provides the translated string. */
  ariaLabel?: string
}

export interface PanelLayoutProps {
  id?:               string
  title:             string
  label?:            string
  subtitle?:         string
  /** When provided sets --sc on the root element; absent = inherits cascade. */
  color?:            string
  defaultOpen?:      boolean
  noCollapse?:       boolean
  children:          ReactNode
  // ── View toggle (role-based, controlled — the ONE mechanism) ────────
  /** Role-based toggle from useViewToggle. Button group shown only when >= 2 roles. */
  viewToggle?:       PanelViewToggle
  // ── Actions slot ───────────────────────────────────────────────────
  /** Rendered inside the header actions area (export bar, info button, …). */
  actions?:          ReactNode
  // ── Title badge slot ───────────────────────────────────────────────
  /** Optional badge(s) rendered next to the title — from extension points. */
  titleBadge?:       ReactNode
  // ── Body attrs ─────────────────────────────────────────────────────
  /**
   * Style attrs spread onto .panel__body — carries data-height from applyNodeStyles.
   * Pass vs.body from defineShell so the height token lands on the body element only.
   */
  bodyProps?: BodyStyleAttrs
}

export const PANEL_LAYOUT = new InjectionToken<ComponentType<PanelLayoutProps>>('panel-layout')

export function PanelLayout({
  id,
  title,
  label,
  subtitle,
  color,
  defaultOpen   = true,
  noCollapse    = false,
  children,
  viewToggle,
  actions,
  titleBadge,
  bodyProps,
}: PanelLayoutProps) {
  const [open, setOpen] = useState(defaultOpen)

  const canCollapse = !noCollapse
  const bodyId      = id ? `${id}-body` : undefined

  const showToggle = (viewToggle?.roles.length ?? 0) >= 2

  const rootStyle: CSSProperties | undefined = color
    ? ({ '--sc': color } as CSSProperties)
    : undefined

  return (
    <div
      className="panel"
      id={id}
      style={rootStyle}
    >
      {/* ── Header ──────────────────────────────────────────────── */}
      <div
        className={`panel__head${open ? ' open' : ''}`}
        onClick={() => canCollapse && setOpen(o => !o)}
        onKeyDown={(e) => {
          if (canCollapse && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault()
            setOpen(o => !o)
          }
        }}
        role={canCollapse ? 'button' : undefined}
        tabIndex={canCollapse ? 0 : undefined}
        aria-expanded={canCollapse ? open : undefined}
        aria-controls={canCollapse && bodyId ? bodyId : undefined}
        style={{ cursor: canCollapse ? 'pointer' : 'default' }}
      >
        <span className="panel__accent" aria-hidden="true" />

        <div className="panel__title-wrap">
          <div className="panel__title-row">
            <span className="panel__title">{title}</span>
            {titleBadge && <span className="panel__title-badge">{titleBadge}</span>}
          </div>
          {label    && <div className="panel__label">{label}</div>}
          {subtitle && <div className="panel__subtitle">{subtitle}</div>}
        </div>

        {/* Actions: role-based view toggle + caller actions slot */}
        <div className="panel__actions" onClick={(e) => e.stopPropagation()}>
          {showToggle && viewToggle && (
            <div
              className="panel__view-toggle"
              role="group"
              aria-label={viewToggle.ariaLabel ?? 'Toggle view'}
            >
              {viewToggle.roles.map((r) => (
                <button
                  key={r}
                  className={`panel__view-btn${viewToggle.active === r ? ' active' : ''}`}
                  onClick={() => viewToggle.onSelect(r)}
                  type="button"
                  aria-pressed={viewToggle.active === r}
                >
                  <span>{viewToggle.labels[r] ?? r}</span>
                </button>
              ))}
            </div>
          )}
          {actions}
        </div>

        {canCollapse && (
          <ChevronIcon className={`panel__chevron${open ? ' open' : ''}`} />
        )}
      </div>

      {/* ── Body ────────────────────────────────────────────────────
          All children stay mounted; the caller hides inactive views via
          resolveViewState (data-view). PanelLayout never switches by index. */}
      {(noCollapse || open) && (
        <div className="panel__body" id={bodyId} {...bodyProps}>
          {children}
        </div>
      )}
    </div>
  )
}
