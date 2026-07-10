// ── Fitness — FF-EXTRACTDEPS-TOTAL + reactive-graph scaffolds [AR-49 V1 / ADR-024] ─
//
//  FF-EXTRACTDEPS-TOTAL (LIVE, the V1 gate): every NAMED `$`-ref in a config appears
//  in the extracted dependency set. An INDEPENDENT raw scanner computes ground truth
//  (never calls extractDeps); the test asserts extractDeps' union covers it, and that
//  a PLANTED hidden dep is caught. This is the honesty proof that static extraction is
//  TOTAL under Law 2 — if a ref could hide from the walk, this goes red.
//
//  The V2/V3 fitness functions (graph parity, exact invalidation, one derivation path,
//  warm-is-render) are SCAFFOLDED here as `todo` — they gate steps not yet built, so
//  they land honestly pending rather than falsely green.

import { describe, it, expect } from 'vitest'
import { extractDeps, type DepNode } from './extractDeps'
import { refScope } from '../ref/ref'

// ── Independent ground-truth scanner (does NOT use extractDeps) ────────────────
//  Collects every `$`-ref key in a node, by the R4 taxonomy, EXCLUDING interaction
//  slots (click-time drill-down, out of render-dep scope) and CHILD-node subtrees
//  (owned by the child). CRITICAL: a value under a DATA-CARRYING key (`data`,
//  `transforms`) has a `type`/`op` discriminant but is NOT a child renderable — it
//  carries refs and MUST be descended into (else the totality proof passes vacuously).
//  This mirrors nodeWalk's DATA_CARRYING_KEYS boundary — the same distinction.
const INTERACTION = new Set(['on', 'actions', 'dataLinks'])
const DATA_KEYS   = new Set(['data', 'transforms'])
function isChildRenderable(v: unknown): boolean {
  return v !== null && typeof v === 'object' && !Array.isArray(v) && typeof (v as Record<string, unknown>)['type'] === 'string'
}
function groundTruthRefs(node: DepNode): Set<string> {
  const out = new Set<string>()
  const walk = (v: unknown, inVars: boolean) => {
    if (v === null || typeof v !== 'object') return
    const rec = v as Record<string, unknown>
    const scope = refScope(rec)
    if (scope) {
      const key = rec['$ctx'] ?? rec['$param'] ?? rec['$ref'] ?? rec['$cl'] ?? rec['$d']
      if (typeof key === 'string') out.add(key)
    }
    // expr-layer refs ($derived) that R4 refScope does not classify
    if (inVars && typeof rec['$derived'] === 'string') out.add(rec['$derived'] as string)
    if (Array.isArray(v)) { for (const x of v) walk(x, inVars); return }
    for (const [k, x] of Object.entries(rec)) {
      if (INTERACTION.has(k)) continue
      // Stop at a child renderable reached via a NON-data key (its refs are its own);
      // ALWAYS descend into data/transforms (their `type`/`op` is a discriminant, not a child).
      if (!DATA_KEYS.has(k) && isChildRenderable(x)) continue
      walk(x, inVars || k === 'vars')
    }
  }
  // The node itself is the subject — walk its own fields (never treat the root as a child).
  for (const [k, x] of Object.entries(node)) {
    if (INTERACTION.has(k)) continue
    walk(x, k === 'vars')
  }
  return out
}

/** The union of every KEY extractDeps recorded across all source buckets. */
function allDepKeys(node: DepNode): Set<string> {
  const d = extractDeps(node)
  return new Set<string>([...d.dims, ...d.params, ...d.vars, ...d.perspective, ...d.classifiers])
}

