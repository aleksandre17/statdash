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
import { type CSSProperties, type ReactNode, type ComponentType } from 'react'
import { ChevronIcon } from './icons'
import { InjectionToken } from '../engine/di/InjectionToken'
import { useCollapsible } from '../engine/hooks/useCollapsible'

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
  // ── Collapse-toggle labels (i18n carriers) ─────────────────────────
  /**
   * aria-label for the chevron toggle button per state. PanelLayout is i18n-free,
   * so the caller (a shell) supplies already-locale-resolved strings. When absent
   * a neutral framework fallback is used (parity with viewToggle.ariaLabel).
   */
  collapseLabel?:    string
  expandLabel?:      string
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
  collapseLabel,
  expandLabel,
  bodyProps,
}: PanelLayoutProps) {
  // The ONE collapse mechanism (shared with the section shell): open state +
  // the chevron-button a11y contract. The header itself is inert — only the
  // chevron toggles (no whole-header false click target).
  const { open, canCollapse, toggleProps } = useCollapsible(defaultOpen, noCollapse)

  const bodyId = id ? `${id}-body` : undefined

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
      {/* ── Header ────────────────────────────────────────────────
          Inert container: the header no longer toggles on click (that stole
          clicks meant for the title/actions and collapsed by accident). The
          sole collapse trigger is the chevron button below. */}
      <div className={`panel__head${open ? ' open' : ''}`}>
        <span className="panel__accent" aria-hidden="true" />

        <div className="panel__title-wrap">
          <div className="panel__title-row">
            <span className="panel__title">{title}</span>
            {titleBadge && <span className="panel__title-badge">{titleBadge}</span>}
          </div>
          {label    && <div className="panel__label">{label}</div>}
          {subtitle && <div className="panel__subtitle">{subtitle}</div>}
        </div>

        {/* Actions: role-based view toggle + caller actions slot. No
            stopPropagation needed — the header is inert (only the chevron toggles). */}
        <div className="panel__actions">
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

        {/* Sole collapse trigger — a real, labelled button (native Enter/Space +
            focus). aria-expanded reflects state; aria-controls points at the body. */}
        {canCollapse && toggleProps && (
          <button
            className={`panel__chevron-btn${open ? ' open' : ''}`}
            aria-label={(open ? collapseLabel : expandLabel) ?? 'Toggle panel'}
            aria-controls={bodyId}
            {...toggleProps}
          >
            <ChevronIcon className="panel__chevron" />
          </button>
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
