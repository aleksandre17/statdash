import type { ReactNode } from 'react'
import './mode-bar.css'

export function ModeBarSkeleton(): ReactNode {
  return (
    <div className="mode-tab-group mode-tab-group--skeleton" aria-hidden>
      <div className="mode-tab-btn" />
      <div className="mode-tab-btn" />
    </div>
  )
}