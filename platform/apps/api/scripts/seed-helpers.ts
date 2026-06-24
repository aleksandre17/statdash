// ════════════════════════════════════════════════════════════════════════
// seed-helpers.ts — cube write helpers for the seed ETL (one concern)
// ════════════════════════════════════════════════════════════════════════
// Idempotent upserts onto the stats.* cube, shared by every bundle loader in
// seed.ts. Extracted so seed.ts stays a thin orchestrator (one body per file).
// Every write is INSERT … ON CONFLICT (upsert), never check/delete/insert.
// ════════════════════════════════════════════════════════════════════════

import { type PoolClient } from 'pg'

// Locale of the bundle display strings (Georgian). i18n add = re-run with
// another bundle/locale; classifier_display is keyed (member_id, locale).
const LOCALE = 'ka'

/** Stable SDMX TIME_PERIOD for an annual year. All three bundles are annual. */
export const timePeriod = (year: number): string => String(year)

// Labels in the bundles are Georgian-only; English falls back to the Georgian
// string until an English bundle is loaded (engine renders label ?? code).
function labelEn(ka: string): string {
  return ka
}

/** Bundle statuses are mixed-case ('A'|'P'|'p'|'e'|'r'); cube wants A/P/E/R/M. */
export function normalizeStatus(s: string): string {
  const up = s.toUpperCase()
  return ['A', 'P', 'E', 'R', 'M'].includes(up) ? up : 'A'
}

/**
 * Insert a dimension if missing. Dimensions are DATA (Law 1) — a new axis is a
 * row, never a column. measure/time/geo come from V5; approach/account/side/
 * sector from V7. Assert-by-upsert so the seed is self-contained.
 */
export async function upsertDimension(
  c: PoolClient, code: string, labelKa: string, labelEnStr: string, ord: number,
): Promise<void> {
  await c.query(
    `INSERT INTO stats.dimension (code, label, ord)
     VALUES ($1, $2::jsonb, $3)
     ON CONFLICT (code) DO NOTHING`,
    [code, JSON.stringify({ ka: labelKa, en: labelEnStr }), ord],
  )
}

/**
 * Upsert a classifier member and return its surrogate id. Keyed by the V4
 * natural key (dim_code, code). parentCode is the parent member's business code
 * within the SAME dim_code (or null for a root) — ADR-0023's stable hierarchy
 * edge, replacing the churning surrogate parent_id. The V23 trg_classifier_code_path
 * trigger materializes the LTREE code_path from the CURRENT parent's code_path
 * (it RAISES if a non-null parentCode has no current member, so the seed must
 * still upsert a parent before its children). metadata is the open structural bag
 * — Gap 3 writes unit_measure/decimals here for measure members (one unit per
 * measure, the normalized SSOT home).
 */
export async function upsertClassifier(
  c: PoolClient,
  dimCode: string,
  code: string,
  labelKa: string,
  color: string | null,
  parentCode: string | null,
  ord: number,
  metadata: Record<string, unknown> = {},
): Promise<number> {
  // ON CONFLICT (dim_code, code) WHERE is_current — supplying the partial index's
  // predicate lets Postgres INFER V6's uq_classifier_current (the only unique left
  // post-V18, which dropped the blanket UNIQUE). Predicate must match the index
  // definition EXACTLY (V6: `WHERE is_current`) or inference fails.
  //
  // INTENTIONAL: this updates the CURRENT row IN PLACE — seed/provisioning do NOT
  // write SCD-2 history. Seed = idempotent in-place convergence from source (re-seed
  // overwrites; history isn't needed); the runtime ingest path (src/ingest/upsert.ts)
  // is the SCD-2 writer that close-old/insert-new and preserves revisions.
  //
  // ADR-0023: parent_code is the edge; the code_path trigger derives the path. On a
  // re-seed where the edge moved, parent_code = EXCLUDED.parent_code in DO UPDATE
  // re-fires the trigger (UPDATE OF parent_code) so code_path re-converges.
  const { rows } = await c.query<{ id: number }>(
    `INSERT INTO stats.classifier (dim_code, code, label, color, parent_code, ord, metadata)
     VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7::jsonb)
     ON CONFLICT (dim_code, code) WHERE is_current DO UPDATE
       SET label       = EXCLUDED.label,
           color       = COALESCE(EXCLUDED.color, stats.classifier.color),
           parent_code = EXCLUDED.parent_code,
           ord         = EXCLUDED.ord,
           metadata    = EXCLUDED.metadata
     RETURNING id`,
    [dimCode, code, JSON.stringify({ ka: labelKa, en: labelEn(labelKa) }), color, parentCode, ord, JSON.stringify(metadata)],
  )
  return rows[0].id
}

/** Upsert the per-member, per-locale display overlay (V6 grain). */
export async function upsertDisplay(
  c: PoolClient, memberId: number, display: Record<string, unknown>,
): Promise<void> {
  await c.query(
    `INSERT INTO stats.classifier_display (member_id, locale, display)
     VALUES ($1, $2, $3::jsonb)
     ON CONFLICT (member_id, locale) DO UPDATE
       SET display = EXCLUDED.display`,
    [memberId, LOCALE, JSON.stringify(display)],
  )
}

