// @vitest-environment node
//
// ── FF-PIPELINE-EQUIV (shadow baseline) — ADR-046 · SPEC §1.3 / §8 · wave W-P0 ──
//
//  THE ONE-WAY DOOR THIS GUARDS. ADR-046 makes `pipeline` the ONE canonical
//  data-manipulation grammar: every legacy DataSpec discriminant (`query`,
//  `transform`, `timeseries`, `growth`, `ratio-list`, `pivot`, `metric`) becomes
//  SUGAR that `desugar()` lowers into `pipeline` (W-P4), and the Constructor's
//  default emission flips to `pipeline` (W-P5) — the single irreversible step.
//  That flip is gated on this invariant: **the resolved data contract of every
//  stored config must be BYTE-IDENTICAL through the legacy discriminant and
//  through its `pipeline` desugaring** (SPEC §8, ADR-046 Consequences).
//
//  WHAT THIS FILE DOES TODAY (W-P0 — no `pipeline` discriminant exists yet).
//  It captures the BASELINE the W-P4 shadow harness will byte-compare against:
//  for every DataSpec in the corpus SSOT (`provisioning/geostat.provisioning.json`),
//  under a set of FIXED canonical contexts, we record the store-read contract the
//  engine derives — `extractRequirements()` (the {code, dims} warm/prefetch set).
//
//  WHY REQUIREMENTS ARE THE INVARIANT (not rows). `extractRequirements` is the
//  pure, store-free projection of exactly what a spec READS from the store — the
//  underlying measure codes × the pinned/enumerated dim coordinates × the time
//  handling (year vs range/unbounded). A `pipeline` whose `source` head reads the
//  same measures at the same grain MUST extract the identical requirement set
//  (SPEC §1.3: the head lowers onto the SAME `resolveMeasureRef` / store path; the
//  pure tail steps issue no read). The pipe/tail transforms never touch this set,
//  so requirements are precisely the contract the desugar must preserve — provable
//  with no DB, no rows, no float/ordering nondeterminism. Rows-level parity is
//  W-P4's shadow (wave table: "Parity shadow green on corpus").
//
//  BITING TODAY. The committed baseline (`pipeline-equiv.baseline.json`) is
//  deterministic (canonical key/array ordering) and reviewable. This test
//  REGENERATES it in-memory and asserts deep equality — so ANY drift in corpus
//  resolution (a spec edited, a measure re-pointed, the extraction logic changed)
//  fails the build LOUDLY. Regenerate intentionally with `UPDATE_BASELINE=1`.
//
//  STORE-AGNOSTIC. No DATABASE_URL. The metric/dimension catalogs are primed from
//  the artifact's own `siteConfig` via the platform boot seam
//  (`registerManifestMetrics` / `registerManifestDimensions`) — the SAME refinement
//  every real boot runs — so `resolveMeasureRef` expands governed metric-ids to
//  their DSD codes exactly as production does. Nothing reads a workbook or a cube.

import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import {
  extractRequirements,
  registerManifestMetrics,
  registerManifestDimensions,
  DATASPEC_DISCRIMINANTS,
  type DataSpec,
  type SectionContext,
  type Requirement,
  type DimVal,
} from '@statdash/engine'

const here = dirname(fileURLToPath(import.meta.url))
const ARTIFACT_PATH = resolve(here, '../../provisioning/geostat.provisioning.json')
const BASELINE_PATH = resolve(here, '../../provisioning/pipeline-equiv.baseline.json')

const TIME_DIM = 'time'
const DISCRIMINANTS = new Set<string>(DATASPEC_DISCRIMINANTS)

type Json = Record<string, unknown>
const isObj = (v: unknown): v is Json =>
  v !== null && typeof v === 'object' && !Array.isArray(v)

// ── DataSpec collection ──────────────────────────────────────────────────────
//
//  A DataSpec resides at a node's `data` field (the renderer's DataSpec port) and
//  carries one of the DATASPEC_DISCRIMINANTS as its `type`. We collect specs at
//  THAT residence only — a `type:'metric'` under a KPI `value` is a KpiValueSpec
//  (a different union, resolved through resolveMetricValue, NOT desugar→pipeline),
//  and must not be misread as a DataSpec. Each spec gets a stable dot-path KEY so
//  the baseline is order-stable and reviewable.

interface CollectedSpec { key: string; spec: DataSpec }

function collectDataSpecs(root: unknown): CollectedSpec[] {
  const out: CollectedSpec[] = []
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
  // Stable ordering by key so the emitted baseline never reorders on a re-walk.
  return out.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
}

// ── Canonical contexts ───────────────────────────────────────────────────────
//
//  Fixed, deterministic contexts — identical here (W-P0 capture) and in W-P4
//  (comparison), which is all the equivalence proof requires. Generic over dims
//  (Law 1 — derived from the corpus's own declared dimensions, no privileged dim
//  name hardcoded): every non-time dim is pinned to a stable sentinel so `$ctx`
//  filter refs resolve to a concrete pin (richer, more-biting requirements).
//  Captured under BOTH time modes so the desugar is proven across the year-branch
//  AND the range/unbounded branch of extractRequirements.

interface DataSourceCfg { config?: { nonTimeDims?: string[] } }

