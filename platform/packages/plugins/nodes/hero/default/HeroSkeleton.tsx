import type { SkeletonFn } from '@statdash/react/engine'

export const Skeleton: SkeletonFn = (_node, _ctx) => (
  <div className="hero-skeleton">
    <div className="skeleton-block hero-skeleton__bg" />
    <div className="hero-skeleton__body">
      <div className="skeleton-block hero-skeleton__title" />
      <div className="skeleton-block hero-skeleton__subtitle" />
      <div className="hero-skeleton__cards">
        {[0, 1, 2].map(i => (
          <div key={i} className="skeleton-block hero-skeleton__card" />
        ))}
      </div>
    </div>
  </div>
)