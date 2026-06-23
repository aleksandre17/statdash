import { type ReactNode }                   from 'react'
import { applyViewStyles, mergeStyles }    from '@statdash/styles'
import type { StyleAttrs, BodyStyleAttrs } from '@statdash/styles'
import { useLayoutItem }                   from './layoutItemContext'
import { useWrapStyle }                    from './wrapStyleContext'
import { VIEW_DEFAULTS }                   from './types'
import type {
  NodeBase, ViewParams, RenderContext, ChildrenArg, NodeRenderer,
}                                          from './types'

// ── ShellProps — resolved context passed into every shell render fn ───
//
//  vs        — pre-computed panel + body style attrs (spread directly on DOM)
//  placement — grid/flex placement from LayoutItemContext (merge into panel style)
//  merged    — VIEW_DEFAULTS merged with def.view (never read def.view raw)
//
export interface ShellProps<T extends NodeBase> {
  def:       T
  ctx:       RenderContext
  children:  ChildrenArg
  vs:        { panel: StyleAttrs; body: BodyStyleAttrs }
  placement: Record<string, string | number> | null
  merged:    ViewParams
}

// ── defineShell — framework-level factory for NodeRenderer ────────────
//
//  Handles shared boilerplate automatically:
//    1. Visibility gate   — evalVisibility(visibleWhen) → null
//    2. Wrap style merge  — WrapStyleContext base + def.view.styles override
//    3. Style computation — applyViewStyles(effectiveView) → vs
//    4. Layout placement  — useLayoutItem() → placement (hook, must be in component)
//    5. Defaults merge    — VIEW_DEFAULTS + def.view → merged
//
export function defineShell<T extends NodeBase>(config: {
  render: (props: ShellProps<T>) => ReactNode
}): NodeRenderer<T> {
  function ShellWrapper({
    def,
    ctx,
    children,
  }: { def: T; ctx: RenderContext; children: ChildrenArg }) {
    const placement = useLayoutItem()
    const wrapStyle = useWrapStyle()

    // WrapNode distributes its styles as base; child view.styles always wins.
    const effectiveView = wrapStyle
      ? { ...def.view, styles: mergeStyles(wrapStyle, def.view?.styles ?? {}) }
      : def.view

    const vs     = applyViewStyles(effectiveView)
    const merged = { ...VIEW_DEFAULTS, ...(def.view ?? {}) } as ViewParams

    return config.render({ def, ctx, children, vs, placement, merged }) as ReactNode
  }

  return (def, ctx, children) => <ShellWrapper def={def} ctx={ctx} children={children} />
}