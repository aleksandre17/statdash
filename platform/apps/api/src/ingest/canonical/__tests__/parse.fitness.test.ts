// ── Fitness functions — canonical workbook parser (ADR-0031 §2, §8) ───────────
//
// THE INVARIANTS this locks (the parser is a thin, pure, lossless, SELF-DESCRIBING
// deserializer):
//   F-1  parser purity — the bronze of all 3 real canonical fixtures is snapshotted
//        (read via read-workbook → parse → snapshot), so any drift in the emitted
//        contract is caught.
//   F-5  every emitted dimKey key ∈ dsd.dimensions (Law 1 — no hardcoded dim names;
//        the keys are EXACTLY the DSD non-time dims, so validateObs passes by
//        construction).
//   F-6  CanonicalDsd is JSON-lossless (plain data, round-trips).
//   F-LANG a synthetic CL with `name_fr`: fr active → fr label; fr inactive →
//        ignored (no leak) — `name_<lang>` ∩ activeLocales, no hardcoded ['ka','en'].
//   F-DIM a synthetic 4th dataset with a never-seen dim name parses with zero edits.
//   F-3  is enforced by eslint (xlsx confined to read-workbook.ts), not here.
//
// These tests are PURE (no DB) — they run unconditionally (not DB-gated). Engine-
// style synthetic tests use en/fr (never `ka` literals); the real fixtures legitimately
// carry `ka` (API-side data, ADR §4 improvement 1).

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { readWorkbook, type SheetMatrices } from '../read-workbook.js'
import { parseCanonicalWorkbook } from '../parse.js'
import type { CanonicalDsd } from '../types.js'

// ── Locate DATA/canonical robustly (walk up until found — no brittle ../../../) ─
function findDataDir(): string {
  let dir = dirname(fileURLToPath(import.meta.url))
  for (let i = 0; i < 12; i++) {
    const candidate = join(dir, 'DATA', 'canonical')
    if (existsSync(candidate)) return candidate
    const up = resolve(dir, '..')
    if (up === dir) break
    dir = up
  }
  throw new Error('Could not locate DATA/canonical fixtures by walking up from the test file')
}

const DATA_DIR = findDataDir()
const ACTIVE = { activeLocales: ['ka', 'en'] }

function loadFixture(code: string): SheetMatrices {
  return readWorkbook(readFileSync(join(DATA_DIR, `${code}.xlsx`)))
}

// The verified-on-disk obs counts (ADR §2, probed). The regression anchor.
const EXPECTED = [
  { code: 'ACCOUNTS_SEQUENCE', obs: 415, dims: ['time', 'account', 'side', 'measure'] },
  { code: 'GDP_ANNUAL',        obs: 288, dims: ['time', 'approach', 'measure', 'geo'] },
  { code: 'REGIONAL_GVA',      obs: 1554, dims: ['time', 'geo', 'sector', 'measure'] },
] as const

