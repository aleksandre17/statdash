// ── actual-region — the V26 SEAM (ADR-0027 SDMX ContentConstraint) ────────────
//
//  Owns everything about stats.cube_actual_region (V26): the wire shapes, the
//  realised-combinations loader the profile bundle embeds, and the three-way
//  classification (has-data / empty-by-design / missing) the classify route serves.
//  Split out of index.ts (one concern per file, 400-line hygiene): index.ts owns
//  the profile composition, this file owns the actual-region capability.
//
//  stats.cube_actual_region is a VIEW over stats.observation exposing
//  (dataset_code, dim_key JSONB, obs_count, first_time_period, last_time_period) —
//  DISTINCT realised dim-value combinations per dataset with their density signals.
//  stats.dim_key_in_allowed_region(dataset_code, dim_key) is the SSOT predicate for
//  "is this combo inside the dataset's authored allowed region" (reused by the
//  silver gate + the fitness test + here — one definition, never three).

import type { FastifyPluginAsync } from 'fastify'

type App = Parameters<FastifyPluginAsync>[0]

// ── Wire shapes ───────────────────────────────────────────────────────────────

/**
 * One realised dim-value combination — a row of stats.cube_actual_region (V26).
 * `dimKey` is the whole realised key as JSONB (generic over dim codes, Law 1: the
 * consumer reads dimKey[code], no dimension name baked in). The density signals
 * (obsCount + time bounds) come straight from the view's aggregate columns and let
 * the Constructor rank/badge combos by coverage without a second query.
 */
export interface ActualCombination {
  dimKey:          Record<string, string>
  obsCount:        number
  firstTimePeriod: string | null
  lastTimePeriod:  string | null
}

/**
 * The actual region — which dim-value COMBINATIONS realised data. Sourced from
 * stats.cube_actual_region (V26, ADR-0027), which does NOT exist in every
 * environment yet. `available: false` + `combinations: null` is the graceful
 * degradation when the view is absent (see loadActualRegion).
 *
 * SHAPE DECISION (ADR-0027 Constructor exposure): we expose the ACTUAL combinations
 * (the has-data set) ENRICHED with density signals — NOT the full Cartesian product
 * of the allowed region. The view can be large per dataset, but the actual set is
 * the realised subset and is exactly what the Constructor offers ("the Constructor
 * offers only has-data combinations"). The three-way has-data / empty-by-design /
 * missing classification of a SPECIFIC combo is served on demand by the classify
 * route (POST /:datasetCode/classify), backed by the SSOT helper
 * stats.dim_key_in_allowed_region — so the Constructor classifies only the combos
 * it cares about, never paying for the Cartesian.
 */
export interface ActualRegion {
  available:    boolean
  combinations: ActualCombination[] | null
}

/** The three-way SDMX classification of a dim-value combination (ADR-0027). */
export type ComboClassification = 'has-data' | 'empty-by-design' | 'missing'

/** One classified combo — the classify route's per-item wire shape. */
export interface ClassifiedCombo {
  dimKey:         Record<string, string>
  classification: ComboClassification
}

// ── Server-internal row shapes (never leaked verbatim) ────────────────────────
interface ActualRegionRow {
  dim_key:           Record<string, string>
  obs_count:         number | string  // count(*) → bigint → pg may surface as string
  first_time_period: string | null
  last_time_period:  string | null
}

