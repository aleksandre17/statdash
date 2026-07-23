// @vitest-environment node
//
// ── FF-ONE-DIALECT-AT-REST — the rest grammar is ONE (W0/Z8, ONE-PIPE §4·D1) ────
//
//  Post-U3 the at-rest grammar is `pipeline`; the sugar kinds are AUTHORING
//  projections (accepted at the write boundary forever, lowered on write). This
//  fitness makes that MACHINE-ENFORCED, not aspirational:
//
//    1. AT-REST SCAN — every DataSpec resident in the provisioning artifact
//       (`geostat.provisioning.json`, the fresh-provision corpus SSOT) is either
//       `pipeline` or a U2-BLOCKED kind on the explicit allowlist. A sugar spec
//       that `desugarToPipeline` CAN fold (query/transform/pivot/timeseries/
//       single-code growth) resting in the artifact = RED.
//    2. WRITE-PATH SEAM — `normalizeSpecForRest` (the ONE seam every
//       config.data_spec write routes through: POST · PUT · restore) lowers every
//       foldable sugar kind to `pipeline` and passes the blocked kinds through
//       identity. A sugar write that would persist as sugar = RED.
//       (Route-level proof — a sugar PUT persisting a `pipeline` row + revision —
//       lives with the fake-pg harness in config-revision.fitness.test.ts.)
//    3. ALLOWLIST FROZEN — the allowlist is byte-frozen here. Regrowth is
//       FORBIDDEN: adding an entry fails this test; entries only LEAVE, when U2
//       lands their fold (the FF-ALL-KINDS-SHAPED forcing-function pattern).
//
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { desugarToPipeline, DATASPEC_DISCRIMINANTS, type DataSpec } from '@statdash/engine'
import { normalizeSpecForRest, SUGAR_AT_REST_ALLOWLIST } from '../lib/normalize-data-spec.js'

const here = dirname(fileURLToPath(import.meta.url))
const ARTIFACT_PATH = resolve(here, '../../provisioning/geostat.provisioning.json')

const DISCRIMINANTS = new Set<string>(DATASPEC_DISCRIMINANTS)

type Json = Record<string, unknown>
const isObj = (v: unknown): v is Json =>
  v !== null && typeof v === 'object' && !Array.isArray(v)

// The SAME data-residence walk as pipeline-equiv (a DataSpec lives at a node's
// `data` field; a `type:'metric'` under a KPI `value` is a different union).
function collectDataSpecs(root: unknown): Array<{ key: string; spec: DataSpec }> {
  const out: Array<{ key: string; spec: DataSpec }> = []
  const walk = (v: unknown, path: string, atDataField: boolean): void => {
    if (Array.isArray(v)) {
      v.forEach((x, i) => walk(x, `${path}[${i}]`, false))
      return
    }
    if (!isObj(v)) return
    if (atDataField && typeof v['type'] === 'string' && DISCRIMINANTS.has(v['type'])) {
      out.push({ key: path, spec: v as unknown as DataSpec })
    }
    for (const [k, x] of Object.entries(v)) walk(x, `${path}.${k}`, k === 'data')
  }
  walk(root, '$', false)
  return out
}

/** A spec is legal AT REST iff it is `pipeline`, or an allowlisted kind that the
 *  fold genuinely cannot lower yet (identity — e.g. multi-code growth; a
 *  single-code growth LOWERS, so it may never rest as sugar despite the kind
 *  being allowlisted for its multi-code form). */
function restLegal(spec: DataSpec): boolean {
  if (spec.type === 'pipeline') return true
  if (!SUGAR_AT_REST_ALLOWLIST.has(spec.type)) return false
  return desugarToPipeline(spec) === spec
}

describe('FF-ONE-DIALECT-AT-REST — one rest grammar (W0 makes it enforced)', () => {
  it('the allowlist is FROZEN — only the U2-blocked kinds; regrowth is forbidden', () => {
    // Byte-frozen: shrinking (a fold landing) edits THIS expectation visibly;
    // growing (new sugar resting) cannot pass without editing the FF itself.
    expect([...SUGAR_AT_REST_ALLOWLIST].sort()).toEqual([
      'growth',      // multi-code only (DU4b folded single-code)
      'metric',      // identity in desugarToPipeline today — D1-tail fold, SURFACED W0
      'ratio-list',  // DU4c — awaits the U2 `cells` head
      'row-list',    // DU4d — awaits the U2 `cells` head + store-meta enrichment
    ])
  })

  it('provisioning artifact: every data-resident spec is pipeline or legally blocked', () => {
    const artifact = JSON.parse(readFileSync(ARTIFACT_PATH, 'utf8')) as Json
    const specs = collectDataSpecs(artifact)
    expect(specs.length).toBeGreaterThan(0) // non-vacuous — the walk found the corpus

    const sugar = specs
      .filter(({ spec }) => !restLegal(spec))
      .map(({ key, spec }) => `${key} (type=${spec.type})`)
    expect(sugar, `sugar-dialect specs at rest in provisioning:\n${sugar.join('\n')}`).toEqual([])
  })

  it('write-path seam: every foldable sugar kind lowers to pipeline before persist', () => {
    const foldable: Array<[string, Json]> = [
      ['query',      { type: 'query', query: { measure: ['B1GQ'] }, pipe: [], encoding: { label: 'time', value: 'B1GQ' } }],
      ['transform',  { type: 'transform', source: [{ geo: 'GE', value: 1 }], steps: [{ op: 'sort', by: 'value' }], encoding: { label: 'geo', value: 'value' } }],
      ['pivot',      { type: 'pivot', rows: [{ y: 2020, a: 1 }], keyField: 'y', valueFields: ['a'] }],
      ['timeseries', { type: 'timeseries', code: 'B1GQ', years: [2020, 2021] }],
      ['growth',     { type: 'growth', code: 'B1GQ', years: 'all' }], // single-code — folds
    ]
    for (const [kind, spec] of foldable) {
      const r = normalizeSpecForRest(spec)
      expect('spec' in r, `${kind}: seam returned a violation`).toBe(true)
      if ('spec' in r) expect(r.spec['type'], `${kind} did not lower`).toBe('pipeline')
    }
  })

  it('write-path seam: U2-blocked kinds pass through identity (honest, allowlisted)', () => {
    const blocked: Array<[string, Json]> = [
      ['ratio-list', { type: 'ratio-list', pairs: [{ code: 'D1', denom: 'B1GQ' }] }],
      ['row-list',   { type: 'row-list', rows: [{ code: 'B1GQ' }] }],
      ['growth',     { type: 'growth', code: ['B1GQ', 'D1'], years: 'all' }], // multi-code
      ['metric',     { type: 'metric', metrics: ['gdp.current'] }],
    ]
    for (const [kind, spec] of blocked) {
      const r = normalizeSpecForRest(spec)
      expect('spec' in r, `${kind}: seam rejected an allowlisted kind`).toBe(true)
      if ('spec' in r) expect(r.spec, `${kind} must pass through unchanged`).toBe(spec)
    }
  })

  it('write-path seam: a foldable kind too malformed to lower is a shape violation, never silent sugar', () => {
    const r = normalizeSpecForRest({ type: 'transform' }) // no steps → the fold throws
    expect('violation' in r).toBe(true)
    if ('violation' in r) expect(r.violation.check).toBe('shape')
  })
})
