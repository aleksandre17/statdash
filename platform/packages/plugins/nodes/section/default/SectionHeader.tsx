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
  /**
   * The ONE consolidated data-integrity signal (AR-39): true when the section's
   * data is preliminary (OR-fold of child-panel reports + author override).
   * Renders a single compact indicator here instead of N per-panel pills, and
   * makes the info disclosure reachable even without an authored methodology.
   */
  preliminary:  boolean
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
  preliminary,
  infoOpen,
  onToggleInfo,
  t,
}: SectionHeaderProps) {
  // The info disclosure is the canonical data-integrity home: it opens whenever
  // there is something to disclose — an authored methodology OR a preliminary
  // aggregate to explain (Law 9 reachability).
  const hasDisclosure = hasMethodology || preliminary
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
          extension links, (2) the info disclosure, (3) the data-integrity status —
          and the INTERACTIVE "how to view it" control (the chart↔table view toggle)
          is separated LAST. DOM order = tab order, so keyboard users traverse
          metadata → status → view control in that same left-to-right grouping. */}
      <div className="section__actions" onClick={(e) => e.stopPropagation()}>
        {/* (1) link — extension actions (permalink, export, …) */}
        {actions.map((action, i) => (
          <Fragment key={i}>{action}</Fragment>
        ))}
        {/* (2) info — the passive "about this data" disclosure */}
        {hasDisclosure && (
          <button
            className={`section__icon-btn${infoOpen ? ' active' : ''}`}
            title={t('info')}
            type="button"
            aria-label={preliminary ? t('data-integrity') : t('info')}
            aria-expanded={infoOpen}
            onClick={onToggleInfo}
          >
            <InfoIcon />
          </button>
        )}
        {/* (3) status — ONE consolidated data-integrity indicator (AR-39). Not
            color-only (WCAG 2.1 AA / Law 9): a dot AND a visible text label. The
            full detail (source, last-updated, methodology, what "preliminary"
            means) is reachable through the adjacent info disclosure. */}
        {preliminary && (
          <span className="section__integrity" title={t('preliminary')}>
            <span className="section__integrity-dot" aria-hidden="true" />
            <span className="section__integrity-label">{t('preliminary-short')}</span>
          </span>
        )}
        {/* (4) LAST — the interactive chart↔table view toggle, clearly separated
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
