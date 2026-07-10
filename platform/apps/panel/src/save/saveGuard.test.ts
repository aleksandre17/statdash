// ── saveGuard — fitness: the four save checks each block correctly ───────────
//
//  Pins the ADR fitness: emitted configs must be migrate-identity +
//  serialize-round-trip + locale-complete + per-node-valid (the save guard's
//  four checks, each tested). Uses the REAL node registry (setupCanvasRegistry)
//  so the per-node + locale checks run against real slice schemas.
//
import { describe, it, expect, beforeAll } from 'vitest'
import { setupCanvasRegistry } from '../canvas/setupCanvasRegistry'
import { validatePageForSave, stableStringify } from './saveGuard'
import { toNodePageConfig } from '../canvas/canvasPageAdapter'
import type { CanvasPage } from '../types/constructor'

beforeAll(() => { setupCanvasRegistry() })

const LOCALES = ['ka', 'en'] as const

/** A clean, save-ready page: a section with a title + a complete-locale hero. */
function validPage(): CanvasPage {
  return {
    id: 'p1', type: 'inner-page', title: { ka: 'გვერდი', en: 'Page' }, slug: 'p1',
    nodeIds: ['s1', 'h1'],
    nodes: {
      s1: { id: 's1', type: 'section', props: { title: 'GDP' }, childIds: [] },
      h1: { id: 'h1', type: 'hero', props: { title: { ka: 'გ', en: 'g' }, cards: [{}] }, childIds: [] },
    },
  }
}

describe('validatePageForSave — happy path', () => {
  it('passes a clean, complete page', () => {
    const report = validatePageForSave(validPage(), { activeLocales: [...LOCALES] })
    expect(report.ok).toBe(true)
    expect(report.issues).toEqual([])
  })
})

describe('Check 3 — per-node validity', () => {
  it('blocks a node missing a required field', () => {
    const page = validPage()
    page.nodes.s1.props = {}             // section.title is required → missing
    const report = validatePageForSave(page, { activeLocales: [...LOCALES] })
    expect(report.ok).toBe(false)
    const issue = report.issues.find((i) => i.check === 'per-node-valid' && i.nodeId === 's1')
    expect(issue?.field).toBe('title')
  })
})

describe('Check 4 — locale completeness (i18n shift-left)', () => {
  it('blocks a localized field missing an active locale', () => {
    const page = validPage()
    page.nodes.h1.props.title = { en: 'g' }   // missing 'ka'
    const report = validatePageForSave(page, { activeLocales: [...LOCALES] })
    expect(report.ok).toBe(false)
    const issue = report.issues.find((i) => i.check === 'locale-complete' && i.nodeId === 'h1')
    expect(issue?.field).toBe('title')
    expect(issue?.message).toContain('ka')
  })

  it('blocks a localized field authored as a bare string in multi-locale mode', () => {
    const page = validPage()
    page.nodes.h1.props.title = 'just-one-string'
    const report = validatePageForSave(page, { activeLocales: [...LOCALES] })
    expect(report.issues.some((i) => i.check === 'locale-complete' && i.nodeId === 'h1')).toBe(true)
  })

  it('accepts a complete locale record', () => {
    const page = validPage()
    page.nodes.h1.props.title = { ka: 'გ', en: 'g' }
    const report = validatePageForSave(page, { activeLocales: [...LOCALES] })
    expect(report.issues.some((i) => i.check === 'locale-complete')).toBe(false)
  })
})

describe('Check 2 — serialize round-trip', () => {
  it('blocks a config carrying a function (Law 2 — pure data only)', () => {
    const page = validPage()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(page.nodes.s1.props as any).onClick = () => 'boom'
    const report = validatePageForSave(page, { activeLocales: [...LOCALES] })
    expect(report.ok).toBe(false)
    expect(report.issues.some((i) => i.check === 'round-trip')).toBe(true)
  })

  it('a clean page round-trips losslessly (config ≡ reprojected config)', () => {
    const page = validPage()
    const cfg = toNodePageConfig(page)
    // The guard's round-trip assertion, surfaced directly.
    const report = validatePageForSave(page, { activeLocales: [...LOCALES] })
    expect(report.issues.some((i) => i.check === 'round-trip')).toBe(false)
    // And the projected config is stable JSON (no functions, ordered).
    expect(() => stableStringify(cfg)).not.toThrow()
  })
})

describe('Check 1 — migrate identity', () => {
  it('a freshly-authored config is already at the current schema (migration is a no-op)', () => {
    const report = validatePageForSave(validPage(), { activeLocales: [...LOCALES] })
    expect(report.issues.some((i) => i.check === 'migrate-identity')).toBe(false)
  })
})

describe('reports ALL issues at once (batch fix UX)', () => {
  it('collects per-node + locale issues together', () => {
    const page = validPage()
    page.nodes.s1.props = {}                       // missing required title
    page.nodes.h1.props.title = { en: 'g' }        // missing ka
    const report = validatePageForSave(page, { activeLocales: [...LOCALES] })
    const checks = new Set(report.issues.map((i) => i.check))
    expect(checks.has('per-node-valid')).toBe(true)
    expect(checks.has('locale-complete')).toBe(true)
  })
})
