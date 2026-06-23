// ── Public cube-profile surface (ADR-0026 Constructor capability) ─────────────
//
//  GET /api/cube/:datasetCode/profile — the INTROSPECTION bundle the Constructor
//  reads to know what it can build on a dataset, WITHOUT a human describing it.
//  One atomic read: the dataset's dimensions (DSD + concept role + members), its
//  measures (each with its RESOLVED unit), and which dim-value combinations
//  actually have data (the actual region, V26). This is the "capability discovery
//  / palette" rule of a config-driven builder (skill §12): the Constructor browses
//  only what is declared and populated, never guesses.
//
//  POST /api/cube/:datasetCode/classify — the on-demand three-way classification
//  (has-data / empty-by-design / missing) of specific dim-value combinations. Kept
//  OFF the profile bundle so the Constructor never pays for the full Cartesian of
//  the allowed region (ADR-0027) — see routes/cube/actual-region.ts.
//
//  WHY a separate UNGUARDED sibling route (mirrors publicDataSourcesRoutes /
//  bootstrapRoutes): config/* is the JWT-guarded AUTHORING surface; this is the
//  DELIVERY surface the Constructor preview reads — published/active cube state,
//  read-only, minimal projection. Its own scope in index.ts so the config JWT
//  guard never cascades (ISP + least-privilege at the boundary).
//
//  SSOT discipline (the ADR-0026 fitness invariant):
//    - Per-measure unit comes EXCLUSIVELY from stats.measure_unit_resolved (V21),
//      the one place Decision-C's resolution order (measure→dataset→none) is
//      encoded. This route NEVER re-reads classifier.metadata or obs_attribute to
//      derive a unit — doing so would fork the resolution rule. Enforced by
//      cube-profile.fitness.test.ts.
//    - Concept roles come from stats.dimension.concept_role (V18); isTime from the
//      DSD's is_time_dim (per-dataset truth).
//    - Members come from stats.classifier (is_current — the live codelist), the
//      same read classifiers.ts exposes.
//    - The actual region + the allowed-region classification are owned by
//      actual-region.ts (V26 stats.cube_actual_region + dim_key_in_allowed_region).

import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { ok, notFound, parseParams, parseBody, HttpError } from '../../lib/http.js'
import {
  loadActualRegion,
  classifyCombos,
  viewExists,
  type ActualRegion,
} from './actual-region.js'
import { isDatasetDiscoverable } from '../stats/lifecycle.js'

const ProfileParams = z.object({ datasetCode: z.string().min(1) })

// classify body: a non-empty list of dim_key objects (each a {dim: code} map). A
// generous cap keeps a single request bounded (Postel + fail-fast at the edge) —
// the Constructor classifies the combos a view needs, not the whole Cartesian.
const ClassifyBody = z.object({
  combinations: z
    .array(z.record(z.string(), z.string()))
    .min(1, 'combinations must be a non-empty array')
    .max(1000, 'at most 1000 combinations per request'),
})

// ── Wire shapes (the bundle contract the Constructor consumes) ────────────────
type LocaleString = Record<string, string>

/** One member of a dimension's codelist (the live, is_current revision). */
interface ProfileMember {
  code:       string
  label:      LocaleString
  parentCode: string | null
}

/**
 * The Concept a dimension binds to (V27 ConceptScheme). Null when the dimension is
 * unbound (legacy/unclassified). Lets the Constructor group/suggest by concept —
 * two REF_AREA axes (partner/reporter) declare the SAME concept, so the palette can
 * offer a "these are both geographies / swap axis" affordance.
 */
interface ProfileConcept {
  scheme: string
  code:   string
}

/** One cube axis: its DSD placement (isTime), its SDMX concept role, its concept binding, its members. */
interface ProfileDimension {
  code:        string
  conceptRole: string | null
  // V27 — the concept binding (null = unbound). The conceptRole now resolves THROUGH
  // the concept where bound (dimension → concept → role), with the V18
  // dimension.concept_role kept as the read alias during the expand window.
  concept:     ProfileConcept | null
  isTime:      boolean
  members:     ProfileMember[]
}

/** A measure-dimension member with its resolved unit (sourced ONLY from V21). */
interface ProfileMeasure {
  code:  string
  label: LocaleString
  unit:  ResolvedUnit
}

/**
 * The resolved unit for a measure. `source` names the winning tier of V21's
 * resolution (measure-classifier → dataset default → none), so the Constructor
 * can WARN on measures with source='none' (no unit could be resolved).
 */