describe('canonical parser — real fixtures (F-1 purity, F-5 Law-1)', () => {
  for (const { code, obs, dims } of EXPECTED) {
    describe(code, () => {
      const sheets = loadFixture(code)
      const { dsd, bronze, parseIssues } = parseCanonicalWorkbook(sheets, ACTIVE)

      it('parses with zero structural issues', () => {
        expect(parseIssues, JSON.stringify(parseIssues)).toEqual([])
      })

      it('reads the DSD from STRUCTURE (datasetCode + ordered dimensions)', () => {
        expect(dsd.datasetCode).toBe(code)
        expect(dsd.dimensions).toEqual(dims)
        expect(dsd.measureConcept).toBe('OBS_VALUE')
        // name + meta come from STRUCTURE; both locales present (real ka/en data).
        expect(dsd.name.en).toBeTruthy()
        expect(dsd.name.ka).toBeTruthy()
        expect(dsd.meta.source).toBe('GeoStat')
        expect(dsd.meta.unit_default).toBe('GEL_MN')
      })

      it(`emits exactly ${obs} observations (lossless — one DATA value → one obs)`, () => {
        expect(bronze.obs.length).toBe(obs)
      })

      it('F-5: every emitted dimKey key ∈ dsd.dimensions (Law 1)', () => {
        const allowed = new Set(dsd.dimensions.filter((d) => d !== 'time'))
        for (const row of bronze.obs) {
          for (const k of Object.keys(row.dimKey)) {
            expect(allowed.has(k), `dimKey key "${k}" not in dimensions`).toBe(true)
          }
          // set-equality with the DSD non-time dims (validateObs passes by construction)
          expect(new Set(Object.keys(row.dimKey))).toEqual(allowed)
        }
      })

      it('declares a `declared` codelistRef per non-time dim', () => {
        for (const dim of dims) {
          if (dim === 'time') continue
          expect(dsd.codelistRefs[dim]).toEqual({ kind: 'declared', dim })
        }
      })

      it('emits classifier rows with ka+en labels and rowIndex', () => {
        expect(bronze.classifiers.length).toBeGreaterThan(0)
        for (const cl of bronze.classifiers) {
          expect(cl.code).toBeTruthy()
          expect(typeof cl.rowIndex).toBe('number')
          // Every member carries at least one active-locale label (no blank member).
          expect(Object.keys(cl.label).length).toBeGreaterThan(0)
        }
      })

      it('does not duplicate observations per language (displays empty)', () => {
        expect(bronze.displays).toEqual([])
      })

      it('F-1: bronze contract is stable (snapshot of the first/last obs + counts)', () => {
        // A focused snapshot: counts + boundary rows (full-array snapshots of 1554
        // rows are noisy; the count + endpoints + a sample classifier pin the shape).
        expect({
          obsCount: bronze.obs.length,
          classifierCount: bronze.classifiers.length,
          firstObs: bronze.obs[0],
          lastObs: bronze.obs[bronze.obs.length - 1],
          firstClassifier: bronze.classifiers[0],
        }).toMatchSnapshot()
      })

      it('F-6: CanonicalDsd is JSON-lossless (round-trips)', () => {
        const round = JSON.parse(JSON.stringify(dsd)) as CanonicalDsd
        expect(round).toEqual(dsd)
      })
    })
  }
})

// ── Attribute pass-through (improvement 1 OCP — generic obsAttribute) ──────────
describe('canonical parser — generic attribute columns', () => {
  it('ACCOUNTS_SEQUENCE flows `seq_pos` into obsAttribute (no per-attribute code)', () => {
    const { bronze } = parseCanonicalWorkbook(loadFixture('ACCOUNTS_SEQUENCE'), ACTIVE)
    const withSeq = bronze.obs.filter((o) => o.obsAttribute && 'seq_pos' in o.obsAttribute)
    expect(withSeq.length).toBeGreaterThan(0)
    // seq_pos is preserved as a NUMBER (raw:true), not coerced to a string.
    expect(typeof withSeq[0].obsAttribute!.seq_pos).toBe('number')
  })

  it('GDP_ANNUAL flows `contribution_role` into obsAttribute when present', () => {
    const { bronze } = parseCanonicalWorkbook(loadFixture('GDP_ANNUAL'), ACTIVE)
    const withRole = bronze.obs.filter((o) => o.obsAttribute && 'contribution_role' in o.obsAttribute)
    // The sign-marker rows carry a role; the empty-string rows do NOT leak a key.
    expect(withRole.length).toBeGreaterThan(0)
  })
})

// ── F-LANG — name_<lang> ∩ activeLocales (synthetic, en/fr) ─────────────────────
describe('canonical parser — F-LANG (locale-gated labels, no hardcoded ka/en)', () => {
  const synthetic: SheetMatrices = {
    STRUCTURE: [
      ['key', 'value'],
      ['dataset_code', 'SYNTH_LANG'],
      ['name_en', 'Synthetic'],
      ['name_fr', 'Synthétique'],
      ['dimensions', 'time,widget'],
      ['measure', 'OBS_VALUE'],
      ['source', 'test'],
    ],
    CL_WIDGET: [
      ['code', 'name_en', 'name_fr', 'parent', 'order'],
      ['W1', 'Widget one', 'Widget un', null, 1],
    ],
    DATA: [
      ['widget', 'time', 'obs_value', 'obs_status'],
      ['W1', '2020', 42, 'A'],
    ],
  }

  it('fr ACTIVE → the fr label is emitted', () => {
    const { bronze } = parseCanonicalWorkbook(synthetic, { activeLocales: ['en', 'fr'] })
    expect(bronze.classifiers[0].label).toEqual({ en: 'Widget one', fr: 'Widget un' })
  })

  it('fr INACTIVE → the fr label is ignored (no leak)', () => {
    const { bronze } = parseCanonicalWorkbook(synthetic, { activeLocales: ['en'] })
    expect(bronze.classifiers[0].label).toEqual({ en: 'Widget one' })
    expect('fr' in bronze.classifiers[0].label).toBe(false)
  })
})

