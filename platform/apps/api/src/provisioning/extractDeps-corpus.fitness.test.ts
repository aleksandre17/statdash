// @vitest-environment node
//
// ── FF-EXTRACTDEPS-TOTAL (provisioning corpus) + V0 RENDER/DATA BASELINE ──────
//
//  Two committed artifacts for the reactive-graph track (AR-49 / ADR-024):
//
//  1. TOTALITY (V1 gate) — extractDeps computes the COMPLETE dependency set of the
//     REAL geostat page tree. An independent raw scanner collects every `$`-ref key
//     in the committed provisioning JSON (ground truth, never calls extractDeps); the
//     union of every node's extracted deps must COVER it. A hand-edit that hides a dep
//     from static analysis (a Law-2 breach) fails here — no database, file read off disk.
//
//  2. BASELINE (V0 honesty gate) — "measure before you change." The CURRENT render
//     path rebuilds RenderContext and re-walks the ENTIRE tree on any state change:
//     the invalidation fan-out of every source is COARSE = all renderable nodes. This
//     test records the EXACT fan-out extractDeps computes per source (how many nodes
//     actually depend on `geo`/`sector`/`time`/locale/perspective) — the non-regression
//     baseline the V3 render-switch proves against: after V3, a source's live re-eval
//     count must be ≤ the coarse baseline AND == the exact count recorded here.

import { describe, it, expect, beforeAll } from 'vitest'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { extractDeps, refScope, type DepNode, type NodeDeps } from '@statdash/engine'

const here = dirname(fileURLToPath(import.meta.url))
const ARTIFACT_PATH = resolve(here, '../../provisioning/geostat.provisioning.json')

type Json = Record<string, unknown>

// A value under one of these keys carries a `type`/`op` DISCRIMINANT but is NOT a
// child renderable (DataSpec / TransformStep) — descend for refs, never count as a node.
const DATA_KEYS   = new Set(['data', 'transforms'])
// Click-time / write-side slots — out of RENDER-dependency scope.
const INTERACTION = new Set(['on', 'actions', 'dataLinks'])

function isRenderable(v: unknown): v is Json {
  return v !== null && typeof v === 'object' && !Array.isArray(v) && typeof (v as Json)['type'] === 'string'
}

/** Collect every RENDERABLE node in the tree (respecting the data/interaction boundary). */
function collectNodes(root: unknown): Json[] {
  const nodes: Json[] = []
  const walk = (v: unknown, underData: boolean) => {
    if (v === null || typeof v !== 'object') return
    if (Array.isArray(v)) { for (const x of v) walk(x, underData); return }
    const rec = v as Json
    if (!underData && isRenderable(rec)) nodes.push(rec)
    for (const [k, x] of Object.entries(rec)) {
      if (INTERACTION.has(k)) continue
      walk(x, underData || DATA_KEYS.has(k))
    }
  }
  walk(root, false)
  return nodes
}

/** Ground-truth: every `$`-ref key reachable (excluding interaction slots). */
function groundTruthRefs(root: unknown): Set<string> {
  const out = new Set<string>()
  const walk = (v: unknown, inVars: boolean) => {
    if (v === null || typeof v !== 'object') return
    const rec = v as Json
    if (refScope(rec)) {
      const key = rec['$ctx'] ?? rec['$param'] ?? rec['$ref'] ?? rec['$cl'] ?? rec['$d']
      if (typeof key === 'string') out.add(key)
    }
    if (inVars && typeof rec['$derived'] === 'string') out.add(rec['$derived'] as string)
    if (Array.isArray(v)) { for (const x of v) walk(x, inVars); return }
    for (const [k, x] of Object.entries(rec)) {
      if (INTERACTION.has(k)) continue
      walk(x, inVars || k === 'vars')
    }
  }
  walk(root, false)
  return out
}

function depKeys(d: NodeDeps): Set<string> {
  return new Set<string>([...d.dims, ...d.params, ...d.vars, ...d.perspective, ...d.classifiers])
}

let artifact: Json
let nodes: Json[]
let deps: NodeDeps[]

beforeAll(async () => {
  artifact = JSON.parse(await readFile(ARTIFACT_PATH, 'utf8')) as Json
  nodes = collectNodes(artifact)
  deps  = nodes.map((n) => extractDeps(n as DepNode))
})

describe('FF-EXTRACTDEPS-TOTAL — the real geostat corpus', () => {
  it('the corpus is non-trivial (nodes + refs present)', () => {
    expect(nodes.length).toBeGreaterThan(20)
    expect(groundTruthRefs(artifact).size).toBeGreaterThan(5)
  })

  it('every $-ref in the provisioning config appears in some node’s dep set', () => {
    const truth = groundTruthRefs(artifact)
    const union = new Set<string>()
    for (const d of deps) for (const k of depKeys(d)) union.add(k)
    const missed = [...truth].filter((k) => !union.has(k))
    expect(missed, `refs invisible to static extraction (Law-2 totality breach): ${missed.join(', ')}`).toEqual([])
  })
})

describe('V0 BASELINE — current invalidation fan-out (recorded, non-regression)', () => {
  it('records exact vs coarse fan-out per source and proves coarse over-fires', () => {
    const total = nodes.length
    // Candidate sources = every source any node names (dims ∪ params ∪ perspective ∪ locale).
    const sources = new Set<string>()
    for (const d of deps) for (const k of [...d.dims, ...d.params, ...d.perspective]) sources.add(k)

    const fanout: Record<string, number> = {}
    for (const s of sources) {
      fanout[s] = deps.filter((d) => d.dims.has(s) || d.params.has(s) || d.perspective.has(s)).length
    }
    const localeFanout = deps.filter((d) => d.locale).length

    const measurement = {
      renderableNodes: total,
      dataNodes: deps.filter((d) => d.requirements.length > 0 || d.measures.size > 0).length,
      distinctSources: sources.size,
      localeDependents: localeFanout,
      coarseFanoutPerChange: total, // TODAY: any state change re-walks ALL nodes
      exactFanout: Object.fromEntries(Object.entries(fanout).sort((a, b) => b[1] - a[1])),
    }
    // Recorded artifact — surfaced for the ADR-024 baseline section + V3 comparison.
    console.log('[AR-49 V0 BASELINE]\n' + JSON.stringify(measurement, null, 2))

    // The honesty invariant the V3 switch must beat: for the single busiest source,
    // the EXACT dependent set is strictly smaller than the coarse (whole-tree) re-eval.
    const busiest = Math.max(0, ...Object.values(fanout))
    expect(busiest).toBeGreaterThan(0)
    expect(busiest).toBeLessThan(total) // coarse re-render over-fires — the graph's win
  })
})
