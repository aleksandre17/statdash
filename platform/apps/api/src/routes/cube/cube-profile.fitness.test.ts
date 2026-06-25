// ── cube-profile fitness functions (source assertions, no DB) ─────────────────
//
// Architectural invariants the cube-profile bundle must hold, encoded as source
// assertions so a future edit that reaches around an SSOT trips a test rather than
// shipping silently (Evolutionary Architecture — standards as code). These need no
// database and always run; the DB-gated SHAPE tests live in cube-profile.test.ts.
//
//   FF-TIME-COVERAGE-SSOT (ADR time-range-readiness-seam, T0): the profile's
//   timeCoverage derives ONLY from the V26 cube_actual_region lineage — min/max
//   aggregate the realised region's first/last_time_period, and the distinct
//   ascending period list is read from stats.observation (the SAME table
//   cube_actual_region is built from, the documented single "what periods exist"
//   SSOT). loadTimeCoverage must NOT fork a second period-enumeration rule (e.g. a
//   bespoke time-axis codelist scan) — that would split the period truth in two.

import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))

describe('cube-profile fitness — timeCoverage derives from the V26 region SSOT (FF-TIME-COVERAGE-SSOT)', () => {
  it('loadTimeCoverage reads cube_actual_region bounds + the observation period SSOT, not a forked rule', async () => {
    const source = await readFile(resolve(here, 'actual-region.ts'), 'utf8')

    // Strip comments so the assertion checks the executable SQL data-path, not the
    // prose explaining the invariant.
    const codeOnly = source
      .replace(/\/\*[\s\S]*?\*\//g, '') // block comments
      .replace(/^\s*\/\/.*$/gm, '')      // line comments

    // Isolate the loadTimeCoverage function body so the assertions are scoped to the
    // coverage data-path (the file also owns loadActualRegion / classifyCombos).
    const start = codeOnly.indexOf('export async function loadTimeCoverage')
    expect(start, 'loadTimeCoverage must exist').toBeGreaterThanOrEqual(0)
    const next = codeOnly.indexOf('export async function ', start + 1)
    const body = next >= 0 ? codeOnly.slice(start, next) : codeOnly.slice(start)

    // min/max aggregate the V26 realised region (the same table loadActualRegion reads).
    expect(body).toMatch(/MIN\(first_time_period\)/)
    expect(body).toMatch(/MAX\(last_time_period\)/)
    expect(body).toContain('stats.cube_actual_region')

    // periods = the distinct ASCENDING list from the observation table (the documented
    // period SSOT — the same source cube_actual_region aggregates from).
    expect(body).toMatch(/SELECT DISTINCT time_period/)
    expect(body).toContain('stats.observation')
    expect(body).toMatch(/ORDER BY time_period/)

    // No forked "what periods exist" rule: coverage must not enumerate periods from a
    // separate time-axis codelist (stats.classifier / a bespoke time-dimension scan).
    expect(body).not.toContain('stats.classifier')
  })
})
