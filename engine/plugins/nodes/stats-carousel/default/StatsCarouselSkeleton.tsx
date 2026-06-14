import type { SkeletonFn } from '@geostat/react/engine'

export const Skeleton: SkeletonFn = (_node, _ctx) => (
  <div className="stats-carousel-skeleton">
    <div className="stats-carousel-skeleton__header">
      <div className="skeleton-block stats-carousel-skeleton__title" />
    </div>
    <div className="stats-carousel-skeleton__grid">
      {[0, 1, 2, 3].map(i => (
        <div key={i} className="stats-carousel-skeleton__item">
          <div className="skeleton-block stats-carousel-skeleton__icon" />
          <div className="stats-carousel-skeleton__body">
            <div className="skeleton-block stats-carousel-skeleton__label" />
            <div className="skeleton-block stats-carousel-skeleton__value" />
          </div>
        </div>
      ))}
    </div>
  </div>
)