// ── F-DIM — a never-seen dimension name parses with zero edits ─────────────────
describe('canonical parser — F-DIM (never-seen dimension, zero code change)', () => {
  const synthetic: SheetMatrices = {
    STRUCTURE: [
      ['key', 'value'],
      ['dataset_code', 'SYNTH_DIM'],
      ['name_en', 'Synthetic dim'],
      ['dimensions', 'time,flavour,intensity'], // dims never hardcoded anywhere
      ['measure', 'OBS_VALUE'],
    ],
    CL_FLAVOUR: [
      ['code', 'name_en', 'parent', 'order'],
      ['SWEET', 'Sweet', null, 1],
      ['SOUR', 'Sour', null, 2],
    ],
    CL_INTENSITY: [
      ['code', 'name_en', 'parent', 'order'],
      ['HI', 'High', null, 1],
    ],
    DATA: [
      ['flavour', 'intensity', 'time', 'obs_value', 'obs_status', 'note'],
      ['SWEET', 'HI', '2021', 3.14, 'A', 'free-text-attr'],
      ['SOUR', 'HI', '2021', 2.72, 'P', null],
    ],
  }

  it('parses the unknown dims into dimKey + emits their codelists', () => {
    const { dsd, bronze, parseIssues } = parseCanonicalWorkbook(synthetic, { activeLocales: ['en'] })
    expect(parseIssues).toEqual([])
    expect(dsd.dimensions).toEqual(['time', 'flavour', 'intensity'])
    expect(bronze.obs).toHaveLength(2)
    expect(bronze.obs[0].dimKey).toEqual({ flavour: 'SWEET', intensity: 'HI' })
    expect(new Set(bronze.classifiers.map((c) => c.dimCode))).toEqual(new Set(['flavour', 'intensity']))
  })

  it('flows the never-seen attribute column `note` generically', () => {
    const { bronze } = parseCanonicalWorkbook(synthetic, { activeLocales: ['en'] })
    expect(bronze.obs[0].obsAttribute).toEqual({ note: 'free-text-attr' })
    // a null attribute cell does not create a phantom key.
    expect(bronze.obs[1].obsAttribute).toEqual({})
  })
})

// ── Structural fail-fast (parseIssues at the boundary) ─────────────────────────
describe('canonical parser — structural issues fail fast', () => {
  it('missing STRUCTURE → MISSING_STRUCTURE, empty bronze', () => {
    const { bronze, parseIssues } = parseCanonicalWorkbook({ DATA: [['x']] }, ACTIVE)
    expect(parseIssues[0].code).toBe('MISSING_STRUCTURE')
    expect(bronze.obs).toEqual([])
  })

  it('STRUCTURE without `dimensions` → MISSING_DIMENSIONS', () => {
    const { parseIssues } = parseCanonicalWorkbook({
      STRUCTURE: [['key', 'value'], ['dataset_code', 'X']],
    }, ACTIVE)
    expect(parseIssues.map((i) => i.code)).toContain('MISSING_DIMENSIONS')
  })

  it('a declared dim with no CL sheet → MISSING_CL_SHEET', () => {
    const { parseIssues } = parseCanonicalWorkbook({
      STRUCTURE: [['key', 'value'], ['dataset_code', 'X'], ['dimensions', 'time,geo']],
      DATA: [['geo', 'time', 'obs_value', 'obs_status']],
    }, ACTIVE)
    expect(parseIssues.map((i) => i.code)).toContain('MISSING_CL_SHEET')
  })
})
