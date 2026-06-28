import './stats-carousel.css'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useT, useResolveLocale }                   from '@statdash/react'
import type { NodeRenderer }                         from '@statdash/react/engine'
import type { StatsCarouselNode }                    from './StatsCarouselNode'

// ── Carousel timing (named; the only two magic numbers the shell carried) ──
//
//  DEFAULT_AUTOPLAY_MS — slide dwell time before auto-advancing to the next
//  slide, used when the node omits `autoplayMs`.
//  FADE_OUT_MS — the cross-fade hold: how long the current slide stays faded
//  out (`is-visible` off) before the new slide's content swaps in. Must match
//  the `.stats-grid` opacity/transform transition duration in stats-carousel.css.
const DEFAULT_AUTOPLAY_MS = 7000
const FADE_OUT_MS         = 200

export const StatsCarouselShell: NodeRenderer<StatsCarouselNode> = (def, _ctx, _children) =>
  <StatsCarouselControl def={def} />

function StatsCarouselControl({ def }: { def: StatsCarouselNode }) {
  const [activeSlide, setActiveSlide] = useState(0)
  const [fade, setFade]               = useState(true)
  const t       = useT('stats-carousel')
  const resolve = useResolveLocale()

  const count    = def.slides.length
  const autoplay = def.autoplayMs ?? DEFAULT_AUTOPLAY_MS

  const activeSlideRef = useRef(activeSlide)
  const fadeTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { activeSlideRef.current = activeSlide }, [activeSlide])

  const goTo = useCallback((i: number) => {
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current)
    setFade(false)
    fadeTimerRef.current = setTimeout(() => { setActiveSlide(i); setFade(true) }, FADE_OUT_MS)
  }, [])

  useEffect(() => {
    const timer = setInterval(() => goTo((activeSlideRef.current + 1) % count), autoplay)
    return () => {
      clearInterval(timer)
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current)
    }
  }, [goTo, count, autoplay])

  const slide = def.slides[activeSlide]

  return (
    <section className="stats-carousel-section">
      <div className="stats-carousel">

        <div className="stats-tabs">
          {def.slides.map((s, index) => (
            <button
              key={index}
              type="button"
              onClick={() => goTo(index)}
              className="stats-tab"
              data-current={index === activeSlide ? '' : undefined}
            >
              {resolve(s.tab)}
            </button>
          ))}
        </div>

        <div className="stats-carousel-header">
          <div className="stats-indicators">
            {def.slides.map((_, index) => (
              <div
                key={index}
                className="stats-indicator"
                data-current={index === activeSlide ? '' : undefined}
              />
            ))}
          </div>
          <h2 className="stats-title">{resolve(slide.title)}</h2>
          <div className="stats-nav">
            <button
              type="button"
              aria-label={t('prev')}
              onClick={() => goTo((activeSlide - 1 + count) % count)}
              className="stats-nav-button"
            >
              ←
            </button>
            <button
              type="button"
              aria-label={t('next')}
              onClick={() => goTo((activeSlide + 1) % count)}
              className="stats-nav-button"
            >
              →
            </button>
          </div>
        </div>

        <div className="stats-grid" data-visible={fade ? '' : undefined}>
          {slide.stats.map((stat, index) => (
            <div key={`${activeSlide}-${index}`} className="stats-item">
              {stat.icon && (
                <span
                  className="stats-item-icon"
                  style={{ background: stat.iconBg }}
                  aria-hidden="true"
                >
                  {stat.icon}
                </span>
              )}
              <div className="stats-item-body">
                <span className="stats-item-label">{resolve(stat.label)}</span>
                <div className="stats-item-value">
                  <span className="stats-value">{stat.value}</span>
                  <span className="stats-unit">{resolve(stat.unit)}</span>
                </div>
                {stat.change != null && stat.change !== 0 && stat.changeText && (
                  <div
                    className="stats-change"
                    data-trend={stat.change > 0 ? 'up' : 'down'}
                  >
                    <span aria-hidden="true">{stat.change > 0 ? '↗' : '↘'}</span>
                    <span className="stats-change__pct">{Math.abs(stat.change)}%</span>
                    <span className="stats-change__text">{resolve(stat.changeText)}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="stats-progress">
          <div
            className="stats-progress-bar"
            style={{ width: `${((activeSlide + 1) / count) * 100}%` }}
          />
        </div>

      </div>
    </section>
  )
}