// ── loadActualRegion — the realised combinations the profile bundle embeds ─────
//
//  GRACEFUL DEGRADATION is KEPT even though V26 exists: a deployment may run api
//  against a database that has not YET applied V26 (rolling migration window), so
//  the to_regclass precondition probe stays — an absent view degrades to
//  available:false / combinations:null, never a 500. The dims+measures bundle is
//  fully useful without the actual region (it is an enrichment, not a precondition).
export async function loadActualRegion(app: App, datasetCode: string): Promise<ActualRegion> {
  // Feature-check: does stats.cube_actual_region exist in THIS database? to_regclass
  // returns NULL for an absent relation WITHOUT raising — a clean precondition test
  // that does not depend on catching a query error (fail-fast, but on a missing
  // CAPABILITY, not a thrown exception we'd have to disambiguate from a real fault).
  if (!(await viewExists(app))) {
    // V26 not applied in THIS database (rolling migration window) → the seam stays
    // closed. Logged at debug so it is visible during a rollout without noising
    // normal operation.
    app.log.debug(
      { datasetCode },
      'cube-profile: stats.cube_actual_region absent (V26 not applied here) — actualRegion=null',
    )
    return { available: false, combinations: null }
  }

  // View EXISTS → read the realised combinations + density signals. Wrapped so a
  // transient read fault degrades the SEAM only (available:false) rather than 500ing
  // the whole profile (graceful degradation; the actual region is an enrichment).
  try {
    const { rows } = await app.pg.query<ActualRegionRow>(
      `SELECT dim_key, obs_count, first_time_period, last_time_period
         FROM stats.cube_actual_region
        WHERE dataset_code = $1
        ORDER BY obs_count DESC`,
      [datasetCode],
    )
    return {
      available: true,
      combinations: rows.map((r) => ({
        dimKey:          r.dim_key,
        // count(*) is bigint; pg may hand it back as a string. Number() normalises
        // to a JSON number for the wire (obs counts are well within Number range).
        obsCount:        Number(r.obs_count),
        firstTimePeriod: r.first_time_period,
        lastTimePeriod:  r.last_time_period,
      })),
    }
  } catch (err) {
    app.log.warn(
      { err, datasetCode },
      'cube-profile: stats.cube_actual_region read failed — degrading actualRegion to unavailable',
    )
    return { available: false, combinations: null }
  }
}

// ── classifyCombos — the three-way classification of specific combos (ADR-0027) ─
//
//  WHY on-demand (a POST route, not part of the profile bundle): the full three-way
//  classification over the WHOLE allowed region is the Cartesian product of the
//  per-dim allowed sets — potentially huge. Over-fetching it on every profile read
//  is exactly what ADR-0027 warns against. The profile ships the has-data set (the
//  actual region); the Constructor classifies the SPECIFIC combos it cares about
//  here — pay only for what you ask.
//
//  SSOT: classification reuses the V26 helper stats.dim_key_in_allowed_region (the
//  single authority for "in the region", shared with the silver gate + fitness
//  test) for allowed-membership, joined against stats.cube_actual_region for
//  realised-membership. The api NEVER re-derives the predicate — that would fork the
//  rule ADR-0027 centralised.
//
//    has-data        = combo present in stats.cube_actual_region (realised).
//    empty-by-design = dim_key_in_allowed_region() true  AND not realised.
//    missing         = dim_key_in_allowed_region() false (illegal by design).
export async function classifyCombos(
  app: App,
  datasetCode: string,
  dimKeys: Array<Record<string, string>>,
): Promise<ClassifiedCombo[]> {
  if (dimKeys.length === 0) return []

  // One round-trip for the whole batch: explode the supplied keys WITH ORDINALITY
  // (preserving request order), test realised-membership against the view, and call
  // the SSOT predicate for allowed-membership. Classification is a pure CASE over
  // those two booleans, computed in TS so the wire vocabulary stays here.
  const { rows } = await app.pg.query<{ idx: number; realised: boolean; allowed: boolean }>(
    `WITH input(idx, dim_key) AS (
       SELECT ordinality - 1, value
         FROM jsonb_array_elements($2::jsonb) WITH ORDINALITY AS t(value, ordinality)
     )
     SELECT i.idx,
            EXISTS (
              SELECT 1 FROM stats.cube_actual_region car
               WHERE car.dataset_code = $1 AND car.dim_key = i.dim_key
            ) AS realised,
            stats.dim_key_in_allowed_region($1, i.dim_key) AS allowed
       FROM input i`,
    [datasetCode, JSON.stringify(dimKeys)],
  )

  const byIdx = new Map(rows.map((r) => [r.idx, r]))
  return dimKeys.map((dimKey, idx) => {
    const r = byIdx.get(idx)
    const classification: ComboClassification = !r
      ? 'missing'
      : r.realised
        ? 'has-data'
        : r.allowed
          ? 'empty-by-design'
          : 'missing'
    return { dimKey, classification }
  })
}

// ── viewExists — shared V26 precondition probe ────────────────────────────────
//
//  to_regclass returns NULL for an absent relation without raising. Both the loader
//  (degrade to null) and the classify route (404 the capability) read this — one
//  definition of "is V26 applied here", not two.
export async function viewExists(app: App): Promise<boolean> {
  const { rows } = await app.pg.query<{ exists: boolean }>(
    `SELECT to_regclass('stats.cube_actual_region') IS NOT NULL AS exists`,
  )
  return rows[0]?.exists === true
}
