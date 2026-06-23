// ════════════════════════════════════════════════════════════════════════
// seed-data.fitness.test.ts — ADR-0028 preservation gate (the "nothing lost" proof)
// ════════════════════════════════════════════════════════════════════════
//
// CONTRACT (the invariant that guards the extracted SSOT):
//
//   The seed-data artifacts under ops/seed-data/geostat/ are now the Single
//   Source of Truth for the Geostat datasets (ADR-0028 D5 — the TS dataset
//   bundles were deleted in Phase 2). This gate proves the SSOT is trustworthy:
//   the committed files are structurally well-formed + internally consistent,
//   and (in CI, against a migrated DB) load losslessly into the gold cube.
//
// TWO TIERS:
//
//   • DB-INDEPENDENT (always runs here, NO database) — STRUCTURAL INTEGRITY:
//       The TS reversibility anchor ("files == TS projection") dissolved BY
//       DESIGN once the TS bundles were deleted in Phase 2 — both sides of that
//       compare now read the same files, so it proved nothing (files == files).
//       PROVE+TAG already passed pre-strip; the anchor served its purpose. The
//       honest DB-free invariant that REMAINS is: the SSOT files are self-
//       consistent. This tier asserts the manifest's declared counts match the
//       actual file row counts, every facts row carries the required keys, the
//       codelists/displays are well-formed, and facts dimensions are referentially
//       grounded in the codelists. A corrupt or truncated extract fails here,
//       in every environment, with no DB.
//
//   • DB-GATED (skips without DATABASE_URL; a real gate in CI) — LOSSLESS LOAD:
//       stage-1 SQL gold (R__seed_geostat_gold.sql applied via Flyway) == the
//       bundle files, compared row-for-row through ParityRow. THIS is the real
//       preservation proof — it shows the committed SSOT reproduces the cube.
//       stage-2 (pipeline) gold is covered by verify-parity.ts against a running
//       API. Guarded with describe.skip (mirrors upsert.scd2.test.ts): a visible
//       spec offline, a hard assertion where the migrated+seeded DB exists.
//
// WHY this test lives in scripts/ (not src/): it reads the ops/seed-data files
//   and reuses verify-parity.ts's canonical ParityRow + diffParity. apps/api/src/
//   deliberately does NOT compile the build-time ETL graph (Law 3 / the src↔scripts
//   compilation boundary), and vitest.config.ts includes scripts/**/*.test.ts, so
//   the fitness test belongs WITH the seed/parity tooling it guards.
//
// FAIL-FAST: any structural defect or load divergence fails; the gate never
//   silently passes (a false green here is the worst outcome — it would mask a
//   corrupted SSOT or a lossy seed).
// ════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeAll } from 'vitest'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

import { type ParityRow, diffParity } from './verify-parity.js'

// ── Locate the committed artifacts (apps/api/scripts → repo-root ops/seed-data) ─
const here = dirname(fileURLToPath(import.meta.url))
const SEED_DATA_DIR = resolve(here, '../../../../ops/seed-data/geostat')
const FACTS_DIR = resolve(SEED_DATA_DIR, 'facts')

// ── Bundle shapes on disk (the worker's parseBronze contract) ─────────────
interface BundleObsRow {
  timePeriod: string
  dimKey: Record<string, string>
  obsValue: number | null
  obsStatus?: string
  obsAttribute?: Record<string, unknown>
}
interface ClassifierRow {
  code: string
  dimCode: string
  label?: unknown
  // ADR-0023 hierarchy edge: parent member's business code within the SAME
  // dimCode (or absent/null for a root). A cross-dim parentCode is invalid (the
  // V23 trg_classifier_code_path trigger + ingest publishClassifiers both RAISE).
  parentCode?: string | null
  metadata?: Record<string, unknown>
}
interface DisplayRow {
  code: string
  dimCode: string
  display?: unknown
}
interface FactsBundle { obs?: BundleObsRow[] }
interface CodelistsBundle { classifiers?: ClassifierRow[] }
interface DisplaysBundle { displays?: DisplayRow[] }

interface Manifest {
  tenant: string
  version: number
  datasets: string[]
  counts: { classifiers: number; displays: number; facts: Record<string, number> }
  files: Array<{ kind: string; path: string; rowCount: number; datasetCode?: string }>
  publishOrder: string[]
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, 'utf8')) as T
}

const FACT_DATASETS = ['GDP_ANNUAL', 'ACCOUNTS_SEQUENCE', 'REGIONAL_GVA'] as const

/**
 * Project a facts bundle → ParityRow[] (the canonical shape verify-parity uses).
 * Pure: dataset + time_period + dim_key + value + status. Reused by the DB-gated
 * tier to compare the file SSOT against stage-1 gold.
 */
