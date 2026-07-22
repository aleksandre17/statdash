// @vitest-environment jsdom
// ── TextControl — a LocaleString value never leaks as [object Object] (0109 §SURFACED / 0110) ──
//
//  The dataTable "სვეტის სათაური" (colLabel) is a `string` schema field whose stored value
//  is a LocaleString `{ka,en}`. Handed raw to a plain <input value={value}> it renders
//  `[object Object]`. The fix resolves at the value site via `readLocale` (the i18n boundary
//  primitive) — so a string control shows the active-locale scalar for the object, string,
//  and absent forms alike.
//
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { TextControl } from './primitives'
import type { PropField } from '@statdash/react/engine'
import type { Locale } from '../../types/constructor'

const field = { field: 'colLabel', type: 'string' } as PropField

function value(v: unknown, locale: Locale = 'ka'): string {
  const { container } = render(
    <TextControl id="t" field={field} value={v} locale={locale} locales={['ka', 'en']} siblingValues={{}} onChange={vi.fn()} />,
  )
  return container.querySelector('input')!.value
}

describe('TextControl — LocaleString resolution at the value site', () => {
  it('resolves a LocaleString object to the active locale (never [object Object])', () => {
    expect(value({ ka: 'სათაური', en: 'Header' }, 'ka')).toBe('სათაური')
    expect(value({ ka: 'სათაური', en: 'Header' }, 'en')).toBe('Header')
  })

  it('passes a plain string through unchanged', () => {
    expect(value('plain')).toBe('plain')
  })

  it('renders empty for an absent value (honest empty, not "undefined")', () => {
    expect(value(undefined)).toBe('')
    expect(value(null)).toBe('')
  })
})
