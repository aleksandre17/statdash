import './kpi.css'
import type { CSSProperties } from 'react'

interface KpiCardProps {
  label:           string
  value:           string
  unit?:           string
  trend?:          'up' | 'down' | 'flat'
  trendValue?:     string
  trendSub?:       string
  color?:          string
  preliminary?:    boolean
  note?:           string
  methodologyUrl?: string
}

const ARROWS        = { up: '↗', down: '↘', flat: '→' }
const TREND_LABELS  = { up: 'მზარდი:', down: 'კლებადი:', flat: 'სტაბილური:' }

export default function KpiCard({
  label, value, unit, trend, trendValue, trendSub,
  color = '#0080BE', preliminary, note, methodologyUrl,
}: KpiCardProps) {
  const hasMeta = preliminary || methodologyUrl

  return (
    <div className="kpi-card" style={{ '--kc': color } as CSSProperties}>
      <div className="kpi-header">
        <div className="kpi-label">{label}</div>
        {hasMeta && (
          <div className="kpi-header-actions">
            {preliminary    && <span className="kpi-badge--p" title="Preliminary data">P</span>}
            {methodologyUrl && (
              <a
                href={methodologyUrl}
                target="_blank"
                rel="noreferrer"
                className="kpi-info-link"
                aria-label="Methodology"
              >ℹ</a>
            )}
          </div>
        )}
      </div>

      <div className="kpi-value-row">
        <span className="kpi-value">{value}</span>
        {unit && <span className="kpi-unit">{unit}</span>}
      </div>

      {trend && trendValue && (
        <div>
          <span className={`kpi-trend kpi-trend-${trend}`}>
            <span aria-hidden="true">{ARROWS[trend]}</span>
            <span className="sr-only">{TREND_LABELS[trend]}</span>
            &nbsp;{trendValue}
          </span>
          {trendSub && <div className="kpi-trend-sub">{trendSub}</div>}
        </div>
      )}

      {note && <p className="kpi-note">{note}</p>}
    </div>
  )
}