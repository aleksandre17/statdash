import type { NodeBase, PropertyGroup } from '@statdash/react/engine'
import type { LocaleString }                        from '@statdash/engine'
import { defineSchema, type AssertSchemaCovers, type Expect } from '../../../schema-contract'

export interface TextNode extends NodeBase {
  type:     'text'
  /** Markdown, plain text, or pre-sanitised HTML to render. */
  content:  string | LocaleString
  /** Rendering format. Default: 'markdown' */
  format?:  'markdown' | 'plain' | 'html'
}

export const TextSchema = defineSchema([
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
])

// FF-SCHEMA-COMPLETE (tier b): 1:1 with editable keys.
export type _TextCovers = Expect<AssertSchemaCovers<TextNode, typeof TextSchema>>

// ── TextDefaults — guard-valid the instant the panel is dropped ──────────────
//
//  `content` is a REQUIRED localized field, so its default must be a COMPLETE
//  LocaleString (non-empty for every active locale) — an empty-but-present record
//  `{ka:'',en:''}` (or no default at all) would trip the Constructor saveGuard's
//  locale-completeness check the moment the author drops the panel. We seed real
//  placeholder copy the author then edits in place. `format` keeps the schema
//  default ('markdown').
export const TextDefaults: Partial<TextNode> = {
  content: { ka: 'ტექსტი', en: 'Text' },
  format:  'markdown',
}

export const TextGroups: PropertyGroup[] = [
  { label: { ka: 'შინაარსი', en: 'Content' }, fields: ['content', 'format'] },
]

declare module '@statdash/react/engine' {
  interface NodeTypeMap { 'text': TextNode }
}
