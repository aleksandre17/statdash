// @vitest-environment node
//
// i18next is an optional peer installed only at the app tier — not in the
// platform root or engine/react. EmptyState + ExportMenu import useT from
// SiteContext which imports i18next; we mock the module here to avoid the
// "Could not resolve i18next" error that hits any test importing those files.
// The mock is declared before all imports so Vite's static hoisting works.
import { describe, it, expect, vi } from 'vitest'

vi.mock('i18next', () => ({
  default: { use: () => ({}) },
  t: (k: string) => k,
}))

import { PANEL_LAYOUT } from '../../../components/PanelLayout'
import { EMPTY_STATE }  from '../../../components/feedback/EmptyState'
import { EXPORT_MENU }  from '../../../components/feedback/ExportMenu'

describe('InjectionToken fitness', () => {
  const tokens = [PANEL_LAYOUT, EMPTY_STATE, EXPORT_MENU]

  it('all descriptions are unique (no silent Map collision)', () => {
    const descriptions = tokens.map(t => t.description)
    expect(new Set(descriptions).size).toBe(descriptions.length)
  })

  it('all descriptions are non-empty strings', () => {
    tokens.forEach(t => {
      expect(typeof t.description).toBe('string')
      expect(t.description.length).toBeGreaterThan(0)
    })
  })
})
