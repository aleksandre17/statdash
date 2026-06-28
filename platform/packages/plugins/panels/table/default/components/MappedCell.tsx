// ── MappedCell — render a cell value through its value-mapping [EXP-06] ────────
//
//  Resolves a value against the column's declarative ValueMapping[] (Grafana value
//  mappings, token-bound) and renders the mapped TEXT + ICON, coloured by the mapped
//  semantic TOKEN. No match ⇒ the raw `fallback` (the formatted value).
//
//  a11y (WCAG 1.4.1 — no colour-only signal): the mapped TEXT carries the meaning and
//  is ALWAYS rendered; the colour is decoration (resolved through the token spine, so
//  it is tenant-overridable and contrast-governed — never a literal hex); the icon is
//  aria-hidden (the text is the accessible name).
//
import { applyValueMap }           from '@statdash/engine'
import type { ValueMapping }       from '@statdash/engine'
import { tokenCssVar }             from '@statdash/styles'
import { useResolveLocaleSafe }    from '@statdash/react'
import type { CSSProperties }      from 'react'

export function MappedCell({
  value, mappings, fallback,
}: { value: unknown; mappings?: ValueMapping[]; fallback: string }) {
  const resolve = useResolveLocaleSafe()
  const mapped  = applyValueMap(value, mappings)
  if (!mapped) return <>{fallback}</>

  const color = mapped.token ? tokenCssVar(mapped.token) : undefined
  const text  = mapped.text != null ? resolve(mapped.text) : fallback
  const style = color ? ({ color } as CSSProperties) : undefined

  return (
    <span className="value-mapped" style={style}>
      {mapped.icon && <span className="value-mapped__icon" data-icon={mapped.icon} aria-hidden="true" />}
      {text}
    </span>
  )
}
