// ════════════════════════════════════════════════════════════════════════
// verify-parity.ts — Phase1 ↔ Phase2 data-parity fitness function (LIVE)
// ════════════════════════════════════════════════════════════════════════
//
// CONTRACT (the invariant this guards):
//
//   For every dataset D the platform serves, the Phase-1 reference (the extracted
//   seed-data bundle files) MUST be row-for-row equal to the Phase-2 actual (GET
//   /api/stats/observations over the seeded cube), after both are normalized to
//   the canonical ParityRow shape.
//
//     ops/seed-data/geostat/facts/*.bundle.json (Phase-1)  ==  GET /observations (Phase-2)
//
//   This proves the seed/pipeline faithfully loaded the files into gold: same
//   codes, same dim_key composition, same values, same obs_status. It is the live
//   gate that lets Phase-2 (live ApiStore over the seeded cube) be trusted.
//
// WHY the Phase-1 side reads files, not the TS bundles (ADR-0028 de-tenanting):
//   The TS dataset bundles (apps/geostat/src/data/**) were DELETED when geostat
//   was de-tenanted into a pure runner. The extracted files under
//   ops/seed-data/geostat/ are the new SSOT — the EXACT `format:'bundle'` the
//   ingest pipeline consumes, with dim_key already projected (codes resolved,
//   geo='GE' injected, seqPos moved to obs_attribute). So each parity builder is
//   a thin read of the committed file, no remapping. The API package still does
//   NOT compile the engine into its scripts (Law 3); reading plain JSON keeps the
//   gate engine-free and on the right side of the arrow.
//
// FAIL-FAST: the script exits non-zero if the API is unreachable, if any row
//   count differs, or if any value/status differs beyond tolerance. It never
//   silently passes (fail-fast > false green).
// ════════════════════════════════════════════════════════════════════════

// ── Phase-1 reference: the EXTRACTED seed-data bundle files (ADR-0028 D5) ──
// The TS bundles (apps/geostat/src/data/**) were deleted in the de-tenanting
// STRIP; the extracted files under ops/seed-data/geostat/ are now the SSOT for
// the Phase-1 reference. The facts files carry the ALREADY-PROJECTED obs (codes
// resolved, geo='GE' injected, seqPos moved to obs_attribute) — exactly the
// shape seed.ts/the pipeline write to gold — so each parity builder is now a thin
// read of facts/<DATASET>.bundle.json, no id→code/geo-inject remapping needed.
import { readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, resolve } from 'node:path'

// apps/api/scripts → repo-root ops/seed-data/geostat/facts (ops/ is a sibling of
// platform/, where the postgres migrations also live).
const _here = dirname(fileURLToPath(import.meta.url))
const FACTS_DIR = resolve(_here, '../../../../ops/seed-data/geostat/facts')

// ── Bundle-on-disk obs shape (the worker's parseBronze RawObsRow contract) ─
interface BundleObsRow {
  timePeriod: string
  dimKey: Record<string, string>
  obsValue: number | null
  obsStatus?: string
}

/** Read facts/<dataset>.bundle.json → its obs rows (the pipeline `bundle` shape). */
function readFactsBundle(datasetCode: string): BundleObsRow[] {
  const path = resolve(FACTS_DIR, `${datasetCode}.bundle.json`)
  const payload = JSON.parse(readFileSync(path, 'utf8')) as { obs?: BundleObsRow[] }
  return payload.obs ?? []
}

const VALUE_TOLERANCE = 1e-6

// ── Canonical projection both sides must agree on ─────────────────────────

/** Canonical projection both stores must agree on, sorted for stable compare. */
export interface ParityRow {
  dataset: string
  time: string
  dimKey: Record<string, string>
  value: number | null
  obsStatus: string
}

/** Stable string key for a row — order-independent dim_key serialization. */
export function parityKey(r: ParityRow): string {
  const dims = Object.keys(r.dimKey).sort().map((k) => `${k}=${r.dimKey[k]}`).join(',')
  return `${r.dataset}|${r.time}|${dims}`
}

/** Two values are equal within float tolerance; null only equals null. */
function valuesEqual(a: number | null, b: number | null): boolean {
  if (a === null || b === null) return a === b
  return Math.abs(a - b) <= VALUE_TOLERANCE
}

/**
 * Compare two row sets by (key → {value,status}). Returns the list of
 * divergences (empty = parity holds). Pure + deterministic so it is unit-testable
 * independently of any DB or store wiring. Values compare within VALUE_TOLERANCE
 * (1e-6) to tolerate float round-trips through pg numeric/JSON.
 */
export function diffParity(phase1: ParityRow[], phase2: ParityRow[]): string[] {
  const index = (rows: ParityRow[]) => new Map(rows.map((r) => [parityKey(r), r]))
  const a = index(phase1)
  const b = index(phase2)
  const issues: string[] = []

  for (const [k, r1] of a) {
    const r2 = b.get(k)
    if (!r2) { issues.push(`missing in phase2: ${k}`); continue }
    if (!valuesEqual(r1.value, r2.value)) issues.push(`value mismatch ${k}: p1=${r1.value} p2=${r2.value}`)
    if (r1.obsStatus !== r2.obsStatus) issues.push(`status mismatch ${k}: p1=${r1.obsStatus} p2=${r2.obsStatus}`)
  }
  for (const k of b.keys()) if (!a.has(k)) issues.push(`extra in phase2: ${k}`)

  return issues
}

