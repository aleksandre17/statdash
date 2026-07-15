import './kpi.css'
import type { CSSProperties } from 'react'
import { tokenCssVar }        from '@statdash/styles'

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
  /**
   * Conditional-formatting (threshold) result — the numeric-breakpoint the resolved
   * value reached (interpretKpi, Grafana thresholds). All three are ABSENT unless a
   * step matched a genuine `ok` value (Law 8 additive · Law 11 honest — a no-data card
   * never renders a KpiCard, so these never colour a fabricated value).
   */
  /** Semantic-token KEY for the value colour — resolved to a CSS `var(--…)` here (token spine). */
  valueToken?:      string
  /** Directional glyph rendered before the value — the non-colour signal (WCAG 1.4.1). */
  valueGlyph?:      'up' | 'down' | 'flat'
  /** Matched-step state label (already locale-resolved) — the accessible name for the colour. */
  valueStateLabel?: string
}

const ARROWS        = { up: '↗', down: '↘', flat: '→' }
const TREND_FALLBACK = { up: 'Up:', down: 'Down:', flat: 'Flat:' }
const META_FALLBACK  = { methodology: 'Methodology' }

export default function KpiCard({
  label, value, unit, trend, trendValue, trendSub,
  color = 'var(--color-accent)', note, methodologyUrl,
  trendLabels = TREND_FALLBACK,
  metaLabels = META_FALLBACK,
  valueToken, valueGlyph, valueStateLabel,
}: KpiCardProps) {
  // Threshold colour: resolve the semantic-token KEY through the spine to a CSS
  // `var(--…)` (tenant-overridable, contrast-governed — never a literal hex). Applied
  // to the VALUE only (distinct from `color`, the card-level accent). WCAG 1.4.1: the
  // value TEXT itself is the primary signal (always shown, readable without colour);
  // the colour is redundant emphasis, the glyph + sr-only state label the extra
  // non-colour channels — so a coloured value is never a colour-ONLY signal.
  const valueColor = valueToken ? tokenCssVar(valueToken) : undefined
  const valueStyle = valueColor ? ({ color: valueColor } as CSSProperties) : undefined
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
        <span className="kpi-value" style={valueStyle}>
          {valueGlyph && (
            <span className="kpi-value-glyph" aria-hidden="true">{ARROWS[valueGlyph]}</span>
          )}
          {value}
          {/* The accessible name for the threshold colour/glyph — carries the meaning
              for screen readers so the signal is never colour-only (WCAG 1.4.1). */}
          {valueStateLabel && <span className="sr-only"> {valueStateLabel}</span>}
        </span>
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