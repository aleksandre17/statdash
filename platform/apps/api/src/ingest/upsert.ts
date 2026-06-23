// ── Ingest — idempotent gold upserts on the Queryable port ────────────────────
//
// Thin wrappers around the canonical stats.* upsert SQL, parameterized over the
// QueryableClient port (Dependency Inversion) instead of pg's PoolClient.
//
// WHY NOT import scripts/seed-helpers.ts directly:
//   scripts/ and src/ are SEPARATE compilation units (tsconfig.scripts.json vs
//   tsconfig.json with rootDir:"src"). Importing a build-time ETL script into the
//   API runtime would (a) pull a file outside rootDir into the src build (tsc
//   rootDir violation) and (b) couple runtime publish to a build-time script —
//   against the dependency arrow. The SQL is the SSOT; it lives here for the
//   runtime path, in seed-helpers for the one-shot ETL. The two are deliberately
//   kept byte-identical so neither drifts (any change to a gold constraint must
//   touch both — guarded by the V4/V8 triggers that both paths write through).
//
// Every write is INSERT … ON CONFLICT (upsert), never check/delete/insert —
// re-publishing an unchanged submission converges with no churn, and the V8
// BEFORE-UPDATE trigger captures a revision only when a value actually changes.

import type { QueryableClient } from './types.js'

/**
 * Upsert a classifier member as an SCD-2 codelist revision, return the CURRENT
 * member's surrogate id. Keyed by (dim_code, code).
 *
 * V6 added valid_from/valid_to/is_current + uq_classifier_current (one current
 * row per (dim_code, code)) precisely so a label change PRESERVES history rather
 * than overwriting in place. This is the only writer; it must honour that promise:
 *
 *   1. If the label is actually changing, close the current version
 *      (valid_to = now(), is_current = false) so the prior label survives.
 *   2. Insert the new current version. ON CONFLICT … DO NOTHING makes the
 *      unchanged path a no-op (Step 1 closed nothing → existing current row stays).
 *   3. Return the live member id in ALL three paths (changed / unchanged /
 *      first-insert) — the publish caller maps this id to per-locale display
 *      overlays (classifier_display.member_id), so it must never be undefined.
 *
 * ADR-0023 SIMPLIFICATION. The hierarchy edge is now the STABLE business key
 * parent_code (not the churning surrogate parent_id), and the V23
 * trg_classifier_code_path trigger materializes code_path from the CURRENT
 * parent's code_path on INSERT. Because a revised node KEEPS its code, a
 * code-chain path NEVER changes on a revision — so the old re-point-children
 * (Step 3) and recursive subtree-repath (Step 3b) repair work is GONE. They
 * existed only to chase a churning id that no longer carries the hierarchy. The
 * caller passes a parent CODE; the trigger derives the path. Nothing here writes
 * parent_id or path (dropped in V24); during the V23→V24 parity period both
 * representations coexist but this writer touches only the code-chain.
 *
 * The caller wraps publish in a transaction, so the close+insert is atomic.
 * Non-versioned attrs (color/ord/metadata) ride on the new current row; color
 * defaults to the prior current value when not supplied (staged rows omit it).
 */