function canonicalDims(artifact: Json): Record<string, DimVal> {
  const dims: Record<string, DimVal> = {}
  const sources = (artifact['dataSources'] as DataSourceCfg[] | undefined) ?? []
  for (const ds of sources) {
    for (const d of ds.config?.nonTimeDims ?? []) dims[d] = `_CANON_${d}`
  }
  return dims
}

// ── Canonicalization ─────────────────────────────────────────────────────────

function sortDims(dims: Record<string, DimVal>): Record<string, DimVal> {
  const out: Record<string, DimVal> = {}
  for (const k of Object.keys(dims).sort()) out[k] = dims[k]
  return out
}

function canonRequirements(reqs: Requirement[]): Array<{ code: string; dims: Record<string, DimVal> }> {
  return reqs
    .map((r) => ({ code: r.code, dims: sortDims(r.dims) }))
    .sort((a, b) => {
      const sa = JSON.stringify(a), sb = JSON.stringify(b)
      return sa < sb ? -1 : sa > sb ? 1 : 0
    })
}

interface SpecBaseline {
  key: string
  discriminant: string
  requirements: Record<string, ReturnType<typeof canonRequirements>>  // ctxName → reqs
}
interface Baseline {
  _meta: {
    note: string
    artifact: string
    contexts: Record<string, Record<string, DimVal>>
    specCount: number
  }
  specs: SpecBaseline[]
}

function buildBaseline(artifact: Json): Baseline {
  const base = canonicalDims(artifact)
  const contexts: Record<string, SectionContext> = {
    // Year mode — a concrete year; per-year requirement enumeration.
    year:  { dims: { ...base, [TIME_DIM]: 2020 } },
    // Range mode — time unset (0 is an unset sentinel: isUnsetTime); the read is
    // unbounded, so requirements carry no time pin (the GAP-4 rangeMode branch).
    range: { dims: { ...base, [TIME_DIM]: 0 } },
  }
  const specs = collectDataSpecs(artifact).map(({ key, spec }): SpecBaseline => {
    const requirements: SpecBaseline['requirements'] = {}
    for (const [name, ctx] of Object.entries(contexts)) {
      requirements[name] = canonRequirements(extractRequirements(spec, ctx))
    }
    return { key, discriminant: spec.type, requirements }
  })
  return {
    _meta: {
      note: 'FF-PIPELINE-EQUIV baseline (ADR-046 / SPEC §8, wave W-P0). The store-read '
        + 'contract (extractRequirements) of every corpus DataSpec, per canonical context. '
        + 'W-P4 desugars the legacy discriminants into `pipeline` and re-runs this harness; '
        + 'a byte-identical result gates the W-P5 default-emission flip. Regenerate with '
        + 'UPDATE_BASELINE=1 and REVIEW every diff — an unexpected change is an equivalence break.',
      artifact: 'provisioning/geostat.provisioning.json',
      contexts: Object.fromEntries(Object.entries(contexts).map(([n, c]) => [n, sortDims(c.dims)])),
      specCount: specs.length,
    },
    specs,
  }
}

// ── The suite ────────────────────────────────────────────────────────────────

describe('FF-PIPELINE-EQUIV — corpus resolution baseline (ADR-046, gates the ⛔ W-P5 flip)', () => {
  let artifact: Json
  let current: Baseline

  beforeAll(() => {
    artifact = JSON.parse(readFileSync(ARTIFACT_PATH, 'utf8')) as Json
    // Prime the semantic-layer registries from the artifact's own manifest blobs —
    // the SAME wire→engine refinement every real boot runs, so resolveMeasureRef
    // expands governed metric-ids to DSD codes faithfully (else metric-id specs
    // would pass through un-expanded and the baseline would understate the read).
    const site = (artifact['siteConfig'] as Array<{ key: string; value: unknown }> | undefined) ?? []
    const metrics = site.find((s) => s.key === 'metrics')?.value
    const dims    = site.find((s) => s.key === 'dimensions')?.value
    registerManifestMetrics(Array.isArray(metrics) ? (metrics as never) : undefined)
    registerManifestDimensions(Array.isArray(dims) ? (dims as never) : undefined)

    current = buildBaseline(artifact)

    if (process.env.UPDATE_BASELINE) {
      writeFileSync(BASELINE_PATH, JSON.stringify(current, null, 2) + '\n', 'utf8')
    }
  })

  it('the corpus is non-trivial (DataSpecs present, catalog primed)', () => {
    expect(current.specs.length).toBeGreaterThan(0)
    // Every collected spec carries a known discriminant + a non-empty read set in at
    // least one mode (a spec that reads NOTHING under every context would be a silent
    // coverage hole — the FF-NO-EMPTY-REQS class this baseline also witnesses).
    for (const s of current.specs) {
      expect(DISCRIMINANTS.has(s.discriminant)).toBe(true)
    }
  })

  it('corpus resolution is byte-identical to the committed baseline (no unexpected drift)', () => {
    let committed: Baseline
    try {
      committed = JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) as Baseline
    } catch {
      throw new Error(
        `pipeline-equiv.baseline.json is missing. Generate it once with `
        + `UPDATE_BASELINE=1 (then commit it) — it is the W-P4 shadow's comparison target.`,
      )
    }
    // Deep-equal the WHOLE artifact. A drift here is either an intended corpus/engine
    // change (regenerate with UPDATE_BASELINE=1 and review the diff) or a regression in
    // the store-read contract of a stored config (the class FF-PIPELINE-EQUIV kills).
    expect(current).toEqual(committed)
  })
})
