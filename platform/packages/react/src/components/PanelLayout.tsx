// ── PanelLayout — generic collapsible panel card ──────────────────────
//
//  Framework primitive in engine/react. Zero app-specific strings or colours.
//
//  Responsibilities:
//    · Title + optional label + optional subtitle
//    · Collapse/expand with WCAG 2.1 AA keyboard support
//    · Optional index-based view toggle (N views, caller supplies label + optional icon)
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
import React, { useState, type CSSProperties, type ReactNode, type ComponentType } from 'react'
import { ChevronIcon } from './icons'
import { InjectionToken } from '../engine/di/InjectionToken'

export interface PanelView {
  label: string
  icon?: ReactNode
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
  // ── View toggle ────────────────────────────────────────────────────
  /** Toggle shown only when length >= 2. icon is optional; text-only when absent. */
  views?:            PanelView[]
  defaultViewIndex?: number
  /** aria-label for the toggle group — caller provides translated string. */
  viewToggleLabel?:  string
  // ── Actions slot ───────────────────────────────────────────────────
  /** Rendered inside the header actions area (export bar, info button, …). */
  actions?:          ReactNode
  // ── Title badge slot ───────────────────────────────────────────────
  /** Optional badge(s) rendered next to the title — from extension points. */
  titleBadge?:       ReactNode
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
  views,
  defaultViewIndex = 0,
  viewToggleLabel  = 'Toggle view',
  actions,
  titleBadge,
}: PanelLayoutProps) {
  const [open,      setOpen]      = useState(defaultOpen)
  const [activeIdx, setActiveIdx] = useState(defaultViewIndex)

  const canCollapse = !noCollapse
  const bodyId      = id ? `${id}-body` : undefined

  const showToggle = (views?.length ?? 0) >= 2
  const childArray = React.Children.toArray(children)

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

        {/* Actions: view toggle + caller actions slot */}
        <div className="panel__actions" onClick={(e) => e.stopPropagation()}>
          {showToggle && views && (
            <div
              className="panel__view-toggle"
              role="group"
              aria-label={viewToggleLabel}
            >
              {views.map((view, i) => (
                <button
                  key={i}
                  className={`panel__view-btn${activeIdx === i ? ' active' : ''}`}
                  onClick={() => setActiveIdx(i)}
                  type="button"
                  aria-pressed={activeIdx === i}
                >
                  {view.icon && <span aria-hidden="true">{view.icon}</span>}
                  <span>{view.label}</span>
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

      {/* ── Body ────────────────────────────────────────────────── */}
      {(noCollapse || open) && (
        <div className="panel__body" id={bodyId}>
          {showToggle
            ? (childArray[activeIdx] ?? childArray[0])
            : children
          }
        </div>
      )}
    </div>
  )
}
