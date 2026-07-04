import './featured-slider.css'
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useT }                                  from '@statdash/react'
import { defineShell, useFeaturedRows }          from '@statdash/react/engine'
import type { RenderContext }                    from '@statdash/react/engine'
import type { FeaturedSlideDef }                 from '@statdash/engine'
import type { FeaturedSliderNode }               from './FeaturedSliderNode'
import FeaturedCard, { type FeaturedCardLabels } from './FeaturedCard'

// ── Carousel timing (named; the only two magic numbers the shell carries) ──
//
//  DEFAULT_AUTOPLAY_MS — slide dwell before auto-advancing to the next group,
//  used when the node omits `autoplayMs`.
//  FADE_OUT_MS — the cross-fade hold: how long the current group stays faded out
//  (`data-visible` off) before the next group's cards swap in. MUST match the
//  `.featured-slider__slide` opacity/transform transition in featured-slider.css
//  (mirrors the old stats-carousel cross-fade the owner references as "before").
const DEFAULT_AUTOPLAY_MS = 7000
const FADE_OUT_MS         = 200

/** One carousel slide: an editorial group + its ordered cards. */
interface SlideGroup {
  group: string
  items: FeaturedSlideDef[]
}

/**
 * Fold the flat FeaturedSlideDef[] into groups (first-seen group order; cards
 * sorted by `order` within a group). Pure — presentation shaping only.
 */
function groupSlides(slides: FeaturedSlideDef[]): SlideGroup[] {
  const groups: SlideGroup[] = []
  const index = new Map<string, SlideGroup>()
  for (const s of slides) {
    let g = index.get(s.group)
    if (!g) { g = { group: s.group, items: [] }; index.set(s.group, g); groups.push(g) }
    g.items.push(s)
  }
  for (const g of groups) g.items.sort((a, b) => a.order - b.order)
  return groups
}

/**
 * Prefix a bare page-slug href with the active locale (mirrors the hero card's
 * `/${locale}/${slug}`); pass absolute / external / already-rooted hrefs through.
 * Logic lives in the renderer (Law 2), never in config.
 */