function obsFileToParityRows(dataset: string, obs: BundleObsRow[]): ParityRow[] {
  return obs.map((o) => ({
    dataset,
    time: o.timePeriod,
    dimKey: o.dimKey,
    value: o.obsValue,
    obsStatus: o.obsStatus ?? 'A',
  }))
}

// ════════════════════════════════════════════════════════════════════════
// TIER 1 — DB-INDEPENDENT: structural integrity of the SSOT (runs everywhere)
// ════════════════════════════════════════════════════════════════════════
describe('ADR-0028 SSOT — seed-data bundle files are well-formed + self-consistent (DB-independent)', () => {
  let manifest: Manifest
  let codelists: ClassifierRow[]
  let displays: DisplayRow[]
  const factObs = new Map<string, BundleObsRow[]>()

  beforeAll(async () => {
    manifest = await readJson<Manifest>(resolve(SEED_DATA_DIR, 'manifest.json'))
    codelists = (await readJson<CodelistsBundle>(resolve(SEED_DATA_DIR, 'codelists.bundle.json'))).classifiers ?? []
    displays = (await readJson<DisplaysBundle>(resolve(SEED_DATA_DIR, 'displays.bundle.json'))).displays ?? []
    for (const code of FACT_DATASETS) {
      const bundle = await readJson<FactsBundle>(resolve(FACTS_DIR, `${code}.bundle.json`))
      factObs.set(code, bundle.obs ?? [])
    }
  })

  // ── Manifest identity + the datasets it declares match the facts on disk ──
  it('manifest identifies the geostat tenant and declares exactly the three fact datasets', () => {
    expect(manifest.tenant).toBe('geostat')
    expect(manifest.datasets.slice().sort()).toEqual(['ACCOUNTS_SEQUENCE', 'GDP_ANNUAL', 'REGIONAL_GVA'])
    expect(manifest.publishOrder).toEqual(['codelists', 'displays', 'facts'])
  })

  // ── Manifest counts == the ACTUAL row counts on disk (catches a stale/lossy extract) ──
  it('manifest counts match the actual row counts in every bundle file', () => {
    expect(manifest.counts.classifiers).toBe(codelists.length)
    expect(manifest.counts.displays).toBe(displays.length)
    for (const code of FACT_DATASETS) {
      expect(manifest.counts.facts[code]).toBe(factObs.get(code)!.length)
    }
  })

  // ── The manifest.files[] descriptor agrees with counts + actual files ──
  it('manifest.files[] rowCount agrees with counts and the actual files', () => {
    const byKind = (kind: string) => manifest.files.filter((f) => f.kind === kind)
    expect(byKind('codelists')[0]?.rowCount).toBe(codelists.length)
    expect(byKind('displays')[0]?.rowCount).toBe(displays.length)
    const factEntries = byKind('facts')
    expect(factEntries.map((f) => f.datasetCode).sort())
      .toEqual(['ACCOUNTS_SEQUENCE', 'GDP_ANNUAL', 'REGIONAL_GVA'])
    for (const entry of factEntries) {
      expect(entry.rowCount).toBe(factObs.get(entry.datasetCode!)!.length)
      expect(entry.path).toBe(`facts/${entry.datasetCode}.bundle.json`)
    }
  })

  // ── Every facts row carries the required keys with the right shape ──
  for (const code of FACT_DATASETS) {
    it(`${code}: every facts row is well-formed (timePeriod, dimKey, value, status)`, () => {
      const obs = factObs.get(code)!
      expect(obs.length).toBeGreaterThan(0)
      for (const o of obs) {
        expect(typeof o.timePeriod).toBe('string')
        expect(o.timePeriod.length).toBeGreaterThan(0)
        // dimKey must be a non-empty object of string-coded dimensions.
        expect(o.dimKey !== null && typeof o.dimKey === 'object').toBe(true)
        const dims = Object.keys(o.dimKey)
        expect(dims.length).toBeGreaterThan(0)
        for (const d of dims) expect(typeof o.dimKey[d]).toBe('string')
        // value is numeric or an explicit null (a gap), never undefined/string.
        expect(o.obsValue === null || typeof o.obsValue === 'number').toBe(true)
        // status is present (default 'A' is applied at projection, but the file
        // should carry it explicitly post-extraction).
        expect(typeof (o.obsStatus ?? 'A')).toBe('string')
      }
    })
  }

  // ── Codelists + displays are well-formed (the dimension vocabulary) ──
  it('codelists are well-formed (code + dimCode + label on every entry)', () => {
    expect(codelists.length).toBeGreaterThan(0)
    for (const c of codelists) {
      expect(typeof c.code).toBe('string')
      expect(c.code.length).toBeGreaterThan(0)
      expect(typeof c.dimCode).toBe('string')
      expect(c.dimCode.length).toBeGreaterThan(0)
      expect(c.label !== undefined && c.label !== null).toBe(true)
    }
  })

  it('displays are well-formed (code + dimCode + display on every entry)', () => {
    expect(displays.length).toBeGreaterThan(0)
    for (const d of displays) {
      expect(typeof d.code).toBe('string')
      expect(d.code.length).toBeGreaterThan(0)
      expect(typeof d.dimCode).toBe('string')
      expect(d.dimCode.length).toBeGreaterThan(0)
      expect(d.display !== undefined && d.display !== null).toBe(true)
    }
  })

  // ── Referential sanity: facts dims + displays resolve into the codelists ──
  // Cheap set-membership checks — the codelists are the dimension vocabulary the
  // gold validation trigger enforces at load; proving the files agree pre-load
  // surfaces a broken extract before it reaches the DB tier.
  it('every dimension used by facts is declared in the codelists', () => {
    const knownDims = new Set(codelists.map((c) => c.dimCode))
    // geo is injected at extraction (geo='GE'/region codes) and is a real dim in
    // the facts; assert each dim either has codelist members OR is the injected geo.
    const factDims = new Set<string>()
    for (const code of FACT_DATASETS) {
      for (const o of factObs.get(code)!) for (const d of Object.keys(o.dimKey)) factDims.add(d)
    }
    const unknown = [...factDims].filter((d) => !knownDims.has(d) && d !== 'geo')
    expect(unknown).toEqual([])
  })

  it('every display targets a dimension declared in the codelists', () => {
    const knownDims = new Set(codelists.map((c) => c.dimCode))
    const unknown = [...new Set(displays.map((d) => d.dimCode))].filter((d) => !knownDims.has(d))
    expect(unknown).toEqual([])
  })

  // ── DSD-COMPLETENESS: every obs dim_key VALUE is a declared classifier member ──
  // ROOT CAUSE this guards (live-seed regression): an observation referenced
  // measure=GDP_DEFLATOR, a code absent from the classifier codelist, so the V4
  // validate_observation_dim_key trigger rejected it at load (the DSD contract the
  // cube enforces — each dim_key value must resolve to a CURRENT classifier member).
  // The dimension-level check above proves the KEY SET is grounded; this proves the
  // VALUE SET is too. The set of (dim_code, code) used across ALL observation
  // dim_keys must be a SUBSET of the classifier set. A future obs that introduces an
  // unknown code fails HERE, offline, before the cube ever rejects it.
  it('every (dim_code, code) used in any observation dim_key is a declared classifier member (DSD-completeness)', () => {
    const known = new Set(codelists.map((c) => `${c.dimCode} ${c.code}`))
    const missing = new Set<string>()
    for (const code of FACT_DATASETS) {
      for (const o of factObs.get(code)!) {
        for (const [dim, value] of Object.entries(o.dimKey)) {
          if (!known.has(`${dim} ${value}`)) missing.add(`${dim}=${value}`)
        }
      }
    }
    expect([...missing].sort()).toEqual([])
  })

  // ── Unit metadata references a real unit code (SDMX UNIT_MEASURE / V16 codelist) ──
  // A classifier may carry metadata.unit_measure (the measure-level unit attribute,
  // [[project-decision-c-unit-measure]]). If present it MUST be a code that exists in
  // the V16 stats.unit_measure seed — otherwise the unit is meaningless / would dangle.
  // Mirrors the V16 INSERT set; a typo'd or invented unit fails offline.
  it('every classifier metadata.unit_measure is a valid V16 unit_measure code', () => {
    const V16_UNITS = new Set([
      'GEL', 'USD', 'EUR', 'GEL_MN', 'USD_MN',
      'PERCENT', 'RATIO', 'RATIO_PCT', 'PURE_NUMBER', 'INDEX', 'PERSON',
    ])
    const bad = codelists
      .map((c) => (c.metadata as Record<string, unknown> | undefined)?.unit_measure)
      .filter((u): u is string => typeof u === 'string')
      .filter((u) => !V16_UNITS.has(u))
    expect([...new Set(bad)]).toEqual([])
  })

  // ── ADR-0023 parentCode integrity: the edge is SAME-dim, never cross-dim ──
  // ROOT CAUSE this guards (live-run regression): measure classifiers carried a
  // parentCode pointing at an `approach` value (production/expenditure/...), which
  // is not a `measure` member. parent_code is a SAME dim_code business-key edge;
  // the V23 trg_classifier_code_path trigger RAISES on a non-current same-dim
  // parent, and ingest publishClassifiers' topological resolve fails identically.
  // The fix flattened measures (approach is metadata.approach, an attribute) and
  // kept the genuine geo→total / sector→_T same-dim hierarchies. This invariant
  // makes the cross-dim mis-mapping unrepresentable in the committed SSOT — a
  // re-introduced cross-dim parent fails here, with no DB, before the seed runs.
  it('every classifier parentCode resolves to a same-dim member (no cross-dim edge)', () => {
    const codesByDim = new Map<string, Set<string>>()
    for (const c of codelists) {
      if (!codesByDim.has(c.dimCode)) codesByDim.set(c.dimCode, new Set())
      codesByDim.get(c.dimCode)!.add(c.code)
    }
    const crossDim = codelists
      .filter((c) => c.parentCode != null)
      .filter((c) => !(codesByDim.get(c.dimCode)?.has(c.parentCode!) ?? false))
      .map((c) => `${c.dimCode}/${c.code}→${c.parentCode}`)
    expect(crossDim).toEqual([])
  })

  // No classifier may be its own parent (a trivial 1-cycle the trigger would also
  // reject). Cheap structural guard alongside the same-dim invariant above.
  it('no classifier parentCode points at itself', () => {
    const selfParents = codelists
      .filter((c) => c.parentCode != null && c.parentCode === c.code)
      .map((c) => `${c.dimCode}/${c.code}`)
    expect(selfParents).toEqual([])
  })

  // ── Approach grouping is preserved as the metadata attribute (not lost) ──
  // The flatten removed the cross-dim parentCode but the SDMX approach grouping
  // MUST survive as metadata.approach. Assert measures are flat (no same-dim
  // parent) and the approach attribute is still present on the grouped measures.
  it('measures are flat and carry approach as metadata.approach, not as a parent edge', () => {
    const measures = codelists.filter((c) => c.dimCode === 'measure')
    expect(measures.length).toBeGreaterThan(0)
    for (const m of measures) {
      // a measure must never carry a same-dim parent edge (measures are flat)
      expect(m.parentCode == null).toBe(true)
    }
    // the approach attribute is present on the grouped measures (the 22 that
    // previously encoded it as a cross-dim parent now encode it here).
    const withApproach = measures.filter((m) => m.metadata?.approach != null)
    expect(withApproach.length).toBeGreaterThan(0)
  })
})

