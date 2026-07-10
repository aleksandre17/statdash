// ── FF-ONE-EMPTYSTATE — one empty-state doctrine (AR-49 M4 Wave 0) ─────────────
//
//  The "no page / no selection / blank page" copy used to be inlined in FIVE places
//  (canvas, Layers, and 3× stacked in the Inspector). That is a DRY + UX defect (the
//  Inspector printed "No page selected" three times in a column). The doctrine: the
//  copy is emitted by EXACTLY ONE component (StudioEmptyState) and the retired
//  duplicated literals exist nowhere else. This guard locks both, red-on-regression.
//
import { describe, it, expect } from 'vitest'

// All panel sources as raw text (Vite ?raw) — browser-graph typed, no fs dependency.
const ALL = import.meta.glob(['../**/*.ts', '../**/*.tsx'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

// The shipping (non-test) sources.
const SOURCES = Object.entries(ALL).filter(
  ([p]) => !p.includes('.test.') && !p.includes('.fitness.'),
)

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1')
}

// The exact phrases that were duplicated across surfaces before the doctrine. They
// must now appear in ZERO shipping code (StudioEmptyState uses distinct, single-home
// copy). Comment mentions are stripped, so documenting the history is allowed.
const RETIRED_LITERALS = ['No page selected', 'გვერდი არ არის არჩეული']

describe('FF-ONE-EMPTYSTATE — the empty-state copy lives in exactly one component', () => {
  it('scans the panel sources (the guard is actually running)', () => {
    expect(SOURCES.length).toBeGreaterThan(20)
  })

  it('exactly one component renders an empty-state (owns the data-empty-state-kind marker)', () => {
    const owners = SOURCES.filter(([, src]) => /data-empty-state-kind=/.test(src)).map(([p]) => p)
    expect(owners).toHaveLength(1)
    expect(owners[0]).toMatch(/StudioEmptyState\.tsx$/)
  })

  it('that one component defines all three discriminated kinds', () => {
    const owner = SOURCES.find(([p]) => p.endsWith('StudioEmptyState.tsx'))
    expect(owner).toBeDefined()
    for (const kind of ['no-pages', 'page-blank', 'no-selection']) {
      expect(owner![1]).toContain(kind)
    }
  })

  it('no shipping source inlines a retired duplicated empty-state literal', () => {
    for (const literal of RETIRED_LITERALS) {
      const offenders = SOURCES
        .filter(([, src]) => stripComments(src).includes(literal))
        .map(([p]) => p)
      expect(offenders).toEqual([])
    }
  })

  it('the guard actually bites — a planted inline literal + a second owner are detected', () => {
    expect(stripComments('const x = "No page selected"').includes('No page selected')).toBe(true)
    expect(/data-empty-state-kind=/.test('<Box data-empty-state-kind="x" />')).toBe(true)
  })
})
