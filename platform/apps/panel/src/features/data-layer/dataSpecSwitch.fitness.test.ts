// ── FF-NO-DATASPEC-SWITCH — the DataSpec composer is per-kind-free (ADR-049 P1) ──
//
//  ADR-049 P1 closes the Bounded-Element Law's *binding* axis: assembling a bound
//  element by DATA must be declaration-driven, not a `switch (spec.type)`. The
//  generic DataSpec composer (DataSpecEditor) must hold NO per-kind branch and NO
//  static per-kind editor import — it resolves a kind's authoring contract from the
//  engine (resolveSpecAuthoring) and dispatches schema→Inspector / editorKey→the
//  boot registry. A new bind-kind is one SPEC_CATALOG declaration (+ optionally one
//  registered editor), ZERO composer edits.
//
//  Ratchet (mirrors FF-DERIVED-CONTAINMENT): the allowlist BASELINE was the two
//  historical switch sites in DataSpecEditor (defaultSpec + SpecBody). P1 step 3
//  struck it to [] — a zero-tolerance gate; any NEW switch / per-kind import in the
//  composer reds the build.
//
//  Placement note ([[vitest-workspace-dirname]]): source-scanning via Vite's
//  import.meta.glob(?raw) — the browser module graph, no fs/__dirname.
//
import { describe, it, expect } from 'vitest'

// The GENERIC composer — the one authoring surface the law governs. The rich-editor
// REGISTRATION boundary (registerSpecEditors.ts) is deliberately NOT scanned: it is
// the sanctioned place for per-kind editor imports (like setupCanvasRegistry for node
// types), the exact indirection this gate exists to enable.
const COMPOSER_SOURCES = import.meta.glob(
  ['./DataSpecEditor.tsx'],
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1')
}

// A per-kind branch (any `switch (…)` — the composer dispatches via the registry,
// never a switch) OR a static per-kind editor import (`from './editors/…'`). Either
// reaches into a kind's identity from the generic composer — the anti-pattern P1 ends.
const DATASPEC_SWITCH      = /\bswitch\s*\(/
const PER_KIND_EDITOR_IMPORT = /from\s+['"]\.\/editors\//

// The ratchet allowlist — files exempted from the gate. Struck to [] at P1 step 3
// (was ['DataSpecEditor.tsx'] — the defaultSpec + SpecBody switches). Can only shrink.
const ALLOWLIST: string[] = []
const BASELINE = 0

const offenders = (re: RegExp): string[] =>
  Object.entries(COMPOSER_SOURCES)
    .filter(([, src]) => re.test(stripComments(src)))
    .map(([path]) => path.split('/').pop()!)
    .filter((name) => !ALLOWLIST.includes(name))
    .sort()

describe('FF-NO-DATASPEC-SWITCH — the DataSpec composer holds no per-kind wire (ADR-049 P1)', () => {
  it('scans a real composer source (guard is running, not vacuous)', () => {
    expect(Object.keys(COMPOSER_SOURCES).length).toBeGreaterThanOrEqual(1)
    const body = Object.values(COMPOSER_SOURCES)[0]!
    expect(body.length).toBeGreaterThan(200)
  })

  it('the generic DataSpec composer holds NO `switch (…)` (comments stripped)', () => {
    expect(offenders(DATASPEC_SWITCH)).toEqual([])
  })

  it('the generic DataSpec composer holds NO static per-kind editor import', () => {
    expect(offenders(PER_KIND_EDITOR_IMPORT)).toEqual([])
  })

  it('META: the ratchet allowlist is emptied and can only stay empty', () => {
    expect(ALLOWLIST.length).toBeLessThanOrEqual(BASELINE)
  })

  it('BITES: a planted switch / per-kind import IS detected (not vacuous)', () => {
    expect(DATASPEC_SWITCH.test("switch (value.type) { case 'query': return <Q/> }")).toBe(true)
    expect(PER_KIND_EDITOR_IMPORT.test("import { QuerySpecEditor } from './editors/QuerySpecEditor'")).toBe(true)
    // …and a mere comment mention does NOT trip it (prose allowed after stripping).
    expect(DATASPEC_SWITCH.test(stripComments('// dispatches without a switch over the type'))).toBe(false)
  })
})
