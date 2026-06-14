import '../section.css'

// ── SectionBlock — section wrapper with collapse + generic view toggle ──
//
//  Pure UI component: title, collapse, export, and an index-based view toggle.
//
//  View toggle (chart/table switch):
//    Generic: toggles between N children by index — not hardcoded to chart/table.
//    showToggle=true + children.length > 1 → toggle buttons are shown.
//    defaultViewIndex=0 → first child (chart) | defaultViewIndex=1 → second (table).
//    Children arrive pre-rendered from engine via SectionRenderer.
//
//  This component is intentionally unaware of child types.
//  The toggle convention (0=chart icon, 1=table icon) matches the engine
//  manifest order: ['chart', 'table', 'tabs'].
//

import React, { useState } from 'react'

interface SectionBlockProps {
  id:               string
  title:            string
  subtitle?:        string
  /** Dynamic label rendered inside section__title-wrap, between title and subtitle (e.g. selected region name) */
  label?:           string
  color?:           string
  defaultOpen?:     boolean
  noCollapse?:      boolean
  hero?:            boolean
  compact?:         boolean
  /**
   * Index of the default active child view.
   * 0 = first child (chart) — default
   * 1 = second child (table)
   * Matches engine manifest order: ['chart', 'table', 'tabs'].
   */
  defaultViewIndex?: number
  /** Show the chart/table toggle buttons — only visible when children.length > 1 */
  showToggle?:      boolean
  onExport?:        () => void
  children:         React.ReactNode
}

export default function SectionBlock({
  id,
  title,
  subtitle,
  color = '#0080BE',
  label,
  defaultOpen = true,
  noCollapse = false,
  hero = false,
  compact = false,
  defaultViewIndex = 0,
  showToggle = true,
  onExport,
  children,
}: SectionBlockProps) {
  const [open,      setOpen]      = useState(defaultOpen)
  const [activeIdx, setActiveIdx] = useState(defaultViewIndex)

  const canCollapse = !noCollapse
  const bodyId      = `${id}-body`

  // Flatten children to array for index-based toggle
  const childArray = React.Children.toArray(children)
  const canToggle  = showToggle && childArray.length > 1

  return (
    <div
      className={`section${hero ? ' section--hero' : ''}${compact ? ' section--compact' : ''}`}
      id={id}
      style={{ '--sc': color } as React.CSSProperties}
    >
      <div
        className={`section__head ${open ? 'open' : ''}`}
        onClick={() => canCollapse && setOpen((o) => !o)}
        onKeyDown={(e) => { if (canCollapse && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setOpen((o) => !o) } }}
        role={canCollapse ? 'button' : undefined}
        tabIndex={canCollapse ? 0 : undefined}
        aria-expanded={canCollapse ? open : undefined}
        aria-controls={canCollapse ? bodyId : undefined}
        style={{ cursor: canCollapse ? 'pointer' : 'default' }}
      >
        <span className="section__accent" />

        <div className="section__title-wrap">
          <div className="section__title">{title}</div>
          {label    && <div className="section__label">{label}</div>}
          {subtitle && <div className="section__subtitle">{subtitle}</div>}
        </div>

        <div className="section__actions" onClick={(e) => e.stopPropagation()}>
          {canToggle && (
            <div className="section__view-toggle" role="group" aria-label="ხედის გადართვა">
              <button
                className={`section__view-btn ${activeIdx === 0 ? 'active' : ''}`}
                onClick={() => setActiveIdx(0)}
                type="button"
                title="დიაგრამა"
                aria-pressed={activeIdx === 0}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="2" y="10" width="4" height="11" rx="1"/>
                  <rect x="9" y="6" width="4" height="15" rx="1"/>
                  <rect x="16" y="2" width="4" height="19" rx="1"/>
                </svg>
                <span>დიაგრამა</span>
              </button>
              <button
                className={`section__view-btn ${activeIdx === 1 ? 'active' : ''}`}
                onClick={() => setActiveIdx(1)}
                type="button"
                title="ცხრილი"
                aria-pressed={activeIdx === 1}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                  <line x1="3" y1="9" x2="21" y2="9"/>
                  <line x1="3" y1="15" x2="21" y2="15"/>
                  <line x1="9" y1="3" x2="9" y2="21"/>
                </svg>
                <span>ცხრილი</span>
              </button>
            </div>
          )}

          {onExport && (
            <button className="section__icon-btn" title="ექსპორტი" onClick={onExport} type="button" aria-label="ექსპორტი">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
              </svg>
            </button>
          )}
          <button className="section__icon-btn" title="ინფორმაცია" type="button" aria-label="ინფორმაცია">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>
            </svg>
          </button>
        </div>

        {canCollapse && (
          <svg
            className={`section__chevron ${open ? 'open' : ''}`}
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M6 9l6 6 6-7"/>
          </svg>
        )}
      </div>

      {(noCollapse || open) && (
        <div className="section__body" id={bodyId}>
          {canToggle ? (childArray[activeIdx] ?? childArray[0]) : children}
        </div>
      )}
    </div>
  )
}