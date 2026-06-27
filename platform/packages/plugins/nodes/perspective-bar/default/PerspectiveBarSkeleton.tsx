import type { ReactNode } from 'react'
import './perspective-bar.css'

export function PerspectiveBarSkeleton(): ReactNode {
  return (
    <div className="perspective-tab-group perspective-tab-group--skeleton" aria-hidden>
      <div className="perspective-tab-btn" />
      <div className="perspective-tab-btn" />
    </div>
  )
}