// ── Phase-1 reference — extracted bundle file → ParityRow (ADR-0028 D5) ────
//
//  The facts files are the post-projection SSOT: dim_key is already composed
//  (codes resolved, geo='GE' injected, seqPos excluded from the key), so each
//  builder is a thin read. dataset codes + dim_key composition remain the
//  contract the live API (Phase-2) must match.

/** Project a facts bundle's obs rows → ParityRow[] for a dataset. */
function factsParityRows(datasetCode: string): ParityRow[] {
  return readFactsBundle(datasetCode).map((o) => ({
    dataset:   datasetCode,
    time:      o.timePeriod,
    dimKey:    o.dimKey,
    value:     o.obsValue,
    obsStatus: o.obsStatus ?? 'A',
  }))
}

/** GDP_ANNUAL: dim_key = { measure, geo:'GE' } (national). */
export function gdpParityRows(): ParityRow[] {
  return factsParityRows('GDP_ANNUAL')
}

/** ACCOUNTS_SEQUENCE: dim_key = { measure, account, side }; seqPos is an
 *  attribute, NOT a key dim. */
export function accountsParityRows(): ParityRow[] {
  return factsParityRows('ACCOUNTS_SEQUENCE')
}

/** REGIONAL_GVA: dim_key = { measure, geo, sector } in CODES; obs_status 'A'. */
export function regionalParityRows(): ParityRow[] {
  return factsParityRows('REGIONAL_GVA')
}

// ── Phase-2 actual — GET /api/stats/observations → ParityRow ──────────────
//
//  Raw wire row, exact shape of the route SELECT (time_period, dim_key,
//  obs_value, obs_status, obs_attribute). Declared locally (the script does not
//  import the geostat adapter) so the parity gate depends only on the HTTP
//  contract, not on app code.

interface RawObsRow {
  time_period:   string
  dim_key:       Record<string, string>
  obs_value:     number | null
  obs_status:    string
  obs_attribute: Record<string, unknown>
}

/**
 * Fetch the full observation set for a dataset from the live API and project to
 * ParityRow. limit is set to the route maximum (10000) — datasets are small;
 * a short read keeps the gate fast. Throws (→ non-zero exit) on any non-2xx.
 */
async function fetchApiParityRows(base: string, datasetCode: string): Promise<ParityRow[]> {
  const qp = new URLSearchParams({ dataset: datasetCode, limit: '10000' })
  const res = await fetch(`${base}/api/stats/observations?${qp.toString()}`)
  if (!res.ok) throw new Error(`GET /observations?dataset=${datasetCode} → HTTP ${res.status}`)

  const body = (await res.json()) as { data: RawObsRow[] }
  return body.data.map((row) => ({
    dataset:   datasetCode,
    time:      row.time_period,
    dimKey:    row.dim_key,
    value:     row.obs_value,
    obsStatus: row.obs_status,
  }))
}

// ── Orchestration ─────────────────────────────────────────────────────────

interface ParityResult {
  dataset: string
  phase1Count: number
  phase2Count: number
  issues: string[]
}

async function checkDatasetParity(
  base: string,
  datasetCode: string,
  phase1: ParityRow[],
): Promise<ParityResult> {
  const phase2 = await fetchApiParityRows(base, datasetCode)
  const issues = diffParity(phase1, phase2)
  if (phase1.length !== phase2.length) {
    issues.unshift(`row count mismatch: phase1=${phase1.length} phase2=${phase2.length}`)
  }
  return { dataset: datasetCode, phase1Count: phase1.length, phase2Count: phase2.length, issues }
}

async function main() {
  const base = process.env.API_BASE_URL ?? 'http://localhost:3001'
  console.log(`[verify-parity] comparing bundle reference ↔ live API at ${base}`)

  const datasets: Array<{ code: string; phase1: ParityRow[] }> = [
    { code: 'GDP_ANNUAL',       phase1: gdpParityRows() },
    { code: 'ACCOUNTS_SEQUENCE', phase1: accountsParityRows() },
    { code: 'REGIONAL_GVA',      phase1: regionalParityRows() },
  ]

  let failed = false
  for (const { code, phase1 } of datasets) {
    let result: ParityResult
    try {
      result = await checkDatasetParity(base, code, phase1)
    } catch (e) {
      // Unreachable API / transport error = hard failure, not a skip.
      console.error(`[verify-parity] ${code}: FAILED to query API — ${e instanceof Error ? e.message : String(e)}`)
      failed = true
      continue
    }

    if (result.issues.length === 0) {
      console.log(`[verify-parity] ${code}: OK (${result.phase1Count} rows)`)
    } else {
      failed = true
      console.error(`[verify-parity] ${code}: ${result.issues.length} issue(s) (p1=${result.phase1Count} p2=${result.phase2Count})`)
      // Cap the printed sample so a wholesale drift does not flood the log.
      for (const issue of result.issues.slice(0, 20)) console.error(`    - ${issue}`)
      if (result.issues.length > 20) console.error(`    … and ${result.issues.length - 20} more`)
    }
  }

  if (failed) {
    console.error('[verify-parity] PARITY FAILED — bundle and live API diverge (see above).')
    process.exit(1)
  }
  console.log('[verify-parity] PARITY OK — all datasets match.')
}

// Only run when invoked directly; importing the comparators (tests) is fine.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error('[verify-parity] fatal:', e)
    process.exit(1)
  })
}
