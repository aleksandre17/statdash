// ── FF-NO-MODE-LITERAL — the fused-mode literal can never regress [TM-STRANGLER] ─
//
//  THE LAW (DESIGN-time-mode-decision §0/§6, R3). A data view is the PRODUCT of
//  independent orthogonal axes; `year`/`range` are two VALUES of one axis, never two
//  hardcoded branches. So no engine code may compare an active perspective/mode against
//  a literal id (`=== 'year'`), nor sniff a two-arm `{ year, range }` fused carrier
//  (`'year' in x && 'range' in x`). The MED finding this epic killed lived at
//  `template.ts:74-75` (`if ('year' in tpl && 'range' in tpl) … === 'year'`); this gate
//  locks it out of `packages/core` + `packages/react` permanently — a grep fitness, the
//  bash twin of the same rule in check-laws.sh.
//
//  THE ONE DOCUMENTED NON-MODE LITERAL (kept, DESIGN R3): `i18n/format.ts` compares a
//  DATE-FORMAT kind `o?.format === 'year'` (year-vs-full date rendering) — a local
//  format option, NOT a perspective id. It is exempted narrowly (a `format === 'year'`
//  match), never a blanket suppression.
//
// @vitest-environment node

import { readFileSync, readdirSync, statSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { describe, it, expect } from 'vitest'
import { resolveTemplate } from './template'
import type { SectionContext } from '../core/context'

// ── The scan ──────────────────────────────────────────────────────────────────

const HERE = dirname(fileURLToPath(import.meta.url))
const CORE_SRC  = join(HERE, '..')                 // packages/core/src
const REACT_SRC = join(HERE, '..', '..', '..', 'react', 'src')  // packages/react/src

/** Recursively list .ts/.tsx files, skipping tests, declarations, and this scanner. */
function sourceFiles(root: string): string[] {
  let out: string[] = []
  let entries: string[]
  try { entries = readdirSync(root) } catch { return [] }   // react dir absent ⇒ skip
  for (const name of entries) {
    const full = join(root, name)
    if (statSync(full).isDirectory()) {
      if (name === 'node_modules' || name === 'dist') continue
      out = out.concat(sourceFiles(full))
      continue
    }
    if (!/\.(ts|tsx)$/.test(name)) continue
    if (/\.(test|fitness)\./.test(name)) continue        // tests reference the pattern deliberately
    if (name.endsWith('.d.ts')) continue
    out.push(full)
  }
  return out
}

// Forbidden fused-mode signatures (per source LINE):
//   • equality against a mode/grain literal other than 'year' (range/quarter/month are
//     never legit date-format kinds) — the `=== 'range'` perspective branch.
//   • the two-arm { year, range } membership sniff.
const FORBIDDEN: RegExp[] = [
  /===\s*['"](?:range|quarter|month)['"]/,        // mode/grain literal equality
  /['"](?:range|quarter|month)['"]\s*===/,        // …either operand order
  /['"](?:year|range)['"]\s+in\s+[A-Za-z_$]/,     // fused { year, range } membership test
]
// `=== 'year'` is forbidden EXCEPT the documented date-format kind (o.format === 'year').
const YEAR_EQ       = /===\s*['"]year['"]|['"]year['"]\s*===/
const LEGIT_YEAR_EQ = /format\s*===\s*['"]year['"]/

function violationsIn(file: string): string[] {
  const lines = readFileSync(file, 'utf8').split('\n')
  const hits: string[] = []
  lines.forEach((line, i) => {
    // Skip comment lines (prose describing the retired pattern is legitimate) — the
    // same exclusion the bash twin (check-laws.sh check_ts) applies.
    const trimmed = line.trim()
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return
    const forbidden = FORBIDDEN.some((re) => re.test(line))
    const yearEq    = YEAR_EQ.test(line) && !LEGIT_YEAR_EQ.test(line)
    if (forbidden || yearEq) hits.push(`${file}:${i + 1}: ${line.trim()}`)
  })
  return hits
}

describe('FF-NO-MODE-LITERAL — no fused-mode literal in the engine or react', () => {
  it('packages/core + packages/react carry ZERO fused-mode `=== \'year\'`/two-arm branches', () => {
    const files = [...sourceFiles(CORE_SRC), ...sourceFiles(REACT_SRC)]
    // Non-vacuous: the scan actually reached a meaningful body of source.
    expect(files.length).toBeGreaterThan(50)
    const violations = files.flatMap(violationsIn)
    expect(violations, `fused-mode literals found:\n${violations.join('\n')}`).toEqual([])
  })

  it('the gate BITES — a synthetic fused branch would be caught', () => {
    // Prove the matcher is real (guards against a vacuous regex that never fires).
    const sample = "return activePerspective(s) === 'range' ? a : b"
    expect(FORBIDDEN.some((re) => re.test(sample))).toBe(true)
    const sniff = "if ('year' in tpl && 'range' in tpl) {}"
    expect(FORBIDDEN.some((re) => re.test(sniff))).toBe(true)
    // And the documented date-format kind is NOT a violation.
    const legit = "date: (d, o) => o?.format === 'year' ? y : full"
    expect(YEAR_EQ.test(legit) && !LEGIT_YEAR_EQ.test(legit)).toBe(false)
  })
})

// ── The generic replacement it enables — the perspective-keyed carrier ─────────
//
//  resolveTemplate now collapses a `Record<perspectiveId, string>` to the ACTIVE
//  perspective's arm by KEY lookup — generic over N perspectives, no literal. These
//  assertions prove the byte-identity of the old two-mode behaviour AND the N>2
//  generality the literal blocked.

const ctxFor = (mode: string | undefined): SectionContext => ({
  dims: {},
  ...(mode !== undefined ? { perspectiveState: { mode } } : {}),
})

describe('resolveTemplate — perspective-keyed carrier resolves generically (post literal-kill)', () => {
  const carrier = { year: 'ANNUAL', range: 'DYNAMICS' }

  it('resolves to the ACTIVE perspective arm (byte-identical to the old year/range branch)', () => {
    expect(resolveTemplate(carrier, ctxFor('year'))).toBe('ANNUAL')
    expect(resolveTemplate(carrier, ctxFor('range'))).toBe('DYNAMICS')
  })

  it('generalises to N perspectives — a THIRD arm the two-arm literal could never reach', () => {
    const triad = { year: 'A', range: 'B', compare: 'C' }
    expect(resolveTemplate(triad, ctxFor('compare'))).toBe('C')
  })

  it('a { ka, en } LocaleString is NOT mistaken for a carrier (no perspective-id key)', () => {
    const loc = { ka: 'წელი', en: 'Year' }
    // active perspective 'year' is not a key ⇒ falls through to locale resolution.
    expect(resolveTemplate(loc, { dims: {}, perspectiveState: { mode: 'year' }, locale: 'en' })).toBe('Year')
    expect(resolveTemplate(loc, { dims: {}, perspectiveState: { mode: 'year' }, locale: 'ka' })).toBe('წელი')
  })

  it('substitutes ctx.dims into the resolved arm ({time} template)', () => {
    const c = { year: 'updated: {time}', range: '{fromYear}' }
    expect(resolveTemplate(c, { dims: { time: 2024 }, perspectiveState: { mode: 'year' } })).toBe('updated: 2024')
  })
})
