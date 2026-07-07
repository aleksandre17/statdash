import type { CSSProperties } from 'react'
import type { FeaturedSlideDef } from '@statdash/engine'

// Trend glyphs — a11y-decorative; the sr-only text + visible trendValue carry the
// meaning (WCAG 1.4.1: never colour-only). Mirrors KpiCard's ARROWS.
const ARROWS = { up: '↗', down: '↘', flat: '→' } as const

export interface FeaturedCardLabels {
  trend:       { up: string; down: string; flat: string }
  methodology: string
  preliminary: string
  drill:       string
}

interface FeaturedCardProps {
  slide:  FeaturedSlideDef
  /** Fully-resolved drill URL (locale prefix already applied by the shell). */
  href:   string
  labels: FeaturedCardLabels
}

/**
 * One featured headline card — the GOVERNED, LIVE figure from the semantic layer
 * (never a hand-typed string). Renders label / value+unit / optional trend (glyph
 * + text + sr-only direction) / a preliminary "P" badge (Law 9) / a methodology
 * info-link (only when the metric declares one — never fabricated) / a real
 * crawlable drill `<a href>` (SEO + WCAG). The drill link and the methodology link
 * are SIBLINGS (no nested interactive elements — valid, keyboard-clean HTML).
 */
export default function FeaturedCard({ slide, href, labels }: FeaturedCardProps) {
  const { card, icon } = slide
  const trend = card.trend
  return (
    <article
      className="featured-card"
      style={{ '--fc-accent': card.color } as CSSProperties}
    >
      <div className="featured-card__head">
        {icon && <span className="featured-card__icon" aria-hidden="true">{icon}</span>}
        <h3 className="featured-card__label">{card.label}</h3>
        {card.preliminary && (
          <span className="featured-card__prelim" title={labels.preliminary}>
            <span aria-hidden="true">P</span>
            <span className="sr-only">{labels.preliminary}</span>
          </span>
        )}
      </div>

      <div className="featured-card__value-row">
        <span className="featured-card__value">{card.value}</span>
        {card.unit && <span className="featured-card__unit">{card.unit}</span>}
      </div>

      {trend && card.trendValue && (
        <div className="featured-card__trend" data-trend={trend}>
          <span className={`featured-card__trend-badge featured-card__trend-badge--${trend}`}>
            {/* A directionless figure (a share) carries NO glyph and NO up/down/flat
                label — rendering one would read as a false trend. Directional trends
                keep the glyph + sr-only direction (WCAG 1.4.1: never colour-only). */}
            {trend !== 'none' && (
              <>
                <span aria-hidden="true">{ARROWS[trend]}</span>
                <span className="sr-only">{labels.trend[trend]}</span>
                &nbsp;
              </>
            )}
            {card.trendValue}
          </span>
          {card.trendSub && <span className="featured-card__trend-sub">{card.trendSub}</span>}
        </div>
      )}

      <div className="featured-card__actions">
        <a className="featured-card__drill" href={href}>
          {labels.drill}
          <span aria-hidden="true">&nbsp;→</span>
        </a>
        {card.methodologyUrl && (
          <a
            className="featured-card__methodology"
            href={card.methodologyUrl}
            target="_blank"
            rel="noreferrer"
            aria-label={labels.methodology}
          >ℹ</a>
        )}
      </div>
    </article>
  )
}
