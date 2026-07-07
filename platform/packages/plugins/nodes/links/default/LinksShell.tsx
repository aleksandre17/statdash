import { LINK_ICONS }  from '@statdash/react'
import { resolveLocaleString } from '@statdash/engine'
import type { NodeRenderer }  from '@statdash/react/engine'
import type { LinksNode }     from './LinksNode'

export const LinksShell: NodeRenderer<LinksNode> = (def, ctx, _children) => {
  if (!def.items.length) return null
  return (
    <div className="links-row">
      {def.items.map((link, i) => {
        const Icon = LINK_ICONS[link.icon]
        // href is a LocaleString — resolve at the SAME boundary as `label` so a
        // locale-specific methodology URL points to the right per-language page (a
        // plain-string href passes through untouched — Postel).
        const href = resolveLocaleString(link.href, ctx.locale, ctx.fallbackLocale)
        return (
          <a
            key={`${href}-${i}`}
            href={href}
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