// ── Fitness function — observation writers must PROVIDE time_period_date ──────
//
// THE INVARIANT (the architectural characteristic this locks):
//   "Every INSERT INTO stats.observation supplies time_period_date inline as
//    stats.parse_time_period(time_period)."
//
// ROOT CAUSE this guards (PROVEN on live TimescaleDB): time_period_date is the
// hypertable partition column. It can be neither a GENERATED column (TimescaleDB
// forbids a generated column as the partition dimension) NOR trigger-derived
// (TimescaleDB enforces the partition-column NOT-NULL check BEFORE user BEFORE-row
// triggers run, so a BEFORE INSERT trigger never populates it in time — every
// observation INSERT failed with `NULL value in column "time_period_date"
// violates not-null constraint`). The only working mechanism is writer-provided:
// each writer computes it from the SSOT rule stats.parse_time_period(time_period).
//
// This is a source-level fitness assertion (no DB, runs everywhere): a future
// writer that forgets time_period_date — re-introducing the NULL-partition bug —
// fails HERE, before it can reach the live cube. It scans every observation
// writer in the repo: the ingest publish/upsert paths, the seed helper, and the
// R__ stage-1 gold seed SQL.
//
// SSOT note: the assertion requires stats.parse_time_period as the value source,
// so no writer may reimplement the time_period→date rule inline (which would fork
// the rule V9 widens by CREATE OR REPLACE).

import { describe, it, expect } from 'vitest'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
// apps/api/src/ingest → repo root (../../../../..) → ops/postgres/seed/...
const repoRoot = resolve(here, '../../../../..')

// Every observation writer in the repo. App writers (TS) + the stage-1 gold seed
// (SQL). seed-helpers.upsertObservation is the per-row app/seed path; publish.ts
// is the set-based promotion; upsert.ts is the runtime upsert; the R__ SQL is the
// Flyway preservation net.
const WRITERS: Array<{ label: string; path: string }> = [
  { label: 'ingest/publish.ts',        path: resolve(here, 'publish.ts') },
  { label: 'ingest/upsert.ts',         path: resolve(here, 'upsert.ts') },
  { label: 'scripts/seed-helpers.ts',  path: resolve(here, '../../scripts/seed-helpers.ts') },
  { label: 'seed/R__seed_geostat_gold.sql', path: resolve(repoRoot, 'ops/postgres/seed/R__seed_geostat_gold.sql') },
]

// Strip comments so the assertion checks the executable data-path, not the prose
// that legitimately names the historical GENERATED/trigger mechanisms to explain
// WHY they were rejected. Handles SQL (-- …, /* … */) and TS (// …, /* … */).
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '') // block comments (SQL + TS)
    .replace(/^\s*--.*$/gm, '')        // SQL line comments
    .replace(/^\s*\/\/.*$/gm, '')      // TS line comments
}

// Find every `INSERT INTO stats.observation ( … )` column list (the table being
// stats.observation, NOT stats.observation_revision — anchored on the '(').
const OBS_INSERT_COLS = /INSERT\s+INTO\s+stats\.observation\s*\(([^)]*)\)/gi

describe('observation writers provide the partition column (TimescaleDB invariant)', () => {
  for (const w of WRITERS) {
    it(`${w.label}: every INSERT INTO stats.observation lists time_period_date`, async () => {
      const code = stripComments(await readFile(w.path, 'utf8'))
      const matches = [...code.matchAll(OBS_INSERT_COLS)]

      // Each writer must actually contain at least one obs INSERT (guards against a
      // moved/renamed writer silently dropping out of this fitness net).
      expect(matches.length, `${w.label} has no INSERT INTO stats.observation`).toBeGreaterThan(0)

      const omitting = matches
        .map((m) => m[1].replace(/\s+/g, ' ').trim())
        .filter((cols) => !/\btime_period_date\b/.test(cols))

      expect(omitting, `${w.label} has obs INSERT(s) omitting time_period_date`).toEqual([])
    })
  }

  // SSOT: the partition value must come from stats.parse_time_period — no writer
  // may reimplement the time_period→date rule. Every writer that inserts
  // observations must reference the function.
  for (const w of WRITERS) {
    it(`${w.label}: supplies time_period_date via stats.parse_time_period (SSOT)`, async () => {
      const code = stripComments(await readFile(w.path, 'utf8'))
      if (![...code.matchAll(OBS_INSERT_COLS)].length) return // covered by the test above
      expect(code).toMatch(/stats\.parse_time_period\s*\(/)
    })
  }
})