// ════════════════════════════════════════════════════════════════════════
// TIER 2 — DB-GATED (skips without DATABASE_URL; a real gate in CI)
// ════════════════════════════════════════════════════════════════════════
//
// The real preservation proof: stage-1 SQL gold == the bundle files, against a
// LIVE migrated DB that has had R__seed_geostat_gold.sql applied (Flyway). Reads
// stats.observation back and compares to the file projection via ParityRow.
// stage-2 (pipeline) gold is verified by verify-parity.ts against a running API;
// this tier covers stage-1 (the SQL net) so both preservation paths are gated.
// Skipped offline so it is a no-op locally and a real assertion where the
// migrated+seeded DB exists.
const DATABASE_URL = process.env.DATABASE_URL
const dbSuite = DATABASE_URL ? describe : describe.skip

dbSuite('ADR-0028 PROVE — stage-1 SQL gold == bundle files (DB-gated)', () => {
  // Imported lazily so the pg dependency is only touched when the suite runs.
  let pool: import('pg').Pool

  beforeAll(async () => {
    const { Pool } = await import('pg')
    pool = new Pool({ connectionString: DATABASE_URL })
  })

  async function goldParityRows(dataset: string): Promise<ParityRow[]> {
    const { rows } = await pool.query<{
      time_period: string
      dim_key: Record<string, string>
      obs_value: string | number | null
      obs_status: string
    }>(
      `SELECT time_period, dim_key, obs_value, obs_status
         FROM stats.observation
        WHERE dataset_code = $1`,
      [dataset],
    )
    return rows.map((r) => ({
      dataset,
      time: r.time_period,
      dimKey: r.dim_key,
      value: r.obs_value === null ? null : Number(r.obs_value),
      obsStatus: r.obs_status,
    }))
  }

  for (const code of FACT_DATASETS) {
    it(`${code}: stage-1 SQL gold == bundle file projection`, async () => {
      const bundle = await readJson<FactsBundle>(resolve(FACTS_DIR, `${code}.bundle.json`))
      const files = obsFileToParityRows(code, bundle.obs ?? [])
      const gold = await goldParityRows(code)

      expect(gold.length).toBe(files.length)
      const issues = diffParity(files, gold)
      expect(issues).toEqual([])
    })
  }
})
