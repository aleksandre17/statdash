// ── textKeys — the text slice's typed class-name SSOT + render-state spine ──
//
//  Mirrors section/styleKeys.ts. The ONE static block class lives here; the
//  former render-MODE modifiers (`text-panel--plain` / `text-panel--rich`) are
//  NOT class names any longer — they are a `data-render` ATTRIBUTE resolved from
//  the node's `format`, exactly as the style spine turns view-state into
//  `data-view`. text.css selects on `[data-render="plain"|"rich"]`; the shell
//  spreads the resolved attrs and writes ZERO inline modifier-class logic.
//
//  Why derived, not an authorable VariantDef: the render mode is a pure function
//  of the existing `format` schema field (plain → plain; markdown/html → rich).
//  A separate VariantDef would duplicate that field. So this is render-STATE
//  (like resolveViewState), declared beside the data it derives from.
//

import type { TextNode } from './TextNode'

export const TEXT = {
  block: 'text-panel',
} as const

/** The two render modes the stylesheet distinguishes. */
export type TextRender = 'plain' | 'rich'

/** Attrs spread onto the panel element — carries the render mode as `data-render`. */
export interface TextRenderAttrs {
  'data-render': TextRender
}

/**
 * Map a node `format` to its render mode: `plain` text renders as `plain`;
 * `markdown` and `html` both render rich HTML, so both map to `rich`.
 */
export function textRender(format: TextNode['format']): TextRender {
  return format === 'plain' ? 'plain' : 'rich'
}

/** Resolve the render-state attribute set for the given format. */
export function resolveTextRender(format: TextNode['format']): TextRenderAttrs {
  return { 'data-render': textRender(format) }
}
