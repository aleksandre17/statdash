import './stats-carousel.css'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useT, useResolveLocale }                   from '@geostat/react'
import type { NodeRenderer }                         from '@geostat/react/engine'
import type { StatsCarouselNode }                    from './StatsCarouselNode'

export const StatsCarouselShell: NodeRenderer<StatsCarouselNode> = (def, _ctx, _children) =>
  <StatsCarouselControl def={def} />

function StatsCarouselControl({ def }: { def: StatsCarouselNode }) {
  const [activeSlide, setActiveSlide] = useState(0)
  const [fade, setFade]               = useState(true)
  const t       = useT('stats-carousel')
  const resolve = useResolveLocale()

  const count    = def.slides.length
  const autoplay = def.autoplayMs ?? 7000

  const activeSlideRef = useRef(activeSlide)
  const fadeTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { activeSlideRef.current = activeSlide }, [activeSlide])

  const goTo = useCallback((i: number) => {
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current)
    setFade(false)
    fadeTimerRef.current = setTimeout(() => { setActiveSlide(i); setFade(true) }, 200)
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
              className={`stats-tab${index === activeSlide ? ' is-active' : ''}`}
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
                className={`stats-indicator${index === activeSlide ? ' is-active' : ''}`}
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

        <div className={`stats-grid${fade ? ' is-visible' : ''}`}>
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
                  <span className="stats-unit">{stat.unit}</span>
                </div>
                {stat.change != null && stat.change !== 0 && stat.changeText && (
                  <div
                    className="stats-change"
                    style={{ color: stat.change > 0 ? '#2A9D8F' : '#E76F51' }}
                  >
                    <span aria-hidden="true">{stat.change > 0 ? '↗' : '↘'}</span>
                    <span style={{ fontWeight: 600 }}>{Math.abs(stat.change)}%</span>
                    <span style={{ color: '#6B7B8D' }}>{resolve(stat.changeText)}</span>
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