// ── A representative, ref-dense corpus (flat nodes — one renderable each) ──────
const CORPUS: Record<string, DepNode> = {
  'query+pipe+encoding refs': {
    type: 'chart',
    data: {
      type: 'query',
      query: { measure: 'GVA', filter: { geo: { $ctx: 'geo' }, sector: { $ne: '_T', $ctx: 'sector' } } },
      pipe: [{ op: 'aggregate', by: { $ctx: '_byDims' }, measure: 'value', agg: 'sum' },
             { op: 'sort', by: { $ctx: '_sortBy' }, dir: { $ctx: '_sortDir' } },
             { op: 'lookup', key: 'geo', from: { $d: 'geo' }, fields: ['label'] }],
      encoding: { label: { $ctx: '_xDim' }, series: { $ctx: '_seriesDim' } },
    },
  },
  'transform + blend + classifier join': {
    type: 'table',
    data: {
      type: 'transform', source: [{ a: 1 }],
      steps: [{ op: 'filter', where: { geo: { $ctx: 'geo' } } },
              { op: 'join', with: { $cl: 'sector' }, on: 'sector' }],
      encoding: { label: 'a' },
    },
  },
  'visibility params + perspective': {
    type: 'section',
    view: { visibleWhen: { op: 'or', exprs: [{ op: 'eq', param: 'region', is: 'R' }, { op: 'perspective-is', perspective: 'range', param: 'mode' }] } },
  },
  'vars expr refs': {
    type: 'section',
    vars: { _sel: { $ctx: 'geo' }, _lbl: { op: 'concat', values: [{ $derived: '_sel' }, { $ref: '_other' }] } },
  },
}

describe('FF-EXTRACTDEPS-TOTAL — every named ref appears in the dep set', () => {
  for (const [name, node] of Object.entries(CORPUS)) {
    it(`covers every $-ref: ${name}`, () => {
      const truth = groundTruthRefs(node)
      const got = allDepKeys(node)
      const missed = [...truth].filter((k) => !got.has(k))
      expect(missed, `unextracted refs (Law-2 totality breach): ${missed.join(', ')}`).toEqual([])
    })
  }

  it('a PLANTED hidden dep is caught (deep in an encoding channel)', () => {
    const node: DepNode = {
      type: 'chart',
      data: { type: 'query', query: { measure: 'GVA' }, encoding: { label: 'geo', color: { $ctx: '_planted_hidden' } } },
    }
    expect(allDepKeys(node).has('_planted_hidden')).toBe(true)
  })

  it('a PLANTED hidden dep is caught (deep in a nested pipe filter)', () => {
    const node: DepNode = {
      type: 'chart',
      data: { type: 'query', query: { measure: 'GVA' }, encoding: { label: 'geo' },
              pipe: [{ op: 'filter', where: { region: { $ne: '_T', $ctx: '_planted_pipe' } } }] },
    }
    expect(extractDeps(node).dims.has('_planted_pipe')).toBe(true)
  })
})

// ── V2 / V3 scaffolds — honest pending (gate steps not yet built) ──────────────
describe('reactive-graph fitness (SCAFFOLD — lands red/pending for V2–V4)', () => {
  // FF-GRAPH-PARITY (V2 shadow): compilePage graph rows ≡ legacy resolveNodeRows rows
  // across the provisioning corpus × perspectives × locales.
  it.todo('FF-GRAPH-PARITY — shadow-mode graph rows ≡ legacy rows (V2)')
  // FF-EXACT-INVALIDATION (V3): writing param P re-evaluates exactly the nodes whose
  // dep-set contains P (counted, not sampled); writing an equal value re-evaluates zero.
  it.todo('FF-EXACT-INVALIDATION — param write invalidates exactly its dependents (V3)')
  // FF-ONE-DERIVATION-PATH (V3-contract): no module-level promise/row cache outside
  // core/graph (grep gate on the _promiseCache-class patterns).
  it.todo('FF-ONE-DERIVATION-PATH — no derivation cache outside core/graph (V3-contract)')
  // FF-WARM-IS-RENDER (V4): warm pass and render read the SAME graph instance.
  it.todo('FF-WARM-IS-RENDER — warm === cold evaluation of the render graph (V4)')
})
