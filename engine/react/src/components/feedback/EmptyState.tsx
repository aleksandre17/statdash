import './feedback.css'
import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon?:  string
  title?: string
  desc?:  string
}

export function EmptyState({ icon = '📊', title = 'No data', desc }: EmptyStateProps): ReactNode {
  return (
    <div className="empty-state">
      <div className="empty-state__icon">{icon}</div>
      <p className="empty-state__title">{title}</p>
      {desc && <p className="empty-state__desc">{desc}</p>}
    </div>
  )
}