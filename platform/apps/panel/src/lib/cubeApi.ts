// ── Cube discovery client — the capability-introspection surface ─────────────
//
//  GET  /api/cube/:datasetCode/profile   — the atomic introspection bundle:
//        dimensions (+ conceptRole/isTime/members), measures (+ resolved unit),
//        and the realised actualRegion combinations.
//  POST /api/cube/:datasetCode/classify  — three-way combo classification
//        (has-data / empty-by-design / missing) of specific dim-value combos.
//
//  This is a SIBLING scope of configApi (apps/panel/src/lib/api.ts). The cube
//  routes are deliberately OFF the JWT-guarded config scope (a read-only
//  delivery surface — least-privilege at the boundary), so they do NOT carry
//  the /api/config prefix. Split into its own file (config CRUD vs cube
//  discovery are distinct concerns; one-body hygiene) but it reuses the SAME
//  transport (requestAt) so there is still exactly one HTTP adapter (Law 5).
//
//  The wire shapes below MIRROR the apps/api response shapes EXACTLY
//  (routes/cube/index.ts CubeProfile + actual-region.ts ActualRegion /
//  ClassifiedCombo). They are the CONSUMED CONTRACT: the panel never reaches
//  into packages/ or apps/api for them — the wire is the boundary, and this is
//  the one place the panel adapts if the server shape evolves.
//
import { requestAt } from './api'

// The cube discovery scope. A leading-empty prefix in requestAt + the full
// path here keeps all cube URLs assembled in this one file.
const CUBE_PREFIX = '/api/cube'
// The stats scope — sibling public read used to LIST datasets (the cube picker
// for source authoring). Distinct server scope, same transport (Law 5).
const STATS_PREFIX = '/api/stats'

/** One row of GET /api/stats/datasets — a pickable cube (code + display label). */
export interface CubeDatasetRow {
  code:  string
  label: string
}

// ── Wire shapes (exact mirror of the api cube route contract) ────────────────

export type CubeLocaleString = Record<string, string>

/** One member of a dimension's live codelist. */
export interface CubeProfileMember {
  code:       string
  label:      CubeLocaleString
  parentCode: string | null
}

/** One cube axis: DSD placement (isTime), SDMX concept role, its members. */
export interface CubeProfileDimension {
  code:        string
  conceptRole: string | null
  isTime:      boolean
  members:     CubeProfileMember[]
}

/**
 * Resolved unit for a measure. `source` names the winning resolution tier
 * (measure → dataset → none); the Constructor warns on source==='none'.
 */
export interface CubeResolvedUnit {
  unit_code:   string | null
  symbol:      string | null
  label:       CubeLocaleString | null
  unit_type:   string | null
  unit_mult:   number | null
  decimals:    number | null
  base_period: string | null
  source:      'measure' | 'dataset' | 'none'
}

/** A measure with its resolved unit. */
export interface CubeProfileMeasure {
  code:  string
  label: CubeLocaleString
  unit:  CubeResolvedUnit
}

/** One realised dim-value combination, enriched with density signals. */
export interface CubeActualCombination {
  dimKey:          Record<string, string>
  obsCount:        number
  firstTimePeriod: string | null
  lastTimePeriod:  string | null
}

/**
 * The actual region — which dim-value combinations realised data.
 * `available:false` + `combinations:null` is the graceful-degradation case
 * (the server's V26 view is absent in this environment).
 */
export interface CubeActualRegion {
  available:    boolean
  combinations: CubeActualCombination[] | null
}

/** The full introspection bundle a Constructor reads to know what it can build. */
export interface CubeProfile {
  datasetCode:  string
  dimensions:   CubeProfileDimension[]
  measures:     CubeProfileMeasure[]
  actualRegion: CubeActualRegion
}

/** The three-way SDMX classification of a dim-value combination. */
export type CubeComboClassification = 'has-data' | 'empty-by-design' | 'missing'

export interface CubeClassifiedCombo {
  dimKey:         Record<string, string>
  classification: CubeComboClassification
}

export interface CubeClassifyResult {
  datasetCode: string
  classified:  CubeClassifiedCombo[]
}

// ── Endpoint group ───────────────────────────────────────────────────────────

export const cubeApi = {
  /**
   * List the available cubes — the PICK-don't-type source for the stats
   * source-authoring cube picker (Law 2: the author selects a real dataset code,
   * never hand-types 'NAT_ACCOUNTS'). Reads the public stats datasets surface.
   */
  datasets: () =>
    requestAt<CubeDatasetRow[]>('', 'GET', `${STATS_PREFIX}/datasets`),

  /** Read the introspection bundle for a dataset. 404 if the dataset is unknown. */
  profile: (datasetCode: string) =>
    requestAt<CubeProfile>('', 'GET', `${CUBE_PREFIX}/${encodeURIComponent(datasetCode)}/profile`),

  /**
   * Classify specific dim-value combinations three-ways. 409 if the server's
   * V26 region view is not deployed — callers degrade gracefully (treat as
   * "classification unavailable", never block authoring on it).
   */
  classify: (datasetCode: string, combinations: Array<Record<string, string>>) =>
    requestAt<CubeClassifyResult>(
      '',
      'POST',
      `${CUBE_PREFIX}/${encodeURIComponent(datasetCode)}/classify`,
      { combinations },
    ),
}
