// ── CSS codegen utilities ─────────────────────────────────────────────
//
//  toCSSVars    — extract CSS custom properties from NodeStyles
//  toDataAttrs  — extract data-* attributes from NodeStyles
//  toStyleString — inline style string for SSR (non-JSX contexts)
//
//  Used by: Constructor live preview · SSR style injection · debugging
//

import type { NodeStyles } from '../types'
import { applyNodeStyles } from '../resolvers/node'

// Extract all CSS custom properties emitted by applyNodeStyles.
// Useful for injecting vars into a preview iframe or SSR <style>.
export function toCSSVars(styles: NodeStyles | undefined): Record<string, string> {
  if (!styles) return {}
  const { style } = applyNodeStyles(styles)
  if (!style) return {}
  return Object.fromEntries(
    Object.entries(style).filter(([k]) => k.startsWith('--')),
  )
}

// Extract all data-* attributes emitted by applyNodeStyles.
// Useful for determining which CSS framework hooks are active.
export function toDataAttrs(styles: NodeStyles | undefined): Record<string, string> {
  if (!styles) return {}
  const attrs = applyNodeStyles(styles)
  return Object.fromEntries(
    Object.entries(attrs).filter(([k]) => k.startsWith('data-')),
  ) as Record<string, string>
}

// Serialize inline style dict to a CSS string (for SSR / non-JSX contexts).
// Converts camelCase keys to kebab-case; CSS vars (--*) pass through as-is.
// toStyleString({ height: 300, padding: '1rem' }) → 'height:300px;padding:1rem'
export function toStyleString(styles: NodeStyles | undefined): string {
  if (!styles) return ''
  const { style } = applyNodeStyles(styles)
  if (!style) return ''
  return Object.entries(style)
    .map(([k, v]) => {
      const prop = k.startsWith('--')
        ? k
        : k.replace(/([A-Z])/g, m => `-${m.toLowerCase()}`)
      return `${prop}:${v}`
    })
    .join(';')
}