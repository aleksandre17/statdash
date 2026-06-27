import type { ReactNode }                                  from 'react'
import type { RenderContext, NodeRenderer, ChildrenArg }   from '@statdash/react/engine'
import { useT }                                            from '@statdash/react'
import type { PerspectiveBarNode }                         from './PerspectiveBarNode'
import './perspective-bar.css'

// ── PerspectiveBarControl — the axis toggle ────────────────────────────────────
//
//  Reads the active-perspective triad off `ctx.perspective` (SiteRenderer feeds it
//  from the PARSED axis: `available` = perspectiveOptions(axis) — id/label/icon
//  straight off each PerspectiveDef; `current` = the active id; `set` writes the
//  axis URL param). The axis OWNS its toggle presentation (decision B).
function PerspectiveBarControl({ ctx }: { ctx: RenderContext }): ReactNode {
  const { current, available, set } = ctx.perspective
  const t = useT('perspective-bar')

  if (available.length < 2) return null

  return (
    <div className="perspective-tab-group" role="tablist" aria-label={t('aria-label')}>
      {available.map(def => (
        <button
          key={def.id}
          role="tab"
          aria-selected={current === def.id}
          className="perspective-tab-btn"
          onClick={() => set(def.id)}
        >
          {def.icon && <span className="perspective-tab-icon" data-icon={def.icon} aria-hidden />}
          {def.label}
        </button>
      ))}
    </div>
  )
}

export const PerspectiveBarShell: NodeRenderer<PerspectiveBarNode> = (
  _def:      PerspectiveBarNode,
  ctx:       RenderContext,
  _children: ChildrenArg,
): ReactNode => <PerspectiveBarControl ctx={ctx} />
