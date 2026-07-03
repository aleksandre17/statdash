// ── SectionHeader — section card header ───────────────────────────────
//
//  Thin presentational header: accent bar, title/label/subtitle stack, and
//  the actions cluster (view toggle · extension actions · methodology
//  toggle) plus the collapse chevron. All collapse a11y/keyboard behavior
//  arrives pre-bundled via `headProps` (useCollapsible); the actions cluster
//  stops click propagation so action clicks never toggle the section.
//

import { Fragment }       from 'react'
import type { ReactNode } from 'react'
import { InfoIcon, ChevronIcon, useResolveLocale } from '@statdash/react'
import type { CollapsibleHeadProps, ViewToggle } from '@statdash/react/engine'

type T = (key: string) => string

export interface SectionHeaderProps {
  headProps:    CollapsibleHeadProps
  open:         boolean
  canCollapse:  boolean
  title:        string
  label?:       string
  subtitle?:    string
  viewToggle:   ViewToggle
  actions:      ReactNode[]
  /** Truthy when the section authored a methodology block (toggle renders). */
  hasMethodology: boolean
  infoOpen:     boolean
  onToggleInfo: () => void
  t:            T
}

export function SectionHeader({
  headProps,
  open,
  canCollapse,
  title,
  label,
  subtitle,
  viewToggle,
  actions,
  hasMethodology,
  infoOpen,
  onToggleInfo,
  t,
}: SectionHeaderProps) {
  // The info disclosure opens the section's authored methodology (source,
  // last-updated, notes). Data-integrity status is now a PAGE-level summary
  // (AR-40) — not a per-section indicator here.
  const hasDisclosure = hasMethodology
  const { showToggle, roles, roleLabels, activeRole, setActiveRole } = viewToggle
  // role labels are i18n carriers (authored view.label may be bilingual) — resolve
  // each to the active locale at this render boundary.
  const resolveLocale = useResolveLocale()

  return (
    <div className={`section__head${open ? ' open' : ''}`} {...headProps}>
      <span className="section__accent" />
      <div className="section__title-wrap">
        <div className="section__title">{title}</div>
        {label    && <div className="section__label">{label}</div>}
        {subtitle && <div className="section__subtitle">{subtitle}</div>}
      </div>
      {/* Control-row order is intentional (WCAG / Principle of Least Astonishment):
          the PASSIVE "about this data" affordances are grouped FIRST — (1) the
          extension links, (2) the info disclosure — and the INTERACTIVE "how to
          view it" control (the chart↔table view toggle) is separated LAST. DOM
          order = tab order, so keyboard users traverse metadata → view control in
          that same left-to-right grouping. (Data-integrity status is now a
          page-level summary, AR-40 — no per-section indicator here.) */}
      <div className="section__actions" onClick={(e) => e.stopPropagation()}>
        {/* (1) link — extension actions (permalink, export, …) */}
        {actions.map((action, i) => (
          <Fragment key={i}>{action}</Fragment>
        ))}
        {/* (2) info — the passive "about this data" (methodology) disclosure */}
        {hasDisclosure && (
          <button
            className={`section__icon-btn${infoOpen ? ' active' : ''}`}
            title={t('info')}
            type="button"
            aria-label={t('info')}
            aria-expanded={infoOpen}
            onClick={onToggleInfo}
          >
            <InfoIcon />
          </button>
        )}
        {/* (3) LAST — the interactive chart↔table view toggle, clearly separated
            from the passive metadata group above. */}
        {showToggle && (
          <div className="section__view-toggle" role="group" aria-label={t('view-toggle')}>
            {roles.map(r => (
              <button
                key={r}
                className={`section__view-btn${activeRole === r ? ' active' : ''}`}
                onClick={() => setActiveRole(r)}
                type="button"
                aria-pressed={activeRole === r}
              >
                <span>{resolveLocale(roleLabels[r])}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      {canCollapse && (
        <ChevronIcon className={`section__chevron${open ? ' open' : ''}`} />
      )}
    </div>
  )
}
