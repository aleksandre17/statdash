import type { SkeletonFn } from '@statdash/react/engine'

// Warm/suspense placeholder — mirrors the resolved carousel's shape (a fixed-height
// frame with one grid of cards) so the async warm (useFeaturedRows) has a stable,
// non-CLS fallback that reserves the same uniform height.
export const Skeleton: SkeletonFn = (_node, _ctx) => (
  <div className="featured-slider-skeleton">
    <div className="featured-slider-skeleton__grid">
      {[0, 1, 2, 3].map(i => (
        <div key={i} className="featured-slider-skeleton__card">
          <div className="skeleton-block featured-slider-skeleton__label" />
          <div className="skeleton-block featured-slider-skeleton__value" />
          <div className="skeleton-block featured-slider-skeleton__trend" />
        </div>
      ))}
    </div>
  </div>
)
