// ── rewrite-provisioning-w0 — the W0 seed re-emission (three-zooms §Z8 / §4-W0) ──
//
//  Re-emits the provisioning artifact's sugar-dialect DataSpecs onto the ONE
//  `pipeline` spine via the ENGINE's OWN `desugarToPipeline` (never a
//  re-implementation) — the file-based sibling of the U3 governed corpus rewrite
//  (migrate-one-pipe-u3.mjs), same rails:
//    1. FULL backup of the original artifact → work/data-spec-backups/w0-provisioning-<ts>/
//    2. Per-spec parity BEFORE any write:
//         a. extractRequirements(orig) ≡ extractRequirements(lowered) under the
//            canonical ctx modes (registries primed from the artifact's own
//            siteConfig — the same refinement the pipeline-equiv fitness runs);
//         b. desugar(lowered) === lowered (canonical idempotence).
//       ANY parity failure → NOTHING is written (whole-artifact abort).
//    3. DRY RUN by default — set APPLY=1 to write.
//  U2-blocked kinds (ratio-list / row-list / multi-code growth / metric) are
//  LEFT + counted. After APPLY, regenerate pipeline-equiv.baseline.json with
//  UPDATE_BASELINE=1 and verify the diff touches ONLY `discriminant` fields —
//  the requirements byte-parity the U3 arc demanded.
//
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import {
  desugar, desugarToPipeline, extractRequirements,
  registerManifestMetrics, registerManifestDimensions,
} from '../../packages/core/dist/index.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const ARTIFACT = resolve(HERE, '..', '..', 'apps', 'api', 'provisioning', 'geostat.provisioning.json')
const TS = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const OUT = resolve(HERE, '..', '..', '..', 'work', 'data-spec-backups', `w0-provisioning-${TS}`)
const APPLY = process.env.APPLY === '1'
const log = (stage, data) => console.log(JSON.stringify({ stage, ...data }))

// Same fold scope as the U3 probe: the kinds the live switch folds (U1). growth single-code only.
const FOLDED = new Set(['query', 'transform', 'pivot', 'timeseries'])
const isSingleCodeGrowth = (s) => s?.type === 'growth' && !Array.isArray(s.code)
const isBlocked = (s) => s?.type === 'ratio-list' || s?.type === 'row-list' || s?.type === 'metric' ||
  (s?.type === 'growth' && Array.isArray(s.code))
const isSugar = (s) => s && typeof s === 'object' && (FOLDED.has(s.type) || isSingleCodeGrowth(s))

function deepEq(a, b) { return JSON.stringify(a) === JSON.stringify(b) }

const raw = readFileSync(ARTIFACT, 'utf8')
const artifact = JSON.parse(raw)

// Prime the semantic-layer registries from the artifact's own manifest blobs — the
// SAME refinement pipeline-equiv runs, so metric-id refs expand identically both ways.
const site = artifact.siteConfig ?? []
registerManifestMetrics(site.find((s) => s.key === 'metrics')?.value)
registerManifestDimensions(site.find((s) => s.key === 'dimensions')?.value)

// Canonical contexts — the pipeline-equiv pattern (every declared non-time dim pinned
// to a stable sentinel; both time modes).
const baseDims = {}
for (const ds of artifact.dataSources ?? []) {
  for (const d of ds.config?.nonTimeDims ?? []) baseDims[d] = `_CANON_${d}`
}
const CTX_MODES = [
  { dims: { ...baseDims, time: 2020 } },
  { dims: { ...baseDims, time: 0 } },
]

function lowerWithParity(orig, where) {
  const lowered = desugarToPipeline(orig)
  if (lowered === orig || lowered.type !== 'pipeline') return { fail: `${where}: did not lower (type=${lowered.type})` }
  for (const ctx of CTX_MODES) {
    let a, b
    try { a = extractRequirements(orig, ctx) } catch (e) { a = `ERR:${e.message}` }
    try { b = extractRequirements(lowered, ctx) } catch (e) { b = `ERR:${e.message}` }
    if (!deepEq(a, b)) return { fail: `${where}: requirements diverge under ctx=${JSON.stringify(ctx.dims)}` }
  }
  if (desugar(lowered) !== lowered) return { fail: `${where}: lowered form not canonical-idempotent` }
  return { lowered }
}

const counts = { lowered: 0, blocked: 0, failed: 0, byKind: {} }
const failures = []

function rewriteTree(node, path) {
  if (Array.isArray(node)) {
    node.forEach((c, i) => rewriteTree(c, `${path}[${i}]`))
    return
  }
  if (!node || typeof node !== 'object') return
  for (const [k, v] of Object.entries(node)) {
    if (k === 'data' && isSugar(v)) {
      const r = lowerWithParity(v, `${path}.data(${v.type})`)
      if (r.fail) { failures.push(r.fail); counts.failed++ }
      else { node[k] = r.lowered; counts.lowered++; counts.byKind[v.type] = (counts.byKind[v.type] ?? 0) + 1 }
      continue // never recurse INTO a spec
    }
    if (k === 'data' && isBlocked(v)) { counts.blocked++; continue }
    if (v && typeof v === 'object') rewriteTree(v, `${path}.${k}`)
  }
}

rewriteTree(artifact.pages ?? [], '$.pages')

if (counts.failed > 0) {
  log('ABORT', { failed: counts.failed, failures })
  process.exit(1)
}

mkdirSync(OUT, { recursive: true })
writeFileSync(resolve(OUT, 'geostat.provisioning.json'), raw)
writeFileSync(resolve(OUT, 'rewrite-summary.json'), JSON.stringify({ apply: APPLY, ...counts, failures }, null, 2))

if (APPLY) {
  writeFileSync(ARTIFACT, JSON.stringify(artifact, null, 2) + '\n', 'utf8')
  log('APPLIED', { artifact: ARTIFACT, backup: OUT, ...counts })
} else {
  log('DRY', { wouldRewrite: counts, backup: OUT })
}
