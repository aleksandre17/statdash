import { LINK_ICONS }  from '@geostat/react'
import type { NodeRenderer }  from '@geostat/react/engine'
import type { LinksNode }     from './LinksNode'

export const LinksShell: NodeRenderer<LinksNode> = (def, _ctx, _children) => {
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
            {link.label}
          </a>
        )
      })}
    </div>
  )
}