// ── useActiveLocales hook — reads the site SSOT, degrades gracefully ─────────
//
//  Drives the REAL Zustand store (not a mock) so the wiring under test is the
//  actual site → useActiveLocales path the Inspector/LocaleField rely on.
//
import { describe, it, expect, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useConstructorStore } from '../store/constructor.store'
import { useActiveLocales } from './useActiveLocales'

const baseSite = () => useConstructorStore.getState().site
function setSite(patch: Partial<ReturnType<typeof baseSite>>) {
  useConstructorStore.setState({ site: { ...baseSite(), ...patch } })
}

afterEach(() => {
  // Restore the initial empty active set so tests don't leak state.
  setSite({ activeLocales: [], defaultLocale: 'ka' })
})

describe('useActiveLocales — the site active-locale set', () => {
  it('returns the site activeLocales projection when present', () => {
    setSite({ activeLocales: ['en', 'ka'], defaultLocale: 'ka' })
    const { result } = renderHook(() => useActiveLocales())
    expect(result.current).toEqual(['en', 'ka'])
  })

  it('falls back to default-first platform set when activeLocales is empty', () => {
    setSite({ activeLocales: [], defaultLocale: 'en' })
    const { result } = renderHook(() => useActiveLocales())
    expect(result.current).toEqual(['en', 'ka'])
  })
})
