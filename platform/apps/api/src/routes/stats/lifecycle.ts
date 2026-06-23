// ── lifecycle — the V28 published-only projection SEAM (ADR SDMX-P1-B) ────────
//
//  The ONE api-side home for the dataset-lifecycle delivery rule. The DB SSOT is
//  the view stats.dataset_published (V28: status IN ('published','deprecated')).
//  bootstrap, cube-profile and the public observations route ALL go through THIS
//  helper so the published-only projection has a single definition on the api side
//  too (Protected Variations) — never three hand-rolled status WHERE clauses that
//  could drift from the view (or from each other).
//
//  GRACEFUL DEGRADATION (rolling-migration window) — mirrors actual-region.ts's
//  viewExists posture: a deployment may run this api against a database that has
//  NOT yet applied V28. When stats.dataset_published is absent the seam stays OPEN
//  (every existing dataset is treated as discoverable — exactly pre-V28 behaviour),
//  so the lifecycle filter never breaks delivery during a rollout. Once V28 lands
//  the projection takes effect with no api change.
//
//  WHY a helper, not a literal join everywhere — the lifecycle vocabulary (which
//  statuses are "delivery-visible") lives in ONE place. If a status is added or the
//  visible set changes, the view changes and this probe still holds; the three
//  call sites are untouched (OCP).

import type { FastifyPluginAsync } from 'fastify'

type App = Parameters<FastifyPluginAsync>[0]

// to_regclass returns NULL for an absent relation WITHOUT raising — the same clean
// precondition probe actual-region.ts uses for the V26 view. One definition of "is
// V28 applied here".
export async function datasetPublishedViewExists(app: App): Promise<boolean> {
  const { rows } = await app.pg.query<{ exists: boolean }>(
    `SELECT to_regclass('stats.dataset_published') IS NOT NULL AS exists`,
  )
  return rows[0]?.exists === true
}

/**
 * Is this dataset DISCOVERABLE on the delivery surfaces (published or deprecated)?
 *
 *  - V28 applied  → true iff the dataset is in stats.dataset_published.
 *  - V28 absent   → true iff the dataset merely EXISTS (pre-V28 behaviour; the
 *                   lifecycle filter is not yet deployed, so nothing is hidden).
 *
 *  This gates DISCOVERY (profile, classify, catalog). It does NOT gate a direct
 *  permalink/asOf observation read — a superseded dataset stays readable by
 *  permalink for auditability (the observations route keeps its hot scan; it only
 *  consults the projection to decide whether the dataset is *listed*, never to
 *  delete a permalinked read).
 */
export async function isDatasetDiscoverable(app: App, datasetCode: string): Promise<boolean> {
  if (await datasetPublishedViewExists(app)) {
    const { rows } = await app.pg.query<{ code: string }>(
      `SELECT code FROM stats.dataset_published WHERE code = $1`,
      [datasetCode],
    )
    return rows.length > 0
  }
  // Pre-V28: fall back to plain existence (the projection is not deployed here).
  const { rows } = await app.pg.query<{ code: string }>(
    `SELECT code FROM stats.dataset WHERE code = $1`,
    [datasetCode],
  )
  return rows.length > 0
}

/**
 * The relation a delivery read should SELECT datasets from: the published-only view
 * when V28 is applied, else the base table (pre-V28). Returned as a bare relation
 * name safe to interpolate into a query (it is one of two server constants, never
 * user input — no injection surface). Callers that list datasets join this instead
 * of stats.dataset so the published-only filter is applied uniformly.
 */
export async function publishedDatasetRelation(app: App): Promise<string> {
  return (await datasetPublishedViewExists(app))
    ? 'stats.dataset_published'
    : 'stats.dataset'
}
