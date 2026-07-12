// ── FF-STYLE-ROUNDTRIP — token-authored view.styles renders + serializes losslessly ─
//
//  The STYLE facet's authoring→render→serialize→re-parse invariant (DESIGN §8 FF-3):
//    1. A picked token serializes to its `cssVar` string (the value the picker offers).
//    2. `applyNodeStyles` RENDERS that value (the canvas restyles live).
//    3. JSON round-trip (serialize → re-parse) re-selects the SAME picker option — the
//       cssVar IS the identity, so the reverse-map is a trivial equality (no lookup table).
//    4. Clearing the last property collapses `view.styles` to undefined (byte-clean).
//  Kept PURE (no DOM) — drives the StyleField's reducer + the token source directly.
//
import { describe, it, expect } from 'vitest'
import { applyNodeStyles } from '@statdash/styles'
import { setStyleProp, flatStyleValue, isTokenValue } from './styleFieldModel'
import { tokenOptions } from '../../discovery/tokenCatalogOptions'

describe('FF-STYLE-ROUNDTRIP — token-picked style authors, renders, serializes losslessly', () => {
  it('the token source resolves catalog options, scoped by group (enum-ref tokens activated)', () => {
    const spacing = tokenOptions('spacing', 'en')
    expect(spacing.length).toBeGreaterThan(0)
    // Every option is a themeable var() with a label — the constrained vocabulary.
    expect(spacing.every((o) => isTokenValue(o.value))).toBe(true)
    expect(spacing.every((o) => o.group === 'spacing')).toBe(true)
    // Group scoping is real: colours are a DISJOINT option set from spacing.
    const color = tokenOptions('color', 'en')
    expect(color.some((o) => spacing.some((s) => s.value === o.value))).toBe(false)
    // Unscoped = the whole CSS-authorable catalog (superset of any one group).
    expect(tokenOptions(undefined, 'en').length).toBeGreaterThan(spacing.length)
  })

  it('a picked token writes into view.styles and applyNodeStyles renders it', () => {
    const pad = tokenOptions('spacing', 'en')[0]!    // e.g. var(--spacing-0)
    const styles = setStyleProp(undefined, 'padding', pad.value)
    expect(styles).toEqual({ padding: pad.value })
    // The render side already consumes it — the value flows to an inline style attr.
    const attrs = applyNodeStyles(styles)
    expect(JSON.stringify(attrs.style)).toContain(pad.value)
  })

  it('authoring → serialize → re-parse re-selects the SAME picker state (lossless)', () => {
    const color = tokenOptions('color', 'en')[0]!
    const radius = tokenOptions('radii', 'en')[0]!
    let styles = setStyleProp(undefined, 'color', color.value)
    styles = setStyleProp(styles, 'borderRadius', radius.value)

    // Serialize (what persists) then re-parse (what re-hydrates the inspector).
    const reparsed = JSON.parse(JSON.stringify(styles))

    // The picker re-reads each property's flat value — identical to what was authored.
    expect(flatStyleValue(reparsed, 'color')).toBe(color.value)
    expect(flatStyleValue(reparsed, 'borderRadius')).toBe(radius.value)
    // …and each re-selects a real catalog option (the cssVar === option.value identity).
    expect(tokenOptions('color', 'en').some((o) => o.value === flatStyleValue(reparsed, 'color'))).toBe(true)
  })

  it('a raw escape value round-trips too (Tailwind [13px] discipline, governed)', () => {
    const styles = setStyleProp(undefined, 'fontSize', '13px')
    expect(flatStyleValue(styles, 'fontSize')).toBe('13px')
    expect(isTokenValue('13px')).toBe(false)   // flagged as off-token (a warn, not a block)
  })

  it('clearing the last property collapses view.styles to undefined (byte-clean)', () => {
    const one = setStyleProp(undefined, 'gap', 'var(--spacing-md)')
    expect(one).toEqual({ gap: 'var(--spacing-md)' })
    const cleared = setStyleProp(one, 'gap', undefined)
    expect(cleared).toBeUndefined()
  })

  it('setStyleProp is immutable — the input object is never mutated', () => {
    const before = { padding: 'var(--spacing-md)' }
    const after = setStyleProp(before, 'margin', 'var(--spacing-lg)')
    expect(before).toEqual({ padding: 'var(--spacing-md)' })   // untouched
    expect(after).toEqual({ padding: 'var(--spacing-md)', margin: 'var(--spacing-lg)' })
  })
})