/**
 * Upsert one observation. dim_key MUST contain exactly the dataset's non-time
 * DSD dims (set equality, enforced by the V4 trigger). Conflict target = the V4
 * unique index (dataset_code, time_period, dim_key_hash, time_period_date);
 * dim_key_hash is GENERATED (Postgres infers it), but time_period_date is
 * WRITER-PROVIDED — supplied inline as stats.parse_time_period(time_period),
 * because TimescaleDB cannot derive the partition column via a trigger on INSERT.
 *
 * GAP 1: obsAttribute → stats.observation.obs_attribute (V8 jsonb bag). Non-key
 * SDMX attributes live here — e.g. seqPos (ACCOUNTS carry-forward position),
 * previously dropped — without polluting dim_key. On a value/status/attribute
 * change the V8 BEFORE-UPDATE trigger records the pre-image into
 * stats.observation_revision (Gap 4): the audit is implicit, no extra call.
 */
export async function upsertObservation(
  c: PoolClient,
  datasetCode: string,
  year: number,
  dimKey: Record<string, string>,
  value: number | null,
  obsStatus: string,
  obsAttribute: Record<string, unknown> = {},
): Promise<void> {
  await c.query(
    `INSERT INTO stats.observation (dataset_code, time_period, time_period_date, dim_key, obs_value, obs_status, obs_attribute)
     VALUES ($1, $2, stats.parse_time_period($2), $3::jsonb, $4, $5, $6::jsonb)
     ON CONFLICT (dataset_code, time_period, dim_key_hash, time_period_date) DO UPDATE
       SET obs_value     = EXCLUDED.obs_value,
           obs_status    = EXCLUDED.obs_status,
           obs_attribute = EXCLUDED.obs_attribute`,
    [datasetCode, timePeriod(year), JSON.stringify(dimKey), value, normalizeStatus(obsStatus), JSON.stringify(obsAttribute)],
  )
}

// ── Reference metadata (V31, SDMX ESMS-lite) ──────────────────────────────────
//
//  The STRUCTURED reference-metadata report for a dataset that backs the Law-9
//  methodology/source/last-updated/quality badges (the SSOT the api serve endpoint
//  reads, the runner folds into the MetadataPort). Optional content fields are i18n
//  LocaleStrings (guarded by the V31 config.enforce_locale_string_optional trigger —
//  a PROVIDED field must be locale-complete; an OMITTED one is allowed).

/** The structured ESMS-lite fields for one dataset report (all optional except the flow). */
export interface ReferenceMetadataSeed {
  metadataflowCode?: string                              // defaults 'ESMS_LITE'
  methodology?:      Record<string, string>              // LocaleString
  source?:           Record<string, string>
  coverage?:         Record<string, string>
  quality?:          Record<string, string>
  note?:             Record<string, string>
  lastUpdated?:      string                              // ISO date 'YYYY-MM-DD'
  contactName?:      string
  contactEmail?:     string
  methodologyUrl?:   string
}

/**
 * Upsert the CURRENT dataset-grained reference-metadata report (V31). INTENTIONAL:
 * like upsertClassifier, this converges the CURRENT row IN PLACE — seed/provisioning
 * do NOT write SCD-2 history (a real metadata revision is a curator action that
 * close-old/inserts-new; a re-seed overwrites the authored current report). The
 * partial unique index uq_reference_metadata_current_dataset (is_current AND
 * target_type='dataset') is the conflict target. The migration must be applied first
 * (the ESMS_LITE metadataflow + the table exist); the helper assumes V31.
 *
 * '{}'::jsonb for an OMITTED LocaleString field — the optional-locale trigger passes
 * it (field absent); a PROVIDED field must be locale-complete or the trigger rejects.
 */
export async function upsertReferenceMetadata(
  c: PoolClient,
  datasetCode: string,
  rm: ReferenceMetadataSeed,
): Promise<void> {
  const loc = (v?: Record<string, string>): string => JSON.stringify(v ?? {})
  await c.query(
    `INSERT INTO stats.reference_metadata
       (metadataflow_code, target_type, dataset_code,
        methodology, source, coverage, quality, note,
        last_updated, contact_name, contact_email, methodology_url)
     VALUES ($1, 'dataset', $2,
        $3::jsonb, $4::jsonb, $5::jsonb, $6::jsonb, $7::jsonb,
        $8, $9, $10, $11)
     ON CONFLICT (dataset_code) WHERE is_current AND target_type = 'dataset' DO UPDATE
       SET metadataflow_code = EXCLUDED.metadataflow_code,
           methodology       = EXCLUDED.methodology,
           source            = EXCLUDED.source,
           coverage          = EXCLUDED.coverage,
           quality           = EXCLUDED.quality,
           note              = EXCLUDED.note,
           last_updated      = EXCLUDED.last_updated,
           contact_name      = EXCLUDED.contact_name,
           contact_email     = EXCLUDED.contact_email,
           methodology_url   = EXCLUDED.methodology_url`,
    [
      rm.metadataflowCode ?? 'ESMS_LITE', datasetCode,
      loc(rm.methodology), loc(rm.source), loc(rm.coverage), loc(rm.quality), loc(rm.note),
      rm.lastUpdated ?? null, rm.contactName ?? null, rm.contactEmail ?? null, rm.methodologyUrl ?? null,
    ],
  )
}