interface ResolvedUnit {
  unit_code:   string | null
  symbol:      string | null
  label:       LocaleString | null
  unit_type:   string | null
  unit_mult:   number | null
  decimals:    number | null
  base_period: string | null
  source:      'measure' | 'dataset' | 'none'
}

interface CubeProfile {
  datasetCode: string
  dimensions:  ProfileDimension[]
  measures:    ProfileMeasure[]
  /**
   * The realised dim-value combinations (V26). `available:false`/`combinations:null`
   * when stats.cube_actual_region is not yet applied in this database (graceful
   * degradation — Protected Variations: the consumer handles the unavailable case).
   */
  actualRegion: ActualRegion
}

// ── Server-internal row shapes (never leaked verbatim) ────────────────────────
interface DimensionRow {
  dim_code:            string
  concept_role:        string | null
  concept_scheme_code: string | null
  concept_code:        string | null
  is_time_dim:         boolean
  ord:                 number
}
interface MemberRow {
  dim_code:    string
  code:        string
  label:       LocaleString
  parent_code: string | null
}
interface MeasureUnitRow {
  measure_code: string
  label:        LocaleString
  unit_code:    string | null
  unit_symbol:  string | null
  unit_label:   LocaleString | null
  unit_type:    string | null
  unit_mult:    number | null
  decimals:     number | null
  base_period:  string | null
  unit_source:  'measure' | 'dataset' | 'none'
}

export const cubeRoutes: FastifyPluginAsync = async (app) => {
  // GET /:datasetCode/profile — the one atomic introspection read. No auth
  // (delivery surface). 404 fail-fast when the dataset does not exist.
  app.get('/:datasetCode/profile', async (req, reply) => {
    const { datasetCode } = parseParams(ProfileParams, req.params)

    // 1) Fail-fast existence check — a profile for a non-dataset is a 404, not an
    //    empty bundle the Constructor would silently treat as "dataset with no
    //    dims" (Principle of Least Astonishment).
    await assertDatasetExists(app, datasetCode)

    // 2) The three independent reads (DSD+roles, members, measures+units) have no
    //    data dependency on each other → run concurrently (one round-trip latency,
    //    not three).
    const [dimsRes, membersRes, measuresRes] = await Promise.all([
      // DSD axes for this dataset, each carrying its concept role + concept binding
      // (V27) and the per-dataset time flag (the DSD truth for isTime). Ordered by
      // the DSD ord. The role is resolved THROUGH the bound concept (V27 SSOT) where
      // a binding exists, else through the V18 dimension.concept_role read alias
      // (COALESCE = the expand-window resolution: concept wins, alias backs it). The
      // binding (concept_scheme_code, concept_code) is exposed so the Constructor can
      // group/suggest by concept (two REF_AREA axes → "both geographies").
      app.pg.query<DimensionRow>(
        `SELECT dd.dim_code,
                COALESCE(c.concept_role, d.concept_role) AS concept_role,
                d.concept_scheme_code,
                d.concept_code,
                dd.is_time_dim,
                dd.ord
           FROM stats.dataset_dimension dd
           JOIN stats.dimension d ON d.code = dd.dim_code
           LEFT JOIN stats.concept c
             ON c.scheme_code = d.concept_scheme_code
            AND c.code        = d.concept_code
          WHERE dd.dataset_code = $1
          ORDER BY dd.ord, dd.dim_code`,
        [datasetCode],
      ),
      // Live members of every dimension this dataset uses. is_current = true scopes
      // to the live codelist (V18 SCD-2 keeps retired revisions) — the SAME filter
      // classifiers.ts applies. parent_code is the stable hierarchy edge (ADR-0023).
      // Restricted to the dataset's dims via the DSD so we never ship members of an
      // unrelated dimension (least-privilege projection).
      app.pg.query<MemberRow>(
        `SELECT c.dim_code, c.code, c.label, c.parent_code
           FROM stats.classifier c
          WHERE c.is_current = true
            AND c.dim_code IN (
              SELECT dim_code FROM stats.dataset_dimension WHERE dataset_code = $1
            )
          ORDER BY c.dim_code, c.ord, c.code`,
        [datasetCode],
      ),
      // Measures for this dataset, each with its resolved unit — sourced ONLY from
      // stats.measure_unit_resolved (V21). This is the SSOT for the unit-resolution
      // rule; this route MUST NOT re-derive a unit from classifier.metadata or
      // obs_attribute (the ADR-0026 fitness invariant). The view is already grained
      // one row per (dataset_code, measure_code).
      app.pg.query<MeasureUnitRow>(
        `SELECT mur.measure_code,
                c.label,
                mur.unit_code,
                mur.unit_symbol,
                mur.unit_label,
                mur.unit_type,
                mur.unit_mult,
                mur.decimals,
                mur.base_period,
                mur.unit_source
           FROM stats.measure_unit_resolved mur
           JOIN stats.classifier c
             ON c.dim_code = 'measure'
            AND c.code = mur.measure_code
            AND c.is_current = true
          WHERE mur.dataset_code = $1
          ORDER BY c.ord, mur.measure_code`,
        [datasetCode],
      ),
    ])

    // 3) Group members under their dimension (single pass; rows already ordered).
    const membersByDim = new Map<string, ProfileMember[]>()
    for (const r of membersRes.rows) {
      let bucket = membersByDim.get(r.dim_code)
      if (!bucket) {
        bucket = []
        membersByDim.set(r.dim_code, bucket)
      }
      bucket.push({ code: r.code, label: r.label, parentCode: r.parent_code })
    }

    const dimensions: ProfileDimension[] = dimsRes.rows.map((d) => ({
      code:        d.dim_code,
      conceptRole: d.concept_role,
      // V27 — the concept binding, present only when the dimension declares one.
      concept:
        d.concept_scheme_code !== null && d.concept_code !== null
          ? { scheme: d.concept_scheme_code, code: d.concept_code }
          : null,
      isTime:      d.is_time_dim,
      members:     membersByDim.get(d.dim_code) ?? [],
    }))

    const measures: ProfileMeasure[] = measuresRes.rows.map((m) => ({
      code:  m.measure_code,
      label: m.label,
      unit: {
        unit_code:   m.unit_code,
        symbol:      m.unit_symbol,
        label:       m.unit_label,
        unit_type:   m.unit_type,
        unit_mult:   m.unit_mult,
        decimals:    m.decimals,
        base_period: m.base_period,
        source:      m.unit_source,
      },
    }))

    // 4) The actual-region read (V26 stats.cube_actual_region). Guarded so a missing
    //    view degrades to available:false instead of 500ing the whole profile.
    const actualRegion = await loadActualRegion(app, datasetCode)

    const profile: CubeProfile = { datasetCode, dimensions, measures, actualRegion }

    // Constructor-preview read, not a hot delivery path → revalidate-friendly but
    // no ETag probe (the profile is cheap relative to a separate MAX(updated_at)
    // round-trip; add a weak ETag here only if profiling shows this read is hot).
    reply.header('Cache-Control', 'no-cache')
    return ok(profile)
  })

  // POST /:datasetCode/classify — three-way classification of specific combos.
  // No auth (delivery surface, same as the profile read). The body carries the
  // combos to classify; classification is computed by the V26 SSOT helper.
  app.post('/:datasetCode/classify', async (req) => {
    const { datasetCode } = parseParams(ProfileParams, req.params)
    const { combinations } = parseBody(ClassifyBody, req.body)

    // Fail-fast existence — classifying combos of a non-dataset is a 404, the same
    // contract as the profile read (Principle of Least Astonishment).
    await assertDatasetExists(app, datasetCode)

    // The classification depends on V26 being applied here. If the view is absent,
    // the capability is genuinely unavailable in THIS database — a 409 (not a 404:
    // the dataset exists; the SERVER state cannot yet answer), RFC 9457-style, so
    // the caller can distinguish "V26 not deployed" from "dataset not found".
    if (!(await viewExists(app))) {
      throw new HttpError(409, 'Combination classification requires migration V26 (stats.cube_actual_region), not applied on this server')
    }

    const classified = await classifyCombos(app, datasetCode, combinations)
    return ok({ datasetCode, classified })
  })
}

// 404 fail-fast shared by both routes — one definition of "this dataset is
// DISCOVERABLE". The cube-profile / classify routes are the Constructor's DISCOVERY
// surface, so they go through the V28 published-only projection (isDatasetDiscoverable):
// a draft/superseded dataset is absent from discovery and 404s here exactly as a
// non-existent one does (Principle of Least Astonishment — the Constructor only sees
// what is published). A superseded dataset's DATA stays readable via the observations
// permalink/asOf path (auditability), which is a different surface. Pre-V28 (view
// absent) this degrades to plain existence — nothing is hidden during a rollout.
async function assertDatasetExists(
  app: Parameters<FastifyPluginAsync>[0],
  datasetCode: string,
): Promise<void> {
  if (!(await isDatasetDiscoverable(app, datasetCode))) throw notFound('Dataset')
}
