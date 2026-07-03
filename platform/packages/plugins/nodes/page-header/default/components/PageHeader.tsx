import './page-header.css'
import { Link } from 'react-router-dom'

interface Crumb { label: string; path?: string }

interface PageHeaderProps {
  title: string
  crumbs?: Crumb[]
  badge?: string
  onExport?: () => void
  /** Localized labels — tenant/i18n content, supplied by the shell. */
  homeLabel?: string
  exportLabel?: string
  /** Localized aria-label for the breadcrumb nav landmark (AR-37 P1). */
  breadcrumbLabel?: string
  /**
   * The ONE consolidated page-level data-integrity signal (AR-40): true when any
   * panel on the page reported preliminary data (OR-fold via the page scope).
   * Renders a single compact indicator in the header instead of N per-section
   * pills — the page summary; per-cell 'p' + footer legend keep the detail.
   */
  preliminary?: boolean
  /** Localized short label (e.g. "წინასწ." / "Prelim.") — visible, not color-only. */
  integrityLabel?: string
  /** Localized full caption (e.g. "Preliminary data") — the indicator's title tooltip. */
  integrityTitle?: string
  /** Localized aria-label for the indicator (e.g. "Data integrity"). */
  integrityAriaLabel?: string
}

export default function PageHeader({
  title, crumbs = [], badge, onExport, homeLabel, exportLabel, breadcrumbLabel = 'Breadcrumb',
  preliminary, integrityLabel, integrityTitle, integrityAriaLabel,
}: PageHeaderProps) {
  return (
    <div className="page-header">
      <div className="page-header__left">
        {crumbs.length > 0 && homeLabel && (
          <nav className="page-header__breadcrumb" aria-label={breadcrumbLabel}>
            <Link to="/">{homeLabel}</Link>
            {crumbs.map((c, i) => (
              <span key={i} style={{ display: 'contents' }}>
                <span className="page-header__bc-sep">›</span>
                {c.path ? <Link to={c.path}>{c.label}</Link> : <span>{c.label}</span>}
              </span>
            ))}
          </nav>
        )}
        <h1 className="page-header__title">{title}</h1>
      </div>

      <div className="page-header__right">
        {/* ONE consolidated data-integrity indicator (AR-40, Law 9 / WCAG 2.1 AA):
            not color-only — a dot AND a visible text label, plus a title/aria caption.
            The detail (per-cell 'p' flags, footer legend, section methodology) stays
            reachable below; this is the page-level summary. */}
        {preliminary && (
          <span className="page-header__integrity" title={integrityTitle} aria-label={integrityAriaLabel}>
            <span className="page-header__integrity-dot" aria-hidden="true" />
            <span className="page-header__integrity-label">{integrityLabel}</span>
          </span>
        )}
        {badge && (
          <span className="freshness-badge">
            <span className="freshness-dot" />
            {badge}
          </span>
        )}
        {onExport && (
          <button className="page-header__btn" onClick={onExport} type="button">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
            </svg>
            {exportLabel}
          </button>
        )}
      </div>
    </div>
  )
}