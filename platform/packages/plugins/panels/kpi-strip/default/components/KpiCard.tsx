import './kpi.css'
import type { CSSProperties } from 'react'

interface KpiCardProps {
  label:           string
  value:           string
  unit?:           string
  /** 'none' = a directionless figure (a share) — rendered with no arrow / no label. */
  trend?:          'up' | 'down' | 'flat' | 'none'
  trendValue?:     string
  trendSub?:       string
  color?:          string
  preliminary?:    boolean
  note?:           string
  methodologyUrl?: string
  /**
   * Localized screen-reader trend direction labels, supplied by the shell via
   * useT('kpi-strip'). Tenant/i18n content — never hardcoded here. Falls back to
   * neutral English tokens so the sr-only text is never empty (WCAG).
   */
  trendLabels?:    { up: string; down: string; flat: string }
  /**
   * Localized per-item data-integrity labels (methodology link aria), supplied by
   * the shell via useT — same pattern as trendLabels. Never hardcoded here
   * (AR-37 P1); neutral-English fallback keeps the a11y name non-empty outside a
   * provider. The preliminary signal is NOT a per-card pill anymore — the strip
   * consolidates it into ONE freshness badge (AR-39); only `methodology` (the
   * per-indicator link aria) remains a card-level label.
   */
  metaLabels?:     { methodology: string }
}

const ARROWS        = { up: '↗', down: '↘', flat: '→' }
const TREND_FALLBACK = { up: 'Up:', down: 'Down:', flat: 'Flat:' }
const META_FALLBACK  = { methodology: 'Methodology' }

export default function KpiCard({
  label, value, unit, trend, trendValue, trendSub,
  color = 'var(--color-accent)', note, methodologyUrl,
  trendLabels = TREND_FALLBACK,
  metaLabels = META_FALLBACK,
}: KpiCardProps) {
  return (
    <div className="kpi-card" style={{ '--kc': color } as CSSProperties}>
      <div className="kpi-header">
        <div className="kpi-label">{label}</div>
        {/* Preliminary status is consolidated into the strip-level freshness badge
            (AR-39) — the card no longer renders a per-title "P" pill. Only the
            per-indicator methodology link (if authored) stays card-local. */}
        {methodologyUrl && (
          <div className="kpi-header-actions">
            <a
              href={methodologyUrl}
              target="_blank"
              rel="noreferrer"
              className="kpi-info-link"
              aria-label={metaLabels.methodology}
            >ℹ</a>
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
            {/* A directionless figure (a share) carries NO glyph and NO up/down/flat
                label — rendering one would read as a false trend. Directional trends
                keep the glyph + sr-only direction (WCAG 1.4.1: never colour-only). */}
            {trend !== 'none' && (
              <>
                <span aria-hidden="true">{ARROWS[trend]}</span>
                <span className="sr-only">{trendLabels[trend]}</span>
                {' '}
              </>
            )}
            {trendValue}
          </span>
          {trendSub && <div className="kpi-trend-sub">{trendSub}</div>}
        </div>
      )}

      {note && <p className="kpi-note">{note}</p>}
    </div>
  )
}