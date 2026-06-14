import type { SkeletonFn } from '@geostat/react/engine'

export const Skeleton: SkeletonFn = (_node, _ctx) => (
  <div className="kpi-skeleton">
    {[0, 1, 2, 3].map((i) => (
      <div key={i} className="kpi-skeleton__card">
        <div className="skeleton-block kpi-skeleton__label" />
        <div className="skeleton-block kpi-skeleton__value" />
        <div className="skeleton-block kpi-skeleton__unit"  />
      </div>
    ))}
  </div>
)