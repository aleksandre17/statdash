import { LINK_ICONS }  from '@statdash/react'
import { resolveLocaleString } from '@statdash/engine'
import type { NodeRenderer }  from '@statdash/react/engine'
import type { LinksNode }     from './LinksNode'

export const LinksShell: NodeRenderer<LinksNode> = (def, ctx, _children) => {
  if (!def.items.length) return null
  return (
    <div className="links-row">
      {def.items.map(link => {
        const Icon = LINK_ICONS[link.icon]
        return (
          <a
            key={link.href}
            href={link.href}
            className="links-row__item"
            target="_blank"
            rel="noopener noreferrer"
          >
            {Icon && <Icon />}
            {resolveLocaleString(link.label, ctx.locale, ctx.fallbackLocale)}
          </a>
        )
      })}
    </div>
  )
}