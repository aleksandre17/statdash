// @vitest-environment jsdom
//
// ── FF-VALUE-MAPPING — value mappings resolve through tokens, never literal colour ──
//
//  THE INVARIANT (EXP-06 raises-the-bar): a value-mapping's colour is a SEMANTIC
//  TOKEN, not a literal hex. Grafana bakes a hex per rule; ours binds a registered
//  token KEY resolved through the spine — so a mapping re-themes per tenant and can
//  never silently fail contrast or smuggle a hardcoded colour into config.
//
//  This gate proves the RUNTIME half (the authoring-schema "no free hex" half is at
//  apps/panel, where the schema lives):
//    1. RESOLUTION — every mapping token resolves to a CSS `var(--…)` (the tenant-
//       overridable spine), never a baked hex.
//    2. a11y (WCAG 1.4.1) — the consumed cell renders the mapped TEXT (the meaning),
//       not colour alone; the icon is aria-hidden.
//    3. fallback — no match ⇒ the raw formatted value (never a blank cell).
//
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { applyValueMap }           from '@statdash/engine'
import type { ValueMapping }       from '@statdash/engine'
import { isRegisteredColorToken, tokenCssVar } from '@statdash/styles'
import { MappedCell }                          from '../panels/table/default/components/MappedCell'

afterEach(() => cleanup())

// A representative status-mapping set an author would build (good/warning/critical +
// a special-null), each colour bound to a registered semantic token.
const STATUS_MAPPINGS: ValueMapping[] = [
  { match: { kind: 'empty' },               text: { ka: 'არ არის', en: 'No data' }, token: 'status.info-fg' },
  { match: { kind: 'range', to: 0 },        text: { ka: 'ვარდნა',  en: 'Down' },    token: 'status.negative-fg', icon: 'arrow-down' },
  { match: { kind: 'range', from: 0, to: 5 }, text: { ka: 'სტაბ.',  en: 'Flat' },    token: 'status.warning-fg' },
  { match: { kind: 'range', from: 5 },      text: { ka: 'ზრდა',    en: 'Up' },       token: 'status.positive-fg', icon: 'arrow-up' },
]

describe('FF-VALUE-MAPPING — token-bound, no literal colour', () => {
  // The STRUCTURAL "no free hex" guarantee (the authoring schema's colour field is an
  // enum-ref over `tokens`) is asserted at the authoring tier where the schema lives:
  // apps/panel valueMappingAuthorable.fitness.test.ts. This gate proves the RUNTIME
  // half: a mapping's token always resolves through the spine, never to a literal.

  it('1. RESOLUTION — every mapping token is a registered colour token → CSS var(--…)', () => {
    for (const m of STATUS_MAPPINGS) {
      if (!m.token) continue
      expect(isRegisteredColorToken(m.token), `${m.token} must be a registered token`).toBe(true)
      const v = tokenCssVar(m.token)
      expect(v, `${m.token} resolves to a themeable var()`).toMatch(/^var\(--.+\)$/)
      // A resolved colour is NEVER a baked hex (that would defeat tenant theming).
      expect(v).not.toMatch(/#[0-9a-fA-F]{3,8}/)
    }
  })

  it('2. a11y — the consumed cell renders the mapped TEXT (no colour-only signal)', () => {
    const mapped = applyValueMap(-3, STATUS_MAPPINGS)
    expect(mapped?.token).toBe('status.negative-fg')
    render(<table><tbody><tr><td>
      <MappedCell value={-3} mappings={STATUS_MAPPINGS} fallback="-3" />
    </td></tr></tbody></table>)
    // The meaning is carried by TEXT, present regardless of colour.
    expect(screen.getByText('Down')).toBeInTheDocument()
    // The icon (if any) is decorative — aria-hidden, never the accessible name.
    const icon = document.querySelector('.value-mapped__icon')
    expect(icon?.getAttribute('aria-hidden')).toBe('true')
  })

  it('falls back to the raw formatted value when no rule matches (no blank cell)', () => {
    render(<table><tbody><tr><td>
      <MappedCell value={'unmapped'} mappings={STATUS_MAPPINGS} fallback="raw-99" />
    </td></tr></tbody></table>)
    expect(screen.getByText('raw-99')).toBeInTheDocument()
  })
})