function resolveHref(href: string, locale: string): string {
  if (/^([a-z]+:)?\/\//i.test(href) || href.startsWith('/') || href.startsWith('#')) return href
  return `/${locale}/${href}`
}

export const FeaturedSliderShell = defineShell<FeaturedSliderNode>({
  render({ def, ctx }) {
    return <FeaturedSliderControl def={def} ctx={ctx} />
  },
})

/**
 * A CAROUSEL (not tabs): a uniform fixed-height frame that shows ONE group's cards
 * at a time and auto-advances via a cross-fade (fade-out → swap → fade-in). The
 * frame never changes height between groups (the varying card counts fill a
 * reserved band, not a growing panel), and there is NO top group-title row —
 * position is signalled by indicator dots + a progress bar, navigation by prev/next
 * arrows. Auto-rotation pauses on hover/focus and is OFF under prefers-reduced-motion
 * (WCAG 2.2.2). The live FeaturedCard content (governed values, trend, preliminary
 * badge, drill links) and the useFeaturedRows data path are untouched.
 */
function FeaturedSliderControl({ def, ctx }: { def: FeaturedSliderNode; ctx: RenderContext }) {
  const t      = useT('featured-slider')
  const slides = useFeaturedRows(def.items, ctx)
  const groups = useMemo(() => groupSlides(slides), [slides])

  const cardLabels: FeaturedCardLabels = {
    trend:       { up: t('trend-up'), down: t('trend-down'), flat: t('trend-flat') },
    methodology: t('methodology'),
    preliminary: t('preliminary'),
    drill:       t('drill'),
  }

  const count = groups.length
  const [active, setActive] = useState(0)
  const [fade,   setFade]   = useState(true)
  const [paused, setPaused] = useState(false)

  // Clamp at READ time (never an effect that setStates — that cascades renders):
  // if the group set shrinks on a data reload, the stale-high index resolves to a
  // valid slide instead of an out-of-range blank. setActive always writes a valid
  // index, so the two converge.
  const activeIndex = count > 0 ? Math.min(active, count - 1) : 0

  const autoplay = def.autoplayMs ?? DEFAULT_AUTOPLAY_MS
  const reducedMotion = useMemo(
    () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )

  // Refs let the autoplay interval read the latest index and clear the fade timer
  // without being re-armed on every advance (mirrors the old stats-carousel).
  const activeRef    = useRef(activeIndex)
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => { activeRef.current = activeIndex }, [activeIndex])

  // Cross-fade to group `i`: fade the current group out, swap content, fade the new
  // group in — the "slide like before" transition. Under prefers-reduced-motion the
  // swap is instant (no fade), honouring WCAG 2.3.3 / user preference.
  const goTo = useCallback((i: number) => {
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current)
    if (reducedMotion) { setActive(i); setFade(true); return }
    setFade(false)
    fadeTimerRef.current = setTimeout(() => { setActive(i); setFade(true) }, FADE_OUT_MS)
  }, [reducedMotion])

  // Auto-advance — OFF when paused (hover/focus), the user prefers reduced motion,
  // the author sets autoplayMs:0, or there is <2 groups (WCAG 2.2.2 Pause/Stop).
  const autoRotating = !paused && !reducedMotion && autoplay > 0 && count >= 2
  useEffect(() => {
    if (!autoRotating) return
    const timer = setInterval(() => goTo((activeRef.current + 1) % count), autoplay)
    return () => {
      clearInterval(timer)
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current)
    }
  }, [autoRotating, goTo, count, autoplay])

  if (count === 0) return null

  const activeGroup = groups[activeIndex]
  const multi       = count > 1

  return (
    <section
      className="featured-slider"
      aria-roledescription="carousel"
      aria-label={t('region')}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      {multi && (
        <div className="featured-slider__controls">
          {/* Position indicators — decorative (position is also carried by the
              slide's aria-label + progress bar); prev/next give keyboard control. */}
          <div className="featured-slider__dots" aria-hidden="true">
            {groups.map((g, i) => (
              <span
                key={g.group || i}
                className="featured-slider__dot"
                data-current={i === activeIndex ? '' : undefined}
              />
            ))}
          </div>
          <div className="featured-slider__nav">
            <button
              type="button"
              className="featured-slider__nav-button"
              aria-label={t('prev')}
              onClick={() => goTo((activeIndex - 1 + count) % count)}
            >
              <span aria-hidden="true">←</span>
            </button>
            <button
              type="button"
              className="featured-slider__nav-button"
              aria-label={t('next')}
              onClick={() => goTo((activeIndex + 1) % count)}
            >
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      )}

      {/* ONE slide at a time, cross-fading in place inside the fixed-height frame.
          aria-live is 'off' while auto-rotating (APG: don't announce every 7s) and
          'polite' when rotation is stopped/paused, so a stopped carousel is spoken. */}
      <div
        className="featured-slider__slide"
        role="group"
        aria-roledescription="slide"
        aria-label={`${t('slide')} ${activeIndex + 1} / ${count}`}
        aria-live={autoRotating ? 'off' : 'polite'}
        data-visible={fade ? '' : undefined}
      >
        <div className="featured-slider__grid" data-count={String(activeGroup.items.length)}>
          {activeGroup.items.map((slide, j) => (
            <FeaturedCard
              key={`${slide.card.label}-${j}`}
              slide={slide}
              href={resolveHref(slide.href, ctx.locale)}
              labels={cardLabels}
            />
          ))}
        </div>
      </div>

      {multi && (
        <div className="featured-slider__progress" aria-hidden="true">
          <div
            className="featured-slider__progress-bar"
            style={{ width: `${((activeIndex + 1) / count) * 100}%` }}
          />
        </div>
      )}
    </section>
  )
}
