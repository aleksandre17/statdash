import './text.css'

import { defineShell }               from '@statdash/react/engine'
import type { TextNode }              from './TextNode'
import { renderMarkdown, sanitise }   from './textUtils'

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

    if (format === 'plain') {
      return <p className="text-panel text-panel--plain">{raw}</p>
    }

    const html = format === 'markdown'
      ? sanitise(renderMarkdown(raw))
      : sanitise(raw)

    return (
      <div
        className="text-panel text-panel--rich"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: content is sanitised by `sanitise()`
        dangerouslySetInnerHTML={{ __html: html }}
      />
    )
  },
})
