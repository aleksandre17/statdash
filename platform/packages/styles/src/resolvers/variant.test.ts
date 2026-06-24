// ── resolveVariants — unit tests ──────────────────────────────────────
//
//  The variant resolver is the styles half of the shell-variant-style spine
//  (it sits beside resolveViewState): declared variants + authored values →
//  `data-*` attribute bag the shell spreads, zero class coupling. Pure, so it
//  is exhaustively unit-testable here without React.
//
// @vitest-environment node

import { describe, it, expect } from 'vitest'
import { resolveVariants } from './variant'
import type { VariantSchemaShape } from './variant'

const emphasis: VariantSchemaShape = {
  emphasis: { attr: 'data-emphasis', kind: 'enum' },
}

const flagged: VariantSchemaShape = {
  pinned: { attr: 'data-pinned', kind: 'flag' },
}

describe('resolveVariants — enum kind', () => {
  it('projects the authored enum value as the attr value', () => {
    expect(resolveVariants(emphasis, { emphasis: 'hero' })).toEqual({ 'data-emphasis': 'hero' })
    expect(resolveVariants(emphasis, { emphasis: 'compact' })).toEqual({ 'data-emphasis': 'compact' })
  })

  it('omits the attr when the enum is unset / empty', () => {
    expect(resolveVariants(emphasis, {})).toEqual({})
    expect(resolveVariants(emphasis, { emphasis: '' })).toEqual({})
    expect(resolveVariants(emphasis, undefined)).toEqual({})
  })

  it('falls back to the declared default when authored value is absent', () => {
    const withDefault: VariantSchemaShape = {
      emphasis: { attr: 'data-emphasis', kind: 'enum', default: 'compact' },
    }
    expect(resolveVariants(withDefault, {})).toEqual({ 'data-emphasis': 'compact' })
    // an authored value overrides the default
    expect(resolveVariants(withDefault, { emphasis: 'hero' })).toEqual({ 'data-emphasis': 'hero' })
  })
})

describe('resolveVariants — flag kind', () => {
  it('projects a present flag as an empty-string attr (presence)', () => {
    expect(resolveVariants(flagged, { pinned: true })).toEqual({ 'data-pinned': '' })
  })

  it('omits the attr when the flag is false / absent', () => {
    expect(resolveVariants(flagged, { pinned: false })).toEqual({})
    expect(resolveVariants(flagged, {})).toEqual({})
  })
})

describe('resolveVariants — edge cases', () => {
  it('returns {} when the schema is undefined (slice declares no variants)', () => {
    expect(resolveVariants(undefined, { anything: 'x' })).toEqual({})
  })

  it('resolves multiple declared variants independently', () => {
    const multi: VariantSchemaShape = {
      emphasis: { attr: 'data-emphasis', kind: 'enum' },
      pinned:   { attr: 'data-pinned',   kind: 'flag' },
    }
    expect(resolveVariants(multi, { emphasis: 'hero', pinned: true }))
      .toEqual({ 'data-emphasis': 'hero', 'data-pinned': '' })
  })

  it('ignores authored keys with no matching declaration (no orphan attrs)', () => {
    expect(resolveVariants(emphasis, { emphasis: 'hero', stray: 'ignored' }))
      .toEqual({ 'data-emphasis': 'hero' })
  })
})
