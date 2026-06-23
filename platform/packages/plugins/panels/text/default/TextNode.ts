import type { NodeBase, PropertyGroup, PropSchema } from '@statdash/react/engine'
import type { LocaleString }                        from '@statdash/engine'

export interface TextNode extends NodeBase {
  type:     'text'
  /** Markdown, plain text, or pre-sanitised HTML to render. */
  content:  string | LocaleString
  /** Rendering format. Default: 'markdown' */
  format?:  'markdown' | 'plain' | 'html'
}

export const TextSchema: PropSchema = [
  {
    field:    'content',
    type:     'LocaleString',
    label:    { ka: 'შინაარსი', en: 'Content' },
    required: true,
  },
  {
    field:   'format',
    type:    'string',
    label:   { ka: 'ფორმატი', en: 'Format' },
    options: [
      { value: 'markdown', label: { ka: 'Markdown', en: 'Markdown' } },
      { value: 'plain',    label: { ka: 'ტექსტი',   en: 'Plain text' } },
      { value: 'html',     label: { ka: 'HTML',      en: 'HTML' } },
    ],
    default: 'markdown',
  },
]

export const TextGroups: PropertyGroup[] = [
  { label: { ka: 'შინაარსი', en: 'Content' }, fields: ['content', 'format'] },
]

declare module '@statdash/react/engine' {
  interface NodeTypeMap { 'text': TextNode }
}
