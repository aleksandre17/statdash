// @vitest-environment node
//
// ── cartesian-decomposition.fitness — lock the AR-45 seam + OCP discipline ────
//
//  The cartesian builder was decomposed (AR-45) from a 397-line God-function into
//  a pipe-and-filter of pure slice-builders + a resolved FAMILY_TRAITS descriptor.
//  These structural guards keep the decomposition from silently eroding back into
//  scattered family conditionals:
//
//    (a) FAMILY_TRAITS is exhaustive over CartesianFamily (compiler enforces it via
//        the Record type; this adds a runtime key-count guard + familyOf identity).
//    (b) Slices switch on RESOLVED discriminants (seriesMode / fillMode / strokeMode
//        / apexType / …), never on the raw family-dispatch flags (`type ===`,
//        isWaterfall, isCombo) that those enums replaced. families.ts + context.ts
//        are the sanctioned homes of the raw `type` reads. (isStackedArea is a
//        resolved LAYOUT flag shared by axes + grid — not a family-dispatch flag —
//        so it is intentionally not forbidden.)
//    (c) No cssVar call at module scope — a color hoisted to module load would
//        FREEZE the theme (AR-14: chrome must read the token per build). Every
//        cssVar call must sit inside a function body (indented).
//    (d) Every cartesian/*.ts stays under the 200-line soft ceiling.
//

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { FAMILY_TRAITS, familyOf } from './cartesian/families'
import type { CartesianFamily } from './cartesian/families'

const DIR = fileURLToPath(new URL('./cartesian', import.meta.url))
const FILES = readdirSync(DIR).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))

const read = (f: string): string => readFileSync(`${DIR}/${f}`, 'utf8')

/** Strip block + line comments so the discipline scan only sees real code. */
function stripComments(src: string): string {
  return src
      .replace(/\/\*[\s\S]*?\*\//g, '')       // block comments
      .replace(/(^|[^:])\/\/.*$/gm, '$1')     // line comments (leaves :// in URLs alone)
}

describe('(a) FAMILY_TRAITS is exhaustive over CartesianFamily', () => {
  const families: CartesianFamily[] = ['bar', 'hbar', 'line', 'area', 'waterfall', 'combo']

  it('has exactly the six family entries', () => {
    expect(Object.keys(FAMILY_TRAITS).sort()).toEqual([...families].sort())
  })

  it('familyOf maps each family string back to itself', () => {
    for (const f of families) expect(familyOf(f)).toBe(f)
  })
})

describe('(b) slices switch on resolved discriminants, not raw family literals', () => {
  const FORBIDDEN = [/\btype\s*===/, /\bisWaterfall\b/, /\bisCombo\b/]
  // families.ts + context.ts are the ONLY sanctioned homes of the raw `type` reads.
  const slices = FILES.filter((f) => f !== 'families.ts' && f !== 'context.ts')

  for (const f of slices) {
    it(`${f} contains no type===/isWaterfall/isCombo`, () => {
      const code = stripComments(read(f))
      for (const re of FORBIDDEN) expect(code, `${f} must not use ${re}`).not.toMatch(re)
    })
  }
})

describe('(c) no cssVar call at module scope (theme-freeze guard)', () => {
  for (const f of FILES) {
    it(`${f} calls cssVar only inside function bodies`, () => {
      const offenders = stripComments(read(f))
          .split('\n')
          .filter((ln) => /cssVar\s*\(/.test(ln) && /^\S/.test(ln)) // column-0 = module scope
      expect(offenders, `module-scope cssVar in ${f}`).toEqual([])
    })
  }
})

describe('(d) every cartesian module stays under the 200-line soft ceiling', () => {
  for (const f of FILES) {
    it(`${f} < 200 lines`, () => {
      expect(read(f).split('\n').length).toBeLessThan(200)
    })
  }
})
