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
      <div className="section__actions" onClick={(e) => e.stopPropagation()}>
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
        {actions.map((action, i) => (
          <Fragment key={i}>{action}</Fragment>
        ))}
        {hasMethodology && (
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
      </div>
      {canCollapse && (
        <ChevronIcon className={`section__chevron${open ? ' open' : ''}`} />
      )}
    </div>
  )
}
