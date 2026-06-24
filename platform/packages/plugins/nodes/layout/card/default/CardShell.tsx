import { resolveLocaleString } from '@statdash/engine'
import type { NodeRenderer }   from '@statdash/react/engine'
import type { CardNode }       from './CardNode'

export const CardShell: NodeRenderer<CardNode> =
  (def, ctx, children) => {
    const title = def.title ? resolveLocaleString(def.title, ctx.locale, ctx.fallbackLocale) : undefined
    return (
      <div className="layout-card">
        {title ? <h3 className="layout-card__title">{title}</h3> : null}
        {children.rendered}
      </div>
    )
  }