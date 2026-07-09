import { readFileSync } from 'fs'
import { resolve }      from 'path'
import { describe, it, expect } from 'vitest'

import { ExternalStore }        from './store-impl'
import { storeObs }             from './store'
import { registerDimension, getDimension } from './dimension'
import type { SectionContext }  from '../core/context'
import type { Observation }     from '../sdmx'

/**
 * Purity invariant for dimension.ts [AR-49 / M0].
 *
 * dimension.ts is the PEER of metric.ts and must remain a pure vocabulary leaf —
 * no registry/, no interpretSpec, no defaultRegistry imports. Violating this
 * creates a circular dependency (registry/ → data/spec.ts → dimension.ts →
 * registry/).
 *
 * If this test fails, move the offending logic to registry/resolvers.ts rather
 * than importing registry modules into dimension.ts.
 *
 * SEMANTIC guards (build item 11, now landed below):
 *   • FF-NO-PRIVILEGED-DIM         — Law 1: no hardcoded dimension NAME leaks into
 *                                    the metric/dimension resolution path.
 *   • FF-DIMENSION-MEMBERS-FROM-SDMX— Law 5: DimensionDef never SSOTs a member list;
 *                                    members resolve FROM the DSD (fromSDMX boundary).
 */
describe('dimension.ts — purity invariant', () => {
  const src = readFileSync(resolve(__dirname, 'dimension.ts'), 'utf8')

  // Strip single-line comments so the design-invariant comment block
  // ("must NOT import defaultRegistry …") does not self-trip the assertions.
  const code = src.split('\n')
    .filter(line => !line.trimStart().startsWith('//'))
    .join('\n')

  it('must not import from registry/', () => {
    expect(code).not.toMatch(/from ['"].*\/registry/)
  })

  it('must not reference interpretSpec', () => {
    expect(code).not.toMatch(/interpretSpec/)
  })

  it('must not reference defaultRegistry', () => {
    expect(code).not.toMatch(/defaultRegistry/)
  })
})

// ── stripComments — a full comment stripper (block + inline) ───────────
//
//  The purity block above strips only WHOLE `//` lines. The semantic scans below
//  must also strip `/** … */` JSDoc (which cites 'geo'|'time' as advisory role
//  examples) and inline trailing `//` comments, or documentation would self-trip
//  the Law-1 literal scan. The `(?<!:)` lookbehind spares the `//` in a URL (`://`).
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')                 // block comments, incl. /** … */
    .split('\n')
    .map((line) => {
      const i = line.search(/(?<!:)\/\//)
      return i >= 0 ? line.slice(0, i) : line
    })
    .join('\n')
}

// ── FF-NO-PRIVILEGED-DIM — Law 1, executable ───────────────────────────
//
//  No privileged dimensions: the metric/dimension vocabulary AND the measure-
//  resolution seam must treat every dimension as a generic Record key — never
//  hardcode or branch on a specific dimension NAME. The conventional time-axis key
//  is the TIME_DIM constant (core/context.ts), the ONE sanctioned SSOT; a raw
//  'time'/'geo'/'year'/'region' literal in the resolution path is the exact smell.
//  Scans the pure vocabulary leaves (dimension.ts, metric.ts) AND the binding-path
//  resolver (registry/resolvers.ts) — the files a metric/dimension ref flows through.
describe('FF-NO-PRIVILEGED-DIM — no hardcoded dimension name in the resolution path', () => {
  const PRIVILEGED_DIM = /(['"])(time|year|geo|region|regionId)\1/
  const files = ['dimension.ts', 'metric.ts', '../registry/resolvers.ts']

  for (const f of files) {
    it(`${f} branches on no privileged dimension literal (Law 1)`, () => {
      const code = stripComments(readFileSync(resolve(__dirname, f), 'utf8'))
      expect(code).not.toMatch(PRIVILEGED_DIM)
    })
  }
})

// ── FF-DIMENSION-MEMBERS-FROM-SDMX — Law 5, executable ─────────────────
//
//  A DimensionDef CURATES the DSD dimension (label / default / optional whitelist);
//  it never DUPLICATES the SDMX member list into config. The codelist stays the SSOT:
//  members resolve from the cube profile at the fromSDMX boundary. Two invariants —
//  structural (the type CANNOT hold a labelled member catalog) + behavioural (members
//  enumerate FROM the store, independent of any registered DimensionDef).
describe('FF-DIMENSION-MEMBERS-FROM-SDMX — members reference the DSD, never SSOT config', () => {
  const code = stripComments(readFileSync(resolve(__dirname, 'dimension.ts'), 'utf8'))

  it('DimensionDef.members? is a bare subset-reference of codes (DimVal[]), never a labelled catalog', () => {
    // A curation whitelist of CODES only. An array of { code, label } member objects
    // would duplicate the SDMX codelist into config — the Law 5 violation this forbids.
    expect(code).toMatch(/members\??:\s*DimVal\[\]/)
    expect(code).not.toMatch(/members\??:\s*(readonly\s*)?\{/)   // no inline {…}[] catalog
    expect(code).not.toMatch(/members\??:\s*Array</)             // no Array<{…}> catalog
  })

  it('resolved members come FROM the store (fromSDMX), independent of the DimensionDef whitelist', () => {
    // The DSD (here an ExternalStore of observations) is the members SSOT. A
    // DimensionDef.members whitelist only CURATES a subset for the picker; it neither
    // introduces a member the DSD lacks nor is the source the engine enumerates from.
    const obs: Observation[] = [
      { measure: 'B1G', value: 1, time: 2023, geo: 'GE' },
      { measure: 'B1G', value: 2, time: 2023, geo: 'AM' },
      { measure: 'B1G', value: 3, time: 2023, geo: 'AZ' },
    ]
    const store = new ExternalStore(obs)
    const ctx: SectionContext = { dims: { time: 2023 } }

    // Distinct 'geo' members enumerated FROM the store — the same storeObs-distinct
    // pattern resolveYears uses to read the time dimension's values from the DSD.
    const fromDsd = [...new Set(storeObs(store, { measure: 'B1G' }, ctx).map((o) => String(o['geo'])))].sort()
    expect(fromDsd).toEqual(['AM', 'AZ', 'GE'])

    // A curation whitelist that is a strict SUBSET of the DSD members.
    registerDimension('dim:geo', { code: 'geo', label: { en: 'Region' }, members: ['GE'] })
    const def = getDimension('dim:geo')!

    // The whitelist introduces NO member absent from the DSD …
    for (const m of def.members ?? []) expect(fromDsd).toContain(String(m))
    // … and does NOT shrink what the DSD reports — the store stays the members SSOT.
    expect(fromDsd.length).toBeGreaterThan((def.members ?? []).length)
  })
})
