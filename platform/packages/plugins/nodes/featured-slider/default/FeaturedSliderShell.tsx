import './featured-slider.css'
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent }          from 'react'
import { useT }                                  from '@statdash/react'
import { defineShell, useFeaturedRows }          from '@statdash/react/engine'
import type { RenderContext }                    from '@statdash/react/engine'
import type { FeaturedSlideDef }                 from '@statdash/engine'
import type { FeaturedSliderNode }               from './FeaturedSliderNode'
import FeaturedCard, { type FeaturedCardLabels } from './FeaturedCard'

const DEFAULT_AUTOPLAY_MS = 7000

/** One tabbed slide: an editorial group + its ordered cards. */
interface SlideGroup {
  group: string
  items: FeaturedSlideDef[]
}

/**
 * Fold the flat FeaturedSlideDef[] into tabbed groups (first-seen group order;
 * cards sorted by `order` within a group). Pure — presentation shaping only.
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
  const [paused, setPaused] = useState(false)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])

  // Clamp at READ time (never an effect that setStates — that cascades renders):
  // if the group set shrinks on a data reload, the stale-high index resolves to a
  // valid slide instead of an out-of-range blank. All render + keyboard reads use
  // activeIndex; setActive always writes a valid index, so the two converge.
  const activeIndex = count > 0 ? Math.min(active, count - 1) : 0

  const autoplay = def.autoplayMs ?? DEFAULT_AUTOPLAY_MS
  const reducedMotion = useMemo(
    () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )

  // Auto-advance — paused on hover/focus (setPaused) and OFF when the author sets
  // autoplayMs:0, there is <2 slides, or the user prefers reduced motion (WCAG 2.2.2).
  useEffect(() => {
    if (paused || reducedMotion || autoplay <= 0 || count < 2) return
    const timer = setInterval(() => setActive(i => (i + 1) % count), autoplay)
    return () => clearInterval(timer)
  }, [paused, reducedMotion, autoplay, count])

  // Roving-tabindex keyboard nav (WAI-ARIA tabs; automatic activation — selection
  // follows focus, valid since every panel is preloaded).
  const focusTab = useCallback((i: number) => {
    setActive(i)
    tabRefs.current[i]?.focus()
  }, [])

  const onTabKeyDown = useCallback((e: ReactKeyboardEvent) => {
    if (count < 2) return
    switch (e.key) {
      case 'ArrowRight': e.preventDefault(); focusTab((activeIndex + 1) % count); break
      case 'ArrowLeft':  e.preventDefault(); focusTab((activeIndex - 1 + count) % count); break
      case 'Home':       e.preventDefault(); focusTab(0); break
      case 'End':        e.preventDefault(); focusTab(count - 1); break
    }
  }, [activeIndex, count, focusTab])

  if (count === 0) return null

  const activeGroup = groups[activeIndex]
  const grouped     = count > 1 || activeGroup.group !== ''

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
      {grouped && (
        <div className="featured-slider__tabs" role="tablist" aria-label={t('region')} onKeyDown={onTabKeyDown}>
          {groups.map((g, i) => (
            <button
              key={g.group || i}
              ref={el => { tabRefs.current[i] = el }}
              type="button"
              role="tab"
              id={`featured-tab-${i}`}
              aria-selected={i === activeIndex}
              aria-controls={`featured-panel-${i}`}
              tabIndex={i === activeIndex ? 0 : -1}
              className="featured-slider__tab"
              data-current={i === activeIndex ? '' : undefined}
              onClick={() => setActive(i)}
            >
              {g.group || `${t('slide')} ${i + 1}`}
            </button>
          ))}
        </div>
      )}

      {groups.map((g, i) => (
        <div
          key={g.group || i}
          role={grouped ? 'tabpanel' : undefined}
          id={`featured-panel-${i}`}
          aria-labelledby={grouped ? `featured-tab-${i}` : undefined}
          hidden={i !== activeIndex}
          aria-live={i === activeIndex ? 'polite' : undefined}
          className="featured-slider__panel"
        >
          <div className="featured-slider__grid" data-count={String(g.items.length)}>
            {g.items.map((slide, j) => (
              <FeaturedCard
                key={`${slide.card.label}-${j}`}
                slide={slide}
                href={resolveHref(slide.href, ctx.locale)}
                labels={cardLabels}
              />
            ))}
          </div>
        </div>
      ))}

      {count > 1 && (
        <div className="featured-slider__dots" aria-hidden="true">
          {groups.map((g, i) => (
            <span key={g.group || i} className="featured-slider__dot" data-current={i === activeIndex ? '' : undefined} />
          ))}
        </div>
      )}
    </section>
  )
}
