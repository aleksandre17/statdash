import type { ReactNode }                                  from 'react'
import type { RenderContext, NodeRenderer, ChildrenArg }   from '@statdash/react/engine'
import { useT }                                            from '@statdash/react'
import type { PerspectiveBarNode }                         from './PerspectiveBarNode'
// Reuse the mode-bar stylesheet verbatim — the perspective-bar renders the SAME
// tab-toggle DOM (.mode-tab-group/.mode-tab-btn/.mode-tab-icon), so the toggle is
// byte-identical to the live mode-bar. ONE home for these classes (no duplicate
// css), retired together with mode-bar in P6.
import '../../mode-bar/default/mode-bar.css'

// ── PerspectiveBarControl — the axis toggle ────────────────────────────────────
//
//  Reads the active-perspective triad off `ctx.mode` (SiteRenderer now feeds it
//  from the PARSED axis: `available` = perspectiveModeDefs(axis) — id/label/icon
//  straight off each PerspectiveDef; `current` = activeIdForAxis; `set` writes the
//  perspective param). Identical markup to ModeBarShell ⇒ byte-identical render.
function PerspectiveBarControl({ ctx }: { ctx: RenderContext }): ReactNode {
  const { current, available, set } = ctx.mode
  const t = useT('perspective-bar')

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

export const PerspectiveBarShell: NodeRenderer<PerspectiveBarNode> = (
  _def:      PerspectiveBarNode,
  ctx:       RenderContext,
  _children: ChildrenArg,
): ReactNode => <PerspectiveBarControl ctx={ctx} />
