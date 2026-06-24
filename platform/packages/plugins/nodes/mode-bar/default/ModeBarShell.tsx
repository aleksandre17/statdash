import type { ReactNode }                        from 'react'
import type { RenderContext, NodeRenderer, ChildrenArg } from '@statdash/react/engine'
import { useT }                                  from '@statdash/react'
import type { ModeBarNode }                      from './ModeBarNode'
import './mode-bar.css'

function ModeBarControl({ ctx }: { ctx: RenderContext }): ReactNode {
  const { current, available, set } = ctx.mode
  const t = useT('mode-bar')

  if (available.length < 2) return null

  return (
    <div className="mode-tab-group" role="tablist" aria-label={t('aria-label')}>
      {available.map(def => (
        <button
          key={def.id}
          role="tab"
          aria-selected={current === def.id}
          className="mode-tab-btn"
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