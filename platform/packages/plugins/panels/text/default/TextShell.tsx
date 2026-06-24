import './text.css'

import { defineShell }               from '@statdash/react/engine'
import type { TextNode }              from './TextNode'
import { renderMarkdown, sanitise }   from './textUtils'
import { TEXT, resolveTextRender }    from './textKeys'

export const TextShell = defineShell<TextNode>({
  render({ def, ctx }) {
    const raw =
      typeof def.content === 'string'
        ? def.content
        : def.content?.[ctx.locale]
          ?? def.content?.[ctx.fallbackLocale]
          ?? Object.values(def.content ?? {})[0]
          ?? ''

    if (!raw) return null

    const format = def.format ?? 'markdown'

    // Render mode arrives as a data-render attribute (resolveTextRender), never
    // an inline modifier class — the same channel the style spine uses for view
    // state. The shell writes zero variant→class logic.
    if (format === 'plain') {
      return <p className={TEXT.block} {...resolveTextRender('plain')}>{raw}</p>
    }

    const html = format === 'markdown'
      ? sanitise(renderMarkdown(raw))
      : sanitise(raw)

    return (
      <div
        className={TEXT.block}
        {...resolveTextRender(format)}
        // biome-ignore lint/security/noDangerouslySetInnerHtml: content is sanitised by `sanitise()`
        dangerouslySetInnerHTML={{ __html: html }}
      />
    )
  },
})
