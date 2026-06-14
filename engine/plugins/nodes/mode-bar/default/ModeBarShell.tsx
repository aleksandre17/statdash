import type { ReactNode }                        from 'react'
import type { RenderContext, NodeRenderer, ChildrenArg } from '@geostat/react/engine'
import type { ModeBarNode }                      from './ModeBarNode'
import './mode-bar.css'

function ModeBarControl({ ctx }: { ctx: RenderContext }): ReactNode {
  const { current, available, set } = ctx.mode

  if (available.length < 2) return null

  return (
    <div className="mode-tab-group" role="tablist" aria-label="ნახვის რეჟიმი">
      {available.map(def => (
        <button
          key={def.id}
          role="tab"
          aria-selected={current === def.id}
          className={`mode-tab-btn${current === def.id ? ' mode-tab-btn--active' : ''}`}
          onClick={() => set(def.id)}
        >
          {def.icon && <span className="mode-tab-icon" data-icon={def.icon} aria-hidden />}
          {def.label}
        </button>
      ))}
    </div>
  )
}

export const ModeBarShell: NodeRenderer<ModeBarNode> = (
  _def:      ModeBarNode,
  ctx:       RenderContext,
  _children: ChildrenArg,
): ReactNode => <ModeBarControl ctx={ctx} />