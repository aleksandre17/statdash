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
}

export default function PageHeader({ title, crumbs = [], badge, onExport, homeLabel, exportLabel }: PageHeaderProps) {
  return (
    <div className="page-header">
      <div className="page-header__left">
        {crumbs.length > 0 && homeLabel && (
          <nav className="page-header__breadcrumb" aria-label="breadcrumb">
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