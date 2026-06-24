import type { FastifyPluginAsync } from 'fastify'
import type { ReferenceMetadataContract } from '@statdash/contracts'
import { z } from 'zod'
import { ok, notFound, parseParams } from '../../lib/http.js'
import { isDatasetDiscoverable } from './lifecycle.js'

const CodeParams = z.object({ code: z.string().min(1) })

// ── Reference-metadata serve shapes (V31, ADR SDMX-P1-D) ──────────────────────
//
//  The current SCD-2 report row as it leaves the DB. LocaleString columns are JSONB
//  (Record<string,string>); the optional content fields are projected to the wire
//  ReferenceMetadataContract only when non-empty (an omitted '{}' field becomes an
//  ABSENT key, not an empty object — Postel: the consumer reads "field absent", and
//  the engine ProvenanceRecord leaves the corresponding badge slot empty).
type LocaleString = Record<string, string>
interface ReferenceMetadataRow {
  metadataflow_code: string
  methodology:       LocaleString
  source:            LocaleString
  coverage:          LocaleString
  quality:           LocaleString
  note:              LocaleString
  last_updated:      string | null   // pg returns DATE as 'YYYY-MM-DD'
  contact_name:      string | null
  contact_email:     string | null
  methodology_url:   string | null
  revision:          number
  valid_from:        string          // ISO timestamp
}

/** True when a LocaleString JSONB carries at least one locale entry (vs an omitted '{}'). */
const hasLocale = (v: LocaleString | null | undefined): v is LocaleString =>
  v != null && Object.keys(v).length > 0

// to_regclass returns NULL (without raising) for an absent relation — the same clean
// precondition probe lifecycle.ts / actual-region.ts use. One definition of "is V31
// applied here", so a rolling-migration deploy degrades gracefully (404, not 500).
async function referenceMetadataTableExists(
  app: Parameters<FastifyPluginAsync>[0],
): Promise<boolean> {
  const { rows } = await app.pg.query<{ exists: boolean }>(
    `SELECT to_regclass('stats.reference_metadata') IS NOT NULL AS exists`,
  )
  return rows[0]?.exists === true
}

export const datasetsRoutes: FastifyPluginAsync = async (app) => {
  // GET / — datasets with their DSD (dimension structure) aggregated inline.
  app.get('/', async () => {
    const { rows } = await app.pg.query(
      `SELECT d.code, d.label, d.frequency, d.source, d.metadata,
              COALESCE(
                json_agg(
                  json_build_object(
                    'dim_code', dd.dim_code,
                    'is_time_dim', dd.is_time_dim,
                    'ord', dd.ord
                  ) ORDER BY dd.ord
                ) FILTER (WHERE dd.dim_code IS NOT NULL),
                '[]'
              ) AS dimensions
         FROM stats.dataset d
         LEFT JOIN stats.dataset_dimension dd ON dd.dataset_code = d.code
        GROUP BY d.code, d.label, d.frequency, d.source, d.metadata
        ORDER BY d.code`,
    )
    return ok(rows)
  })

  // GET /:code — one dataset + its DSD (dataset_dimension rows) + its cube
  // version. GAP 5c: include the stats.dataset_version (V6) so a client knows
  // the dataset's current revision in the SAME call it reads the structure —
  // and so the response can carry the matching ETag (see below). LEFT JOIN so a
  // dataset with no version row yet still returns (version → null).
  app.get('/:code', async (req, reply) => {
    const { code } = parseParams(CodeParams, req.params)
    // P2-3: `preliminary` is a dataset-level provenance flag (IMF/Eurostat data
    // integrity standard) — true ⟺ the dataset has ANY observation flagged
    // preliminary (SDMX OBS_STATUS = 'P'). Computed as a correlated EXISTS so it
    // short-circuits on the first match (index scan on (dataset_code, obs_status))
    // rather than aggregating the whole hypertable. It feeds the engine's
    // MetadataPort so the "preliminary data" badge can render dataset-wide.
    const { rows } = await app.pg.query<{
      code: string; version: string | null; preliminary: boolean
    }>(
      `SELECT d.code, d.label, d.frequency, d.source, d.metadata,
              dv.version,
              EXISTS(
                SELECT 1 FROM stats.observation o
                 WHERE o.dataset_code = d.code AND o.obs_status = 'P'
              ) AS preliminary,
              COALESCE(
                json_agg(
                  json_build_object(
                    'dim_code', dd.dim_code,
                    'is_time_dim', dd.is_time_dim,
                    'ord', dd.ord
                  ) ORDER BY dd.ord
                ) FILTER (WHERE dd.dim_code IS NOT NULL),
                '[]'
              ) AS dimensions
         FROM stats.dataset d
         LEFT JOIN stats.dataset_dimension dd ON dd.dataset_code = d.code
         LEFT JOIN stats.dataset_version    dv ON dv.dataset_code = d.code
        WHERE d.code = $1
        GROUP BY d.code, d.label, d.frequency, d.source, d.metadata, dv.version`,
      [code],
    )
    if (!rows[0]) throw notFound('Dataset')
    // GAP 5a — same weak ETag scheme as the observation route, so a dataset's
    // metadata read is cache-revalidatable against the very version it reports.
    if (rows[0].version !== null) {
      reply.header('ETag', `W/"${rows[0].code}.${rows[0].version}"`)
      reply.header('Cache-Control', 'no-cache')
    }
    return ok(rows[0])
  })

  // GET /:code/metadata — the dataset's STRUCTURED reference metadata (V31, SDMX
  // ESMS-lite). The SSOT that backs the Law-9 methodology/source/last-updated/quality
  // badges (ONS/IMF/Eurostat): the runner reads this once at store-build time and
  // folds it into the engine MetadataPort (provenance.ts), so the badges render from
  // structured metadata instead of ad-hoc strings. Read-only (provisioning/write reuse
  // the existing ingest/provisioning pattern — the SCD-2 revise path is a seed/curator
  // concern, not a public write surface here).
  //
  // Placement: a SUB-RESOURCE of the dataset (/:code/metadata), folded into the dataset
  // surface where the descriptor + provenance flags already live — one canonical home
  // for "everything about this dataset", not a parallel route plugin.
  app.get('/:code/metadata', async (req, reply) => {
    const { code } = parseParams(CodeParams, req.params)

    // 1) DISCOVERY gate — reference metadata is delivery-surface content, so it goes
    //    through the SAME V28 published-only projection as the cube-profile/catalog
    //    discovery surfaces (a draft/superseded dataset is absent from discovery and
    //    404s here exactly as a non-existent one does — Principle of Least Astonishment;
    //    the Constructor/runner only see published datasets). Pre-V28 this degrades to
    //    plain existence (nothing hidden during a rollout).
    if (!(await isDatasetDiscoverable(app, code))) throw notFound('Dataset')

    // 2) GRACEFUL DEGRADATION (rolling-migration window) — if V31 is not applied on
    //    this server the capability is genuinely absent: 404 the report (the dataset
    //    exists but has no metadata report here), never 500. Mirrors actual-region.ts
    //    / lifecycle.ts viewExists posture.
    if (!(await referenceMetadataTableExists(app))) throw notFound('Reference metadata')

    // 3) The current SCD-2 report for this dataset (is_current — exactly one, by
    //    uq_reference_metadata_current_dataset). target_type='dataset' scopes to the
    //    dataset-grained report (the dimension/classifier targets are a future door).
    const { rows } = await app.pg.query<ReferenceMetadataRow>(
      `SELECT metadataflow_code,
              methodology, source, coverage, quality, note,
              to_char(last_updated, 'YYYY-MM-DD') AS last_updated,
              contact_name, contact_email, methodology_url,
              revision,
              to_char(valid_from, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS valid_from
         FROM stats.reference_metadata
        WHERE dataset_code = $1 AND target_type = 'dataset' AND is_current
        LIMIT 1`,
      [code],
    )
    const row = rows[0]
    if (!row) throw notFound('Reference metadata')

    // 4) Project to the wire contract. Optional content fields are EMITTED only when
    //    they carry at least one locale (an omitted '{}' becomes an absent key, not an
    //    empty object — the runner's ProvenanceRecord adapter then leaves that badge
    //    slot empty). Non-locale provenance fields are emitted only when non-null.
    const body: ReferenceMetadataContract = {
      datasetCode:  code,
      metadataflow: row.metadataflow_code,
      ...(hasLocale(row.methodology) ? { methodology: row.methodology } : {}),
      ...(hasLocale(row.source)      ? { source:      row.source      } : {}),
      ...(hasLocale(row.coverage)    ? { coverage:    row.coverage    } : {}),
      ...(hasLocale(row.quality)     ? { quality:     row.quality     } : {}),
      ...(hasLocale(row.note)        ? { note:        row.note        } : {}),
      ...(row.last_updated    != null ? { lastUpdated:    row.last_updated    } : {}),
      ...(row.contact_name    != null ? { contactName:    row.contact_name    } : {}),
      ...(row.contact_email   != null ? { contactEmail:   row.contact_email   } : {}),
      ...(row.methodology_url != null ? { methodologyUrl: row.methodology_url } : {}),
      revision:  row.revision,
      validFrom: row.valid_from,
    }

    // Constructor/runner read, not a hot delivery path → revalidate-friendly. A weak
    // ETag off (revision, valid_from) lets the client skip re-hydrating an unchanged
    // report (the report revises rarely; the vintage IS its validator).
    reply.header('ETag', `W/"${code}.rm.${row.revision}"`)
    reply.header('Cache-Control', 'no-cache')
    return ok(body)
  })
}
