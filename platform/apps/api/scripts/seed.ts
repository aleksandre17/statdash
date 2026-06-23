// ════════════════════════════════════════════════════════════════════════
// seed.ts — idempotent ETL: extracted seed-data files → stats.* cube
// ════════════════════════════════════════════════════════════════════════
//
// ROLE: a build-time ingestion tool (Pipe-and-Filter ETL), NOT API runtime.
//   It reads the committed, pre-projected seed-data bundle files and upserts
//   them onto the SDMX cube. The Fastify app never imports this; this never
//   imports the Fastify app.
//
// SOURCE (ADR-0028 — geostat de-tenanting): the TS dataset bundles
//   (apps/geostat/src/data/**) were DELETED when geostat became a pure runner.
//   The new SSOT is ops/seed-data/geostat/, the EXACT `format:'bundle'` shape
//   the ingest pipeline consumes:
//     codelists.bundle.json  → RawClassifierRow[]  (cross-dataset merged, ordered
//                              parents-before-children by construction)
//     displays.bundle.json   → RawDisplayRow[]     (per-member, per-locale overlay)
//     facts/<DATASET>.bundle.json → RawObsRow[]    (dim_key ALREADY projected:
//                              codes resolved, geo='GE' injected, seqPos moved to
//                              obs_attribute — nothing surrogate left to resolve)
//   Because the files carry the post-projection rows, the former dataset-specific
//   seedGdp/seedAccounts/seedRegional logic collapses into ONE generic loader:
//   upsert classifiers → displays → observations, verbatim from the files. The
//   id→code / geo-inject / seqPos work already happened at extraction time
//   (apps/api/scripts/export-seed-data.ts, run once before the TS was deleted).
//
// IDEMPOTENCY: every write is INSERT … ON CONFLICT (upsert), never
//   check/delete/insert. Re-run = converge, never duplicate, never error.
//
// DEPENDENCY ORDER (so the V4 validation trigger always passes):
//   dimensions → datasets+DSD (from V7 migration, asserted present) →
//   classifier members (parents first) → classifier_display → observations →
//   version bump.
//
// USAGE:  pnpm --filter @statdash/api seed      (see package.json "seed" script)
//         DATABASE_URL must point at the migrated database.
//         SEED_MODE=pipeline routes to the bronze producer (POSTs the files).
// ════════════════════════════════════════════════════════════════════════

import { Pool, type PoolClient } from 'pg'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

import type { RawObsRow, RawClassifierRow, RawDisplayRow } from '../src/ingest/types.js'

// ── Extracted seed-data files (the ETL input — ADR-0028 SSOT) ─────────────
// apps/api/scripts → repo-root ops/seed-data/geostat (ops/ is a sibling of
// platform/, where the postgres migrations also live).
const here = dirname(fileURLToPath(import.meta.url))
const SEED_DATA_DIR = resolve(here, '../../../../ops/seed-data/geostat')
const FACTS_DIR = resolve(SEED_DATA_DIR, 'facts')

interface BronzePayload {
  obs?: RawObsRow[]
  classifiers?: RawClassifierRow[]
  displays?: RawDisplayRow[]
}

function readBundle(path: string): BronzePayload {
  return JSON.parse(readFileSync(path, 'utf8')) as BronzePayload
}

const CLASSIFIERS = readBundle(resolve(SEED_DATA_DIR, 'codelists.bundle.json')).classifiers ?? []
const DISPLAYS = readBundle(resolve(SEED_DATA_DIR, 'displays.bundle.json')).displays ?? []

// The datasets to load, in publish order (facts after their referent codelists).
const DATASETS = ['GDP_ANNUAL', 'ACCOUNTS_SEQUENCE', 'REGIONAL_GVA'] as const

// ── GAP 3 — unit / decimals per MEASURE code ──────────────────────────────
// The unit metadata is carried in each measure classifier's `metadata` bag in
// codelists.bundle.json (written by export-seed-data at extraction), so the seed
// no longer mirrors the engine unit registry here — it loads what the file says.

// DATABASE_URL is required ONLY for the direct path (it writes the cube). The
// pipeline path (SEED_MODE=pipeline) talks to the API over HTTP and never opens
// a pool, so it must not be forced to set a DB URL. The guard therefore skips in
// pipeline mode; the direct path's behaviour is unchanged.
const SEED_MODE = process.env.SEED_MODE ?? 'direct'
const DATABASE_URL = process.env.DATABASE_URL
if (SEED_MODE !== 'pipeline' && !DATABASE_URL) {
  console.error('[seed] DATABASE_URL is required (point it at the migrated database).')
  process.exit(1)
}

// ── Cube write helpers (one concern → seed-helpers.ts) ────────────────────
import {
  upsertDimension,
  upsertClassifier,
  upsertObservation,
} from './seed-helpers.js'

// config.data_source rows (P3-4) — its own concern, separate from the cube ETL.
import { seedDataSources } from './seed-data-sources.js'

// ════════════════════════════════════════════════════════════════════════
// Generic loaders — drive the cube from the pre-projected files.
// ════════════════════════════════════════════════════════════════════════

/**
 * Upsert all classifier members (one cross-dataset codelists bundle), building a
 * (dimCode|code) → surrogate-id map for the display pass. The file is ordered
 * parents-before-children (export-seed-data guarantee), which the V23 code_path
 * trigger requires (a non-null parentCode must already exist as a current member).
 */
async function loadClassifiers(c: PoolClient): Promise<Map<string, number>> {
  const idByKey = new Map<string, number>()
  for (const cl of CLASSIFIERS) {
    const labelKa = cl.label.ka ?? cl.label.en ?? cl.code
    const id = await upsertClassifier(
      c,
      cl.dimCode,
      cl.code,
      labelKa,
      null,
      cl.parentCode ?? null,
      cl.ord ?? 0,
      cl.metadata ?? {},
    )
    idByKey.set(`${cl.dimCode}|${cl.code}`, id)
  }
  return idByKey
}

