import type { SkeletonFn } from '@geostat/react/engine'

export const Skeleton: SkeletonFn = (_node, _ctx) => (
  <div className="section-skeleton">
    <div className="section-skeleton__head">
      <div className="skeleton-block section-skeleton__title" />
    </div>
    <div className="section-skeleton__body">
      <div className="skeleton-block section-skeleton__chart" />
    </div>
  </div>
)