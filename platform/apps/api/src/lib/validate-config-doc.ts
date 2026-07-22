// ── validate-config-doc — the ONE referential-validation seam for config PUTs ──
//
//  ADR-052 §4. The validated-PUT gate for the un-versioned config documents
//  (`data_spec`, `data_source`). It runs BEFORE the revision append + current-row
//  UPDATE, inside the PUT's txn guard prologue — the way `guardConfig` centralizes
//  page-shape validation, so the two routes cannot drift. A failing document is
//  REJECTED at the boundary with the RFC 9457 `config-invalid` 422 (well-formed
//  JSON, invalid SEMANTICS) carrying a machine-readable `violations[]`; a clean
//  document proceeds to the write. NEVER a silent 200 storing corruption.
//
//  ── WHERE THE REFERENCES ACTUALLY LIVE (the MUST-VERIFY verdict, codified) ──
//  The blessed four checks assume a document exposes its `datasetCode`, its source
//  dims, and its metric refs. In THIS codebase those live in DIFFERENT places, and
//  the authoritative seam for each is a DIRECT config field or a spec-discriminant
//  position — NOT the engine `extractDeps` (which is a RENDER-dependency extractor:
//  its `dims` set is a SUPERSET including TIME_DIM, the ambient coordinate, and
//  `$ctx`-referenced filter dims — the wrong set for a ⊆-DSD check, it would
//  false-positive). Verified per kind (source-descriptor.ts + spec-catalog.ts):
//
//    • datasetCode  — a DIRECT field of a `data_source` config JSONB
//                     (`config.datasetCode`, the 'stats'/rest kind). A `data_spec`
//                     has NO datasetCode of its own; it reaches one only through its
//                     bound `source_id`. So dataset-exists is checked on the source's
//                     `config.datasetCode` (directly for a data_source PUT;
//                     transitively via `source_id` for a data_spec PUT).
//    • source dims  — a DIRECT field of a `data_source` config JSONB
//                     (`config.nonTimeDims`). This is the AUTHORITATIVE declared-dims
//                     list (not a render-dep superset), so `nonTimeDims ⊆ DSD` is
//                     clean + decisive. A data_spec inherits this guarantee through
//                     its bound source (its own render-dep dims are NOT used — see
//                     SURFACED).
//    • head/source codes — EVERY code-bearing head/source position of a spec lives
//                     in ONE shared namespace (`MetricRef`: governed metric id OR raw
//                     cube code — the engine's `resolveMeasureRef` seam resolves both
//                     through one path). The honest check is therefore NOT "is it
//                     governed" but "does it RESOLVE anywhere": the governed catalog
//                     (`config.site_config` 'metrics', ids ∪ codes) OR the live
//                     measure codelist (`stats.classifier`, dim_code = KEY_MEASURE,
//                     is_current — the SAME relation the cube-profile route serves
//                     the Constructor as browsable measures; never a hardcoded list).
//                     Unresolvable in BOTH → `code-resolves`. (The former catalog-only
//                     `metric-resolves` let a NONSENSE raw-looking code through
//                     silently under Postel — live-proven fake-zero corruption,
//                     J-LIFECYCLE walk 2026-07-22. Enumerated positions: see
//                     `codeRefPositions`.)
//
//  Graceful degradation (rolling migration, M-5): every stats-relation probe gates on
//  `relationExists` first — an api build running against a DB that has not yet applied
//  V4/V7 DSD relations SKIPS the affected check (records nothing) instead of 500ing.
//
//  Depends only on a narrow query port (Dependency Inversion) — `app.pg`, a pooled
//  client, or a test fake all satisfy it; never on @fastify/postgres concretes.

import type { ConfigViolation } from '@statdash/contracts'
import { relationExists, type RelationProbe } from './relation-exists.js'
import { KEY_MEASURE } from './cube-keys.js'

/** Minimal query capability the validator needs — satisfied by app.pg / a client / a fake. */
export type ConfigDocProbe = RelationProbe

/** The document families this validator gates (the un-versioned kinds, ADR-052 §4). */
export type ValidatedDocKind = 'data_spec' | 'data_source'

/** A `data_source` document body (the full snapshot a PUT sets). */
interface DataSourceBody {
  config?: unknown
}
/** A `data_spec` document body (the full snapshot a PUT sets). */
interface DataSpecBody {
  spec?:      unknown
  source_id?: unknown
}

// ── The DataSpec discriminant floor (the enumerable shape check) ───────────────
//  There is no pure standalone-DataSpec structural validator (SPEC_CATALOG is
//  authoring metadata, not a Zod validator; the engine's `validateConfig` validates
//  a PAGE node-tree, not a lone spec). The enumerable shape floor for a stored spec
//  is therefore: an object whose `type` is a known DataSpec discriminant. Deeper
//  per-kind required-field validation is NOT available as a pure pre-store gate —
//  SURFACED (a spec's per-kind shape is enforced at interpret time by the renderer).
const DATASPEC_TYPES = new Set([
  'query', 'row-list', 'timeseries', 'growth', 'ratio-list',
  'pivot', 'transform', 'metric', 'pipeline',
])

function isObj(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

// ── Referential probes (each rolling-migration-safe) ───────────────────────────

/** True iff `code` is a registered dataset. Degrades to `true` (skip) when stats.dataset is absent. */
async function datasetExists(db: ConfigDocProbe, code: string): Promise<boolean | 'skipped'> {
  if (!(await relationExists(db, 'stats.dataset'))) return 'skipped'
  const { rows } = await db.query<{ one: number }>(
    `SELECT 1 AS one FROM stats.dataset WHERE code = $1`, [code],
  )
  return rows.length > 0
}

/** The DSD dim codes of a dataset. Returns 'skipped' when stats.dataset_dimension is absent. */
async function dsdDims(db: ConfigDocProbe, code: string): Promise<string[] | 'skipped'> {
  if (!(await relationExists(db, 'stats.dataset_dimension'))) return 'skipped'
  const { rows } = await db.query<{ dim_code: string }>(
    `SELECT dim_code FROM stats.dataset_dimension WHERE dataset_code = $1`, [code],
  )
  return rows.map((r) => r.dim_code)
}

/**
 * The governed-metric reference set (ids ∪ codes) from `config.site_config` 'metrics'.
 * Returns 'skipped' when no metrics catalog is provisioned (degrade — a metric ref
 * cannot be judged dangling with no catalog to judge against).
 */
async function metricCatalogRefs(db: ConfigDocProbe): Promise<Set<string> | 'skipped'> {
  const { rows } = await db.query<{ value: unknown }>(
    `SELECT value FROM config.site_config WHERE key = 'metrics'`,
  )
  const value = rows[0]?.value
  if (!Array.isArray(value)) return 'skipped'
  const refs = new Set<string>()
  for (const m of value) {
    if (isObj(m)) {
      if (typeof m['id'] === 'string')   refs.add(m['id'])
      if (typeof m['code'] === 'string') refs.add(m['code'])
    }
  }
  return refs
}

/**
 * The LIVE measure codelist — the authoritative raw-code registry (`stats.classifier`,
 * dim_code = KEY_MEASURE, is_current = true). This is EXACTLY the relation the
 * cube-profile route (`routes/cube/index.ts`) serves the Constructor as the browsable
 * measure palette, and the codelist the ingest SCD-2 writers maintain — the one
 * stats-side home of "is this a real measure code". Returns 'skipped' when the
 * relation is absent (rolling migration) OR the codelist is EMPTY (no cube ingested
 * yet — with nothing to judge against, a raw code cannot be judged dangling; the
 * same degradation rule as `metricCatalogRefs`).
 */
async function measureCodelist(db: ConfigDocProbe): Promise<Set<string> | 'skipped'> {
  if (!(await relationExists(db, 'stats.classifier'))) return 'skipped'
  const { rows } = await db.query<{ code: string }>(
    `SELECT code FROM stats.classifier WHERE dim_code = $1 AND is_current = true`,
    [KEY_MEASURE],
  )
  if (rows.length === 0) return 'skipped'
  return new Set(rows.map((r) => r.code))
}

/** The `config` JSONB of a `data_source` by id, or undefined when the source is absent. */
async function loadSourceConfig(db: ConfigDocProbe, sourceId: string): Promise<Record<string, unknown> | undefined> {
  const { rows } = await db.query<{ config: unknown }>(
    `SELECT config FROM config.data_source WHERE id = $1`, [sourceId],
  )
  const cfg = rows[0]?.config
  return isObj(cfg) ? cfg : rows.length > 0 ? {} : undefined
}

// ── The data-binding checks (dataset-exists + dims-subset), shared ─────────────
//
//  Both a `data_source` (its own config) and a `data_spec` (its bound source's
//  config) run these against a source `config` JSONB. `pathPrefix` locates the
//  offending field in the DOCUMENT being PUT (`/config/...` for a source PUT,
//  `/source/config/...` for a spec-via-source PUT — the panel surfaces it at the
//  right control).
async function checkDataBinding(
  db:         ConfigDocProbe,
  config:     Record<string, unknown>,
  pathPrefix: string,
  out:        ConfigViolation[],
): Promise<void> {
  const datasetCode = config['datasetCode']
  // A source with no datasetCode (a 'static' / inline kind) has no dataset to bind —
  // nothing to validate (honest: emptiness / kind-without-a-dataset is not invalid).
  if (typeof datasetCode !== 'string' || datasetCode.length === 0) return

  const exists = await datasetExists(db, datasetCode)
  if (exists === false) {
    out.push({
      check:  'dataset-exists',
      path:   `${pathPrefix}/datasetCode`,
      ref:    datasetCode,
      detail: `no such dataset '${datasetCode}' in stats.dataset`,
    })
    // Dangling datasetCode ⇒ its DSD cannot be loaded; the dims-subset check is
    // moot (skip it — reporting "dim not in the DSD of a nonexistent dataset" is noise).
    return
  }
  if (exists === 'skipped') return // rolling-migration: stats.dataset not yet applied.

  // dims-subset — the source's DECLARED dims (nonTimeDims, the authoritative list)
  // must be a subset of the referenced dataset's DSD dims. This is the exact check
  // the datasetCode-flip incident needed (a flip left declared dims that the new
  // dataset's DSD does not carry).
  const declared = config['nonTimeDims']
  if (!Array.isArray(declared)) return
  const dsd = await dsdDims(db, datasetCode)
  if (dsd === 'skipped') return
  const dsdSet = new Set(dsd)
  for (const dim of declared) {
    if (typeof dim === 'string' && !dsdSet.has(dim)) {
      out.push({
        check:  'dims-subset',
        path:   `${pathPrefix}/nonTimeDims`,
        ref:    dim,
        detail: `dim '${dim}' is not in the DSD of dataset '${datasetCode}'`,
      })
    }
  }
}

// ── Shared-namespace code positions (the code-resolves check) ──────────────────

/** One code-bearing head/source position: where it sits in the PUT body + the code. */
interface CodeRefPosition {
  path: string
  ref:  string
}

/**
 * Collect a `string | string[]` code field into positions. Non-string entries
 * (a `{ $ctx }` ref, a malformed blob) are IGNORED, not flagged — a ctx-bound
 * value is resolved at render time and cannot be judged here (honest skip).
 */
function pushCodes(out: CodeRefPosition[], v: unknown, path: string): void {
  if (typeof v === 'string' && v.length > 0) {
    out.push({ path, ref: v })
  } else if (Array.isArray(v)) {
    v.forEach((c, i) => {
      if (typeof c === 'string' && c.length > 0) out.push({ path: `${path}/${i}`, ref: c })
    })
  }
}

/**
 * EVERY code-bearing head/source position of a stored spec — the explicit
 * enumeration the code-resolves check covers (each is a `MetricRef` position:
 * governed metric id OR raw cube code, one namespace, resolved by the engine
 * through the ONE `resolveMeasureRef` seam):
 *
 *   • `metric`      — `metrics[]`                       → /spec/metrics/<i>
 *   • `pipeline`    — governed head `pipe[0].metrics[]` → /spec/pipe/0/metrics/<i>
 *                     steward  head `pipe[0].query.measure` (string | string[])
 *                                                       → /spec/pipe/0/query/measure(/<i>)
 *                     value-cell head `pipe[0].code` (with `over`; ADR-046 Add.4)
 *                                                       → /spec/pipe/0/code
 *                     inline head `pipe[0].rows` — literal DATA, no store read:
 *                     nothing to resolve (honest skip, not silent).
 *   • `query`       — `query.measure` (string | string[]) → /spec/query/measure(/<i>)
 *   • `timeseries`  — `code`                             → /spec/code
 *   • `growth`      — `code` (string | string[])         → /spec/code(/<i>)
 *   • `ratio-list`  — `pairs[i].code` + `pairs[i].denom` → /spec/pairs/<i>/code|denom
 *   • `row-list`    — `rows[i].code` + `rows[i].pctOf`   → /spec/rows/<i>/code|pctOf
 *
 * DELIBERATELY not judged (named, per the honesty rule):
 *   • `pivot.rows` / `transform.source` — inline literal data rows, not store refs;
 *     there is no registry a literal cell resolves against.
 *   • dim-MEMBER values (`where`/`at`/ObsQuery `filter` values) — members of
 *     arbitrary dims, may be `{ $ctx }` refs; judging them needs the dim→codelist
 *     pairing + ctx semantics (a coherent follow-up, not this check).
 *
 * Structural reads over an opaque record (resilient to a malformed stored blob —
 * a malformed field yields no positions, never a throw).
 */
function codeRefPositions(spec: Record<string, unknown>): CodeRefPosition[] {
  const out: CodeRefPosition[] = []
  switch (spec['type']) {
    case 'metric':
      pushCodes(out, spec['metrics'], '/spec/metrics')
      break
    case 'pipeline': {
      const head = Array.isArray(spec['pipe']) ? (spec['pipe'] as unknown[])[0] : undefined
      if (isObj(head) && head['op'] === 'source') {
        pushCodes(out, head['metrics'], '/spec/pipe/0/metrics')
        if (isObj(head['query'])) {
          pushCodes(out, (head['query'] as Record<string, unknown>)['measure'], '/spec/pipe/0/query/measure')
        }
        if (typeof head['over'] === 'string') pushCodes(out, head['code'], '/spec/pipe/0/code')
      }
      break
    }
    case 'query':
      if (isObj(spec['query'])) {
        pushCodes(out, (spec['query'] as Record<string, unknown>)['measure'], '/spec/query/measure')
      }
      break
    case 'timeseries':
    case 'growth':
      pushCodes(out, spec['code'], '/spec/code')
      break
    case 'ratio-list':
      if (Array.isArray(spec['pairs'])) {
        (spec['pairs'] as unknown[]).forEach((p, i) => {
          if (isObj(p)) {
            pushCodes(out, p['code'],  `/spec/pairs/${i}/code`)
            pushCodes(out, p['denom'], `/spec/pairs/${i}/denom`)
          }
        })
      }
      break
    case 'row-list':
      if (Array.isArray(spec['rows'])) {
        (spec['rows'] as unknown[]).forEach((r, i) => {
          if (isObj(r)) {
            pushCodes(out, r['code'],  `/spec/rows/${i}/code`)
            pushCodes(out, r['pctOf'], `/spec/rows/${i}/pctOf`)
          }
        })
      }
      break
    // 'pivot' / 'transform' — inline-data kinds, no store-code positions (see above).
  }
  return out
}

// ── The public seam ────────────────────────────────────────────────────────────

/**
 * Validate a config document about to be PUT. Returns the (possibly empty) list of
 * referential violations — the route throws `configInvalid(violations)` (422) when
 * non-empty, and proceeds to the revision append + row UPDATE when empty. Pure w.r.t.
 * the DB (read-only probes); never mutates, never throws on a malformed blob (a
 * malformed spec surfaces as a `shape` violation, not a 500).
 *
 * @param docKind  which un-versioned kind is being written.
 * @param body     the FULL resulting document snapshot (supplied fields merged over
 *                 the current row) — we validate what we are about to store.
 * @param db       the narrow query port (app.pg / an in-txn client / a fake).
 */
export async function validateConfigDoc(
  docKind: ValidatedDocKind,
  body:    unknown,
  db:      ConfigDocProbe,
): Promise<ConfigViolation[]> {
  const out: ConfigViolation[] = []
  if (!isObj(body)) {
    return [{ check: 'shape', path: '/', detail: 'document body is not an object' }]
  }

  if (docKind === 'data_source') {
    const cfg = (body as DataSourceBody).config
    if (isObj(cfg)) await checkDataBinding(db, cfg, '/config', out)
    return out
  }

  // docKind === 'data_spec'
  const { spec, source_id } = body as DataSpecBody

  // 1 · shape — the spec is an object with a known DataSpec discriminant.
  if (!isObj(spec) || typeof spec['type'] !== 'string' || !DATASPEC_TYPES.has(spec['type'])) {
    out.push({
      check:  'shape',
      path:   '/spec/type',
      ref:    isObj(spec) && typeof spec['type'] === 'string' ? spec['type'] : undefined,
      detail: 'spec.type is not a known DataSpec discriminant',
    })
    // Shape-invalid ⇒ the ref-extraction checks below are meaningless — return the
    // shape violation alone (mirrors the engine's fail-fast on an unknown spec type).
    return out
  }

  // 2 · code-resolves — every head/source code resolves SOMEWHERE in the shared
  // namespace: the governed metrics catalog OR the live measure codelist. A code is
  // flagged ONLY when BOTH registries are judgeable and NEITHER resolves it — if
  // either side is 'skipped' (rolling migration / nothing provisioned yet), non-
  // resolution cannot be proven and the check honestly stands down (recorded here,
  // never a silent partial verdict that false-positives a half-provisioned DB).
  const positions = codeRefPositions(spec)
  if (positions.length > 0) {
    const catalog  = await metricCatalogRefs(db)
    const codelist = await measureCodelist(db)
    if (catalog !== 'skipped' && codelist !== 'skipped') {
      for (const { path, ref } of positions) {
        if (!catalog.has(ref) && !codelist.has(ref)) {
          out.push({
            check:  'code-resolves',
            path,
            ref,
            detail: `'${ref}' resolves neither as a governed metric (site metrics catalog) ` +
                    `nor as a live measure code (stats.classifier)`,
          })
        }
      }
    }
  }

  // 3 · dataset-exists + dims-subset (transitive via the bound source). A spec reaches
  // a datasetCode + declared dims only through its `source_id`; validate the binding
  // is coherent (real dataset, dims ⊆ DSD). A source-less spec (inline pivot/transform,
  // no data binding) has nothing to check here — honest no-op.
  if (typeof source_id === 'string' && source_id.length > 0) {
    const srcCfg = await loadSourceConfig(db, source_id)
    if (srcCfg) await checkDataBinding(db, srcCfg, '/source/config', out)
  }

  return out
}