/**
 * Upsert the per-member, per-locale display overlays. member_id is resolved from
 * the map built during the classifier pass; the display's locale comes from the
 * FILE (the row is the SSOT), not a hardcoded constant.
 */
async function loadDisplays(c: PoolClient, idByKey: Map<string, number>): Promise<void> {
  for (const d of DISPLAYS) {
    const memberId = idByKey.get(`${d.dimCode}|${d.code}`)
    if (memberId === undefined) {
      throw new Error(`[seed] display references unknown member: ${d.dimCode}|${d.code}`)
    }
    await c.query(
      `INSERT INTO stats.classifier_display (member_id, locale, display)
       VALUES ($1, $2, $3::jsonb)
       ON CONFLICT (member_id, locale) DO UPDATE
         SET display = EXCLUDED.display`,
      [memberId, d.locale, JSON.stringify(d.display)],
    )
  }
}

/**
 * Upsert one dataset's observations from facts/<DATASET>.bundle.json. dim_key is
 * already projected in the file (codes only); obsAttribute carries non-key SDMX
 * attributes (e.g. ACCOUNTS seqPos). time_period is annual (a year string).
 */
async function loadFacts(c: PoolClient, datasetCode: string): Promise<void> {
  const obs = readBundle(resolve(FACTS_DIR, `${datasetCode}.bundle.json`)).obs ?? []
  for (const o of obs) {
    await upsertObservation(
      c,
      datasetCode,
      Number(o.timePeriod),
      o.dimKey,
      o.obsValue,
      o.obsStatus ?? 'A',
      o.obsAttribute ?? {},
    )
  }
  await c.query(`SELECT stats.bump_dataset_version($1)`, [datasetCode])
}

// ════════════════════════════════════════════════════════════════════════
// Orchestration — one transaction per phase so a failure rolls back cleanly
// and a re-run converges. Dimensions asserted first (idempotent).
// ════════════════════════════════════════════════════════════════════════
async function main() {
  // Strangler-Fig dispatch: SEED_MODE=pipeline routes to the bronze producer
  // (POSTs the same files through the Staged Submission Pipeline). The default
  // 'direct' path below is unchanged in spirit — direct cube upserts for CI
  // without a running API, now sourced from the extracted files.
  if (SEED_MODE === 'pipeline') {
    const { seedViaPipeline } = await import('./seed-pipeline.js')
    await seedViaPipeline()
    return
  }

  const pool = new Pool({ connectionString: DATABASE_URL })
  try {
    // Assert the dimensions V5/V7 declare (self-contained, idempotent).
    {
      const c = await pool.connect()
      try {
        await c.query('BEGIN')
        await upsertDimension(c, 'measure', 'მაჩვენებელი', 'Measure', 1)
        await upsertDimension(c, 'time', 'პერიოდი', 'Time Period', 2)
        await upsertDimension(c, 'geo', 'ტერიტორია', 'Geography', 3)
        await upsertDimension(c, 'approach', 'მიდგომა', 'Approach', 4)
        await upsertDimension(c, 'account', 'ანგარიში', 'Account', 5)
        await upsertDimension(c, 'side', 'მხარე', 'Side', 6)
        await upsertDimension(c, 'sector', 'სექტორი', 'Sector', 7)
        await c.query('COMMIT')
      } catch (e) { await c.query('ROLLBACK'); throw e } finally { c.release() }
    }

    // Classifiers + displays (cross-dataset; referents for every fact set). One
    // transaction so the code_path/parent invariants converge atomically.
    {
      const c = await pool.connect()
      try {
        await c.query('BEGIN')
        await c.query(`SET LOCAL app.revised_by = 'seed'`)
        const idByKey = await loadClassifiers(c)
        await loadDisplays(c, idByKey)
        await c.query('COMMIT')
        console.log(`[seed] codelists + displays committed (${CLASSIFIERS.length} members, ${DISPLAYS.length} displays).`)
      } catch (e) {
        await c.query('ROLLBACK')
        console.error('[seed] codelists/displays FAILED (rolled back):', e)
        throw e
      } finally {
        c.release()
      }
    }

    // Facts — one transaction per dataset (so a failure rolls back just that set).
    for (const datasetCode of DATASETS) {
      const c = await pool.connect()
      try {
        await c.query('BEGIN')
        // GAP 4: attribute any revision the V8 trigger records to the seed job.
        await c.query(`SET LOCAL app.revised_by = 'seed'`)
        await loadFacts(c, datasetCode)
        await c.query('COMMIT')
        console.log(`[seed] ${datasetCode} committed.`)
      } catch (e) {
        await c.query('ROLLBACK')
        console.error(`[seed] ${datasetCode} FAILED (rolled back):`, e)
        throw e
      } finally {
        c.release()
      }
    }

    // config.data_source rows (P3-4) — own transaction; depends on nothing in the
    // stats cube above, but seeded last so a cube failure never leaves dangling
    // 'connected' sources pointing at an unseeded dataset.
    {
      const c = await pool.connect()
      try {
        await c.query('BEGIN')
        await seedDataSources(c)
        await c.query('COMMIT')
        console.log('[seed] DATA_SOURCES committed.')
      } catch (e) {
        await c.query('ROLLBACK')
        console.error('[seed] DATA_SOURCES FAILED (rolled back):', e)
        throw e
      } finally {
        c.release()
      }
    }

    console.log('[seed] done — all datasets converged.')
  } finally {
    await pool.end()
  }
}

main().catch((e) => {
  console.error('[seed] fatal:', e)
  process.exit(1)
})