export async function upsertClassifier(
  c: QueryableClient,
  dimCode: string,
  code: string,
  label: Record<string, string>,
  color: string | null,
  parentCode: string | null,
  ord: number,
  metadata: Record<string, unknown> = {},
): Promise<number> {
  const labelJson = JSON.stringify(label)

  // Step 1 — close the current version IFF the label is actually changing. A
  // revision mints a NEW surrogate id, but the hierarchy edge (parent_code) and
  // the code_path are keyed on the stable code, so there is nothing to re-point:
  // descendants reference this node by its code, which is unchanged.
  await c.query(
    `UPDATE stats.classifier
        SET valid_to = now(), is_current = false
      WHERE dim_code = $1
        AND code = $2
        AND is_current = true
        AND label IS DISTINCT FROM $3::jsonb`,
    [dimCode, code, labelJson],
  )

  // Step 2 — insert the new current version. DO NOTHING when the row is unchanged
  // (Step 1 was a no-op, the existing current row already satisfies the
  // uq_classifier_current partial unique index). color defaults to the prior
  // current value when not supplied. The V23 trg_classifier_code_path trigger
  // fires on this INSERT and materializes code_path from the CURRENT parent's
  // code_path (raising if a non-null parent_code has no current member).
  // RETURNING id yields the NEW current id on the changed / first-insert paths
  // (empty on the unchanged no-op path).
  //
  // CONFLICT TARGET — index INFERENCE, not ON CONSTRAINT. uq_classifier_current is
  // a partial UNIQUE INDEX (V6), which has no pg_constraint row, so
  // `ON CONFLICT ON CONSTRAINT uq_classifier_current` THROWS at runtime
  // ("constraint does not exist"). A partial unique index is reachable ONLY via the
  // inference form: the index columns + its partial predicate. The predicate must
  // match V6's index EXACTLY — V6 declares `WHERE is_current` (NOT `= true`), and
  // inference compares predicates by equality, so it must be spelled identically.
  // This mirrors seed-helpers.upsertClassifier (the byte-identical sibling writer).
  const { rows: inserted } = await c.query<{ id: number }>(
    `INSERT INTO stats.classifier (dim_code, code, label, color, parent_code, ord, metadata, valid_from, is_current)
     VALUES (
       $1, $2, $3::jsonb,
       COALESCE($4, (SELECT color FROM stats.classifier
                      WHERE dim_code = $1 AND code = $2 AND is_current = true)),
       $5, $6, $7::jsonb, now(), true)
     ON CONFLICT (dim_code, code) WHERE is_current DO NOTHING
     RETURNING id`,
    [dimCode, code, labelJson, color, parentCode, ord, JSON.stringify(metadata)],
  )

  // Step 3 — return the live current id (covers all three paths: revision uses the
  // freshly inserted id; first-insert likewise; the unchanged no-op falls through
  // to the SELECT of the still-current row).
  if (inserted[0]) return inserted[0].id
  const { rows } = await c.query<{ id: number }>(
    `SELECT id FROM stats.classifier
      WHERE dim_code = $1 AND code = $2 AND is_current = true`,
    [dimCode, code],
  )
  return rows[0].id
}

/** Upsert the per-member, per-locale display overlay (V6 grain: member_id, locale). */
export async function upsertDisplay(
  c: QueryableClient,
  memberId: number,
  locale: string,
  display: Record<string, unknown>,
): Promise<void> {
  await c.query(
    `INSERT INTO stats.classifier_display (member_id, locale, display)
     VALUES ($1, $2, $3::jsonb)
     ON CONFLICT (member_id, locale) DO UPDATE
       SET display = EXCLUDED.display`,
    [memberId, locale, JSON.stringify(display)],
  )
}

/**
 * Upsert one observation. dim_key MUST contain exactly the dataset's non-time DSD
 * dims (set equality, enforced by the V4 trigger). Conflict target = the V4 unique
 * index (dataset_code, time_period, dim_key_hash, time_period_date); dim_key_hash +
 * time_period_date are GENERATED, so Postgres infers them from the inserted values.
 * On a value/status/attribute change the V8 BEFORE-UPDATE trigger records the
 * pre-image into stats.observation_revision (provenance for free).
 */
export async function upsertObservation(
  c: QueryableClient,
  datasetCode: string,
  timePeriod: string,
  dimKey: Record<string, string>,
  value: number | null,
  obsStatus: string,
  obsAttribute: Record<string, unknown> = {},
): Promise<void> {
  await c.query(
    `INSERT INTO stats.observation (dataset_code, time_period, dim_key, obs_value, obs_status, obs_attribute)
     VALUES ($1, $2, $3::jsonb, $4, $5, $6::jsonb)
     ON CONFLICT (dataset_code, time_period, dim_key_hash, time_period_date) DO UPDATE
       SET obs_value     = EXCLUDED.obs_value,
           obs_status    = EXCLUDED.obs_status,
           obs_attribute = EXCLUDED.obs_attribute`,
    [datasetCode, timePeriod, JSON.stringify(dimKey), value, obsStatus, JSON.stringify(obsAttribute)],
  )
}

/** Idempotent per-dataset version bump (V6) — drives ETag/cache invalidation. */
export async function bumpDatasetVersion(c: QueryableClient, datasetCode: string): Promise<void> {
  await c.query(`SELECT stats.bump_dataset_version($1)`, [datasetCode])
}
