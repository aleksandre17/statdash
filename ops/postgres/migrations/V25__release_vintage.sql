-- ════════════════════════════════════════════════════════════════════════
-- V25__release_vintage.sql — ADR-0025 Vintage-as-Release (SDMX-P0-2)
-- ════════════════════════════════════════════════════════════════════════
-- WHAT THIS ADDS (and WHY) — all ADDITIVE; V1-V24 are applied + immutable.
--
--   THE GAP (ADR-0025) — V8 captures revision PRE-IMAGES into
--   stats.observation_revision keyed ONLY by the server timestamp revised_at.
--   Revisions are per-observation and are NOT grouped into a coherent published
--   vintage, so P0-2 cannot answer (1) "GDP series AS IT WAS PUBLISHED on date
--   D" (vintage reconstruction) or (2) revision triangles (how the estimate for
--   period P evolved across releases). Server timestamps do not group an atomic
--   published set: two figures published in one event get micro-different
--   revised_at values and a mid-event D could split a release.
--
--   THE DECISION — model the PUBLICATION EVENT as a first-class aggregate:
--   stats.release (SDMX/ECB sense). A release bundles 1..N submissions (revised
--   facts + codelists + displays) under one atomic published_at. Each value the
--   cube currently holds is stamped with the release that SET it
--   (observation.release_id); each pre-image in observation_revision is stamped
--   with BOTH the release that originally set the now-superseded value
--   (set_by_release_id = the OLD observation.release_id) AND the release that
--   superseded it (superseded_by_release_id = the publishing release). That makes
--   every pre-image a CLOSED validity interval keyed by RELEASE — the as-of
--   query overlays pre-images on the current cube by release.published_at.
--
--   STAMPING via GUC, read by triggers — mirrors the existing app.revised_by (V8)
--   / app.dry_run (V17) idiom. The publish txn does SET LOCAL app.release_id =
--   '<uuid>'; (a) a BEFORE INSERT/UPDATE trigger on stats.observation stamps
--   release_id = the GUC (the release that set the CURRENT value); (b) the V8
--   capture trigger is EXTENDED to also write set_by_release_id (= OLD.release_id)
--   and superseded_by_release_id (= the GUC) onto each pre-image. The V8 capture
--   logic is preserved verbatim — only the two release columns are added to its
--   INSERT.
--
--   dataset_version RECONCILIATION — a published release REUSES the V6 idempotent
--   stats.bump_dataset_version (NOT a duplicated counter). release is the
--   WHO/WHEN of a publication (durable vintage key); dataset_version stays the
--   cheap monotonic ETag validator (cache token). Different jobs, SSOT each —
--   NOT merged.
--
--   GENESIS BACKFILL — existing rows predate release tracking. One synthetic
--   "genesis" release per dataset (published_at = min(observation.updated_at),
--   else now()) is created and every existing observation.release_id is stamped
--   to it. Existing observation_revision rows get genesis as set_by_release_id
--   and (best-effort) NULL superseded_by_release_id — their supersession predates
--   release tracking and is FLAGGED, not invented (ADR rejected-alt #3: do not
--   manufacture a vintage from timestamps).
--
-- ── 09 §B RISK GATE (Class-M migration) ─────────────────────────────────
--   Reversibility : TWO-WAY (additive). stats.release is a new PLAIN table. The
--                   three new columns are ADD COLUMN ... (nullable, NO default) —
--                   on PG ≥ 11 a NULL-default add is metadata-only (catalog entry,
--                   no full-table rewrite), so it is safe on the populated
--                   hypertable and on the revision log. The genesis backfill only
--                   POPULATES the new nullable columns; it reshapes no existing
--                   datum. Rollback = drop the two triggers/restore the V8 capture
--                   body, DROP the three columns, DROP TABLE stats.release. The
--                   backfilled release_id values are sacrificed on rollback
--                   (acceptable — they are derived, and the cube values are
--                   untouched). Full rollback script in the Rollback plan below.
--   Blast radius  : MODERATE — adds a BEFORE INSERT/UPDATE side effect (release_id
--                   stamping) to the cube's hot write path, and EXTENDS the V8
--                   capture trigger. Both are GUC-gated: when app.release_id is
--                   unset (current_setting(..., true) → NULL) the stamp is NULL and
--                   behaviour is exactly pre-V25 (Postel: writers that do not opt
--                   in pay nothing semantically). NO change to the partition
--                   column, the unique index, segmentby/orderby compression, or any
--                   existing column type.
--   Hypertable    : UNAFFECTED. observation.release_id is a PLAIN nullable UUID. It
--                   is NOT the partition key (time_period_date), NOT in the unique
--                   index uq_observation_series (dataset_code, time_period,
--                   dim_key_hash, time_period_date), NOT in compress_segmentby
--                   (dataset_code, dim_key_hash) and NOT in compress_orderby
--                   (time_period_date DESC, id). A constant/NULL-default ADD COLUMN
--                   is metadata-only on TimescaleDB ≥ 2.11 (the platform image; cf.
--                   V8's obs_attribute add for the same rationale and the
--                   decompress-first remediation if applied on an older build).
--                   stats.release and stats.observation_revision are PLAIN tables.
--   Trigger order : Postgres fires same-timing BEFORE-row triggers in ALPHABETICAL
--                   name order. The release-stamp trigger is named
--                   trg_observation_aa_release_stamp so it sorts BEFORE
--                   trg_observation_validate_dim_key and
--                   trg_observation_capture_revision — the stamp lands on NEW
--                   before any other BEFORE-row trigger reads the row. (The V8
--                   capture trigger reads OLD, not NEW, so ordering does not affect
--                   correctness, but a deterministic early stamp is clearest.)
--   Capture re-entry : The genesis backfill UPDATEs ONLY observation.release_id.
--                   The V8 capture trigger fires BEFORE UPDATE OF obs_value,
--                   obs_status, obs_attribute (column-scoped) — release_id is NOT
--                   in that list, so the backfill does NOT fire capture and writes
--                   NO spurious revision rows. VERIFIED against the live V8 trigger
--                   definition (see the inline assertion comment at the backfill).
--                   The V17 statement-level auto-bump (AFTER INSERT OR UPDATE, NOT
--                   column-scoped) WOULD fire on the backfill; it is suppressed by
--                   SET LOCAL app.dry_run = 'true' around the backfill so genesis
--                   stamping does not churn every dataset's ETag.
--   Rollback plan : -- restore the V8 capture function to its pre-V25 body
--                   --   (the 8-column INSERT without the two release columns),
--                   -- then:
--                   DROP TRIGGER IF EXISTS trg_observation_aa_release_stamp ON stats.observation;
--                   DROP FUNCTION IF EXISTS stats.stamp_observation_release();
--                   ALTER TABLE stats.observation_revision DROP COLUMN IF EXISTS superseded_by_release_id;
--                   ALTER TABLE stats.observation_revision DROP COLUMN IF EXISTS set_by_release_id;
--                   ALTER TABLE stats.observation         DROP COLUMN IF EXISTS release_id;
--                   ALTER TABLE stats_stage.submission     DROP COLUMN IF EXISTS release_id;
--                   DROP FUNCTION IF EXISTS stats.publish_release(UUID);
--                   DROP FUNCTION IF EXISTS stats.open_release(TEXT, JSONB, TEXT);
--                   DROP TABLE IF EXISTS stats.release;
--
-- Idempotent: CREATE TABLE/INDEX/FUNCTION ... IF NOT EXISTS · CREATE OR REPLACE ·
-- ADD COLUMN IF NOT EXISTS · DROP TRIGGER IF EXISTS + CREATE. The genesis backfill
-- is guarded so a re-run stamps ONLY still-NULL rows (converges, never double-
-- stamps). Re-run = no-op. Never edits a V1-V24 object.
-- ════════════════════════════════════════════════════════════════════════


-- ════════════════════════════════════════════════════════════════════════
-- 1. stats.release — the publication-event aggregate (SDMX/ECB release)
-- ════════════════════════════════════════════════════════════════════════
-- A NAMED release ("2024-Q3 GDP release") bundles 1..N submissions. It is the
-- durable vintage key: observation.release_id and observation_revision.
-- {set_by,superseded_by}_release_id all point here, and release.published_at is
-- the as-of anchor for vintage reconstruction.
--
-- dataset_code is NULLABLE: a release may be dataset-scoped (the common case) or
-- cross-dataset (a coordinated multi-dataset publication). is_current is enforced
-- per dataset (and once for the cross-dataset NULL bucket) by a PARTIAL UNIQUE
-- INDEX on a COALESCE expression (see uq_release_current). status is the
-- lifecycle FSM: open → published → superseded.
CREATE TABLE IF NOT EXISTS stats.release (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  label         JSONB       NOT NULL DEFAULT '{}',   -- {"ka":"...","en":"2024-Q3 GDP release"}
  dataset_code  TEXT        REFERENCES stats.dataset(code) ON DELETE CASCADE,  -- NULL = cross-dataset release
  status        TEXT        NOT NULL DEFAULT 'open',
  is_current    BOOLEAN     NOT NULL DEFAULT false,  -- the live published vintage for its dataset scope
  opened_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at  TIMESTAMPTZ,                          -- set on publish; the as-of anchor (NULL while open)
  opened_by     TEXT,                                 -- curator / system that opened it (ADR-0025: opened_by)
  note          TEXT,                                 -- optional free-text curator note (set via API on open)
  metadata      JSONB       NOT NULL DEFAULT '{}',
  CONSTRAINT release_status_chk CHECK (status IN ('open', 'published', 'superseded')),
  -- A published/superseded release MUST have published_at; an open one MUST NOT
  -- (make the illegal lifecycle states unrepresentable — fail fast at write).
  CONSTRAINT release_published_at_chk CHECK (
    (status = 'open'       AND published_at IS NULL) OR
    (status IN ('published','superseded') AND published_at IS NOT NULL)
  )
);

COMMENT ON TABLE stats.release IS
  'SDMX/ECB publication-event aggregate (ADR-0025). A named release bundles 1..N submissions under one atomic published_at. The durable VINTAGE KEY: observation.release_id + observation_revision.{set_by,superseded_by}_release_id point here. Lifecycle FSM open→published→superseded. NOT 1:1 with a submission (a real publication spans facts+codelists+displays).';
COMMENT ON COLUMN stats.release.dataset_code IS
  'Scope of the release: a dataset code (the common case, FK to stats.dataset) or NULL for a coordinated cross-dataset publication. is_current is enforced per scope via uq_release_current with COALESCE(dataset_code,'''').';
COMMENT ON COLUMN stats.release.status IS
  'Lifecycle FSM (release_status_chk): open (accepting submissions, published_at NULL) → published (atomic published_at set, is_current) → superseded (a later release for the same scope became current). The WHO/WHEN of a vintage.';
COMMENT ON COLUMN stats.release.is_current IS
  'TRUE for the single live published vintage of its scope. Flipped to FALSE on the prior current when a new release for the same scope publishes. Enforced by the partial unique index uq_release_current.';
COMMENT ON COLUMN stats.release.published_at IS
  'The atomic publication instant — the as-of anchor for vintage reconstruction. NULL while open (release_published_at_chk). A pre-image''s validity interval = [set_by release.published_at, superseded_by release.published_at).';

-- "current vintage for this dataset scope" must be UNIQUE. dataset_code is
-- nullable, and SQL NULLs are distinct in a plain unique index (so two NULL-scope
-- current releases would both be allowed) — COALESCE(dataset_code,'') collapses
-- the NULL (cross-dataset) bucket into one comparable key so at most ONE current
-- cross-dataset release is permitted too. WHERE is_current makes it a partial
-- index (superseded/open rows are unconstrained — many may share a scope).
CREATE UNIQUE INDEX IF NOT EXISTS uq_release_current
  ON stats.release (COALESCE(dataset_code, ''))
  WHERE is_current;

-- "history of a dataset's releases, newest published first" — revision-triangle
-- and as-of scans walk this.
CREATE INDEX IF NOT EXISTS idx_release_dataset_published
  ON stats.release (dataset_code, published_at DESC);
-- Lifecycle filter — find the open release to attach a submission to.
CREATE INDEX IF NOT EXISTS idx_release_status
  ON stats.release (status);


-- ════════════════════════════════════════════════════════════════════════
-- 2. stats.observation.release_id — the release that SET the current value
-- ════════════════════════════════════════════════════════════════════════
-- Plain nullable UUID. NOT FK-enforced to stats.release here for the same reason
-- V8/V11 avoid FKs touching the hypertable: a TimescaleDB hypertable as the FK
-- SOURCE is supported, but we keep the hot path free of cross-table lock
-- coupling on every write and resolve release at publish/read time (the as-of
-- join is release.published_at, done in the read path). NULL-default add =
-- metadata-only on PG ≥ 11 (no rewrite of the populated hypertable).
ALTER TABLE stats.observation
  ADD COLUMN IF NOT EXISTS release_id UUID;

COMMENT ON COLUMN stats.observation.release_id IS
  'ADR-0025: the stats.release that SET the current value of this observation. Stamped by trg_observation_aa_release_stamp from the SET LOCAL app.release_id GUC during a publish txn (NULL when the GUC is unset → pre-V25 behaviour). Joins stats.release.published_at to give the as-of anchor for vintage reconstruction. Plain nullable UUID — NOT in the partition key, unique index, or compression clauses (hypertable-safe).';


-- ════════════════════════════════════════════════════════════════════════
-- 3. stats.observation_revision — release stamps on the pre-image
-- ════════════════════════════════════════════════════════════════════════
-- set_by_release_id        = the release that ORIGINALLY set the now-superseded
--                            value (copied from OLD.observation.release_id).
-- superseded_by_release_id = the release that SUPERSEDED it (the publishing
--                            release, from the app.release_id GUC).
-- Together they close the pre-image's validity interval:
--   [set_by release.published_at, superseded_by release.published_at).
ALTER TABLE stats.observation_revision
  ADD COLUMN IF NOT EXISTS set_by_release_id        UUID;
ALTER TABLE stats.observation_revision
  ADD COLUMN IF NOT EXISTS superseded_by_release_id UUID;

COMMENT ON COLUMN stats.observation_revision.set_by_release_id IS
  'ADR-0025: the stats.release that ORIGINALLY set the now-superseded value (= the OLD observation.release_id at capture time). Opens the pre-image validity interval. NULL for genesis-era rows whose value predates release tracking (set to genesis by the V25 backfill).';
COMMENT ON COLUMN stats.observation_revision.superseded_by_release_id IS
  'ADR-0025: the stats.release that SUPERSEDED this value (the publishing release, from the app.release_id GUC at capture time). Closes the pre-image validity interval. Best-effort NULL for pre-V25 genesis rows (their supersession predates release tracking — flagged, not invented).';

-- As-of overlay scan: "pre-images of this series, by set-release". Speeds the
-- vintage-reconstruction join from the current cube into the pre-image log.
CREATE INDEX IF NOT EXISTS idx_obs_revision_set_release
  ON stats.observation_revision (dataset_code, dim_key_hash, set_by_release_id);


-- ════════════════════════════════════════════════════════════════════════
-- 4. stats_stage.submission.release_id — submission → release link
-- ════════════════════════════════════════════════════════════════════════
-- A submission carries the release it is attached to (nullable FK). publishFacts
-- resolves/auto-opens a release when none is attached (the single-submission path
-- Just Works); a curator can also open a release and attach several submissions
-- to bundle them into one vintage. ON DELETE SET NULL: dropping a release does
-- not destroy the submission's provenance, only the (re-resolvable) link.
ALTER TABLE stats_stage.submission
  ADD COLUMN IF NOT EXISTS release_id UUID
    REFERENCES stats.release(id) ON DELETE SET NULL;

COMMENT ON COLUMN stats_stage.submission.release_id IS
  'ADR-0025: the stats.release this submission is attached to (nullable). publish resolves/auto-opens a release when NULL (single-submission path); a curator may attach several submissions to one release to bundle a coherent vintage. ON DELETE SET NULL keeps submission provenance if the release is removed.';

CREATE INDEX IF NOT EXISTS idx_submission_release
  ON stats_stage.submission (release_id);


-- ════════════════════════════════════════════════════════════════════════
-- 5. stamp trigger — observation.release_id = app.release_id GUC
-- ════════════════════════════════════════════════════════════════════════
-- BEFORE INSERT OR UPDATE: stamps NEW.release_id from the SET LOCAL app.release_id
-- GUC (the release that is setting the CURRENT value in this publish txn).
--   · INSERT: a new observation gets the publishing release.
--   · UPDATE: a revised value is RE-stamped to the publishing release (its prior
--     release travels onto the pre-image as set_by_release_id via the extended
--     capture trigger — see §6).
-- GUC-gated: current_setting(..., true) = missing_ok → NULL when unset, so a
-- writer that does not SET app.release_id leaves release_id unchanged on UPDATE
-- (COALESCE keeps OLD) and NULL on INSERT — exactly pre-V25 behaviour. The cast
-- to UUID validates the GUC at the boundary (a malformed release_id fails fast).
CREATE OR REPLACE FUNCTION stats.stamp_observation_release()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  guc TEXT := current_setting('app.release_id', true);
BEGIN
  IF guc IS NOT NULL AND guc <> '' THEN
    NEW.release_id := guc::UUID;
  END IF;
  -- guc unset → on INSERT NEW.release_id stays its supplied/NULL value; on UPDATE
  -- it stays whatever the UPDATE provided (the cube upsert does not touch
  -- release_id, so OLD survives). No release context → no re-stamp. Pre-V25 safe.
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION stats.stamp_observation_release() IS
  'ADR-0025: BEFORE INSERT/UPDATE on stats.observation — stamps NEW.release_id from the SET LOCAL app.release_id GUC (the release setting the current value). NULL/empty GUC = no-op (pre-V25 behaviour; writers that do not opt in are unaffected). guc::UUID validates the release id at the boundary (fail fast). Pairs with the extended capture trigger that moves the OLD release_id onto the pre-image as set_by_release_id.';

-- Name sorts FIRST among BEFORE-row triggers (aa_ < capture_ < updated_at <
-- validate_): Postgres fires same-timing BEFORE-row triggers alphabetically, so
-- NEW.release_id is stamped before any other BEFORE-row trigger runs. Fires on
-- INSERT and on ANY UPDATE (NOT column-scoped) so a release context always
-- re-stamps the current value, even an UPDATE that did not list release_id.
DROP TRIGGER IF EXISTS trg_observation_aa_release_stamp ON stats.observation;
CREATE TRIGGER trg_observation_aa_release_stamp
  BEFORE INSERT OR UPDATE ON stats.observation
  FOR EACH ROW EXECUTE FUNCTION stats.stamp_observation_release();

COMMENT ON TRIGGER trg_observation_aa_release_stamp ON stats.observation IS
  'Stamps stats.observation.release_id from the app.release_id GUC on every INSERT/UPDATE made inside a publish txn. Named *_aa_* so it sorts first and stamps NEW before the capture/validate BEFORE-row triggers read the row. No-op when the GUC is unset.';


-- ════════════════════════════════════════════════════════════════════════
-- 6. EXTEND the V8 capture trigger — stamp release on the pre-image
-- ════════════════════════════════════════════════════════════════════════
-- CREATE OR REPLACE of stats.capture_observation_revision (V8). The V8 body is
-- reproduced VERBATIM — same IS DISTINCT FROM guard on the three value columns,
-- same 8-column INSERT (observation_id, dataset_code, time_period, dim_key_hash,
-- obs_value_old, obs_status_old, obs_attribute_old, revised_by) sourcing
-- revised_by from current_setting('app.revised_by', true). The ONLY change is two
-- columns appended to the INSERT:
--   set_by_release_id        := OLD.release_id            (the release that set
--                                                          the now-old value)
--   superseded_by_release_id := app.release_id GUC::UUID  (the release that is
--                                                          superseding it now)
-- No existing logic is dropped or altered. The trigger BINDING (V8:
-- BEFORE UPDATE OF obs_value, obs_status, obs_attribute) is INTENTIONALLY left as
-- V8 defined it — CREATE OR REPLACE FUNCTION rebinds nothing, and that
-- column-scoped binding is exactly what keeps the genesis backfill (UPDATE of
-- release_id only) from firing capture (see §7). We do NOT re-create the trigger.
CREATE OR REPLACE FUNCTION stats.capture_observation_revision()
RETURNS TRIGGER AS $$
DECLARE
  superseding TEXT := current_setting('app.release_id', true);
BEGIN
  IF NEW.obs_value     IS DISTINCT FROM OLD.obs_value
     OR NEW.obs_status IS DISTINCT FROM OLD.obs_status
     OR NEW.obs_attribute IS DISTINCT FROM OLD.obs_attribute
  THEN
    INSERT INTO stats.observation_revision (
      observation_id, dataset_code, time_period, dim_key_hash,
      obs_value_old, obs_status_old, obs_attribute_old, revised_by,
      -- ADR-0025: the two release stamps closing the pre-image validity interval.
      set_by_release_id, superseded_by_release_id
    )
    VALUES (
      OLD.id, OLD.dataset_code, OLD.time_period, OLD.dim_key_hash,
      OLD.obs_value, OLD.obs_status, OLD.obs_attribute,
      -- NULL-safe: returns NULL when the GUC is unset (missing_ok = true).
      current_setting('app.revised_by', true),
      -- set_by = the release that originally set the now-superseded value.
      OLD.release_id,
      -- superseded_by = the publishing release (NULL when no release context).
      CASE WHEN superseding IS NULL OR superseding = '' THEN NULL ELSE superseding::UUID END
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION stats.capture_observation_revision() IS
  'BEFORE UPDATE OF obs_value/obs_status/obs_attribute: appends the OLD image to stats.observation_revision when any value-bearing column actually changes (IS DISTINCT FROM guard → no log row on a same-value upsert). revised_by from the app.revised_by GUC. ADR-0025 EXTENSION: also stamps set_by_release_id = OLD.release_id (the release that set the now-old value) and superseded_by_release_id = the app.release_id GUC (the release superseding it), closing the pre-image validity interval by RELEASE. All V8 logic preserved verbatim; only the two release columns were added to the INSERT.';


-- ════════════════════════════════════════════════════════════════════════
-- 7. GENESIS BACKFILL — one synthetic release per dataset for existing rows
-- ════════════════════════════════════════════════════════════════════════
-- Existing observations predate release tracking. We create ONE 'published'
-- genesis release per dataset (published_at = the dataset's earliest known write,
-- else now()) and stamp every still-NULL observation.release_id to it, then set
-- existing observation_revision.set_by_release_id to that dataset's genesis
-- (superseded_by stays NULL — pre-V25 supersession is unknowable and is FLAGGED,
-- not invented).
--
-- TRIGGER-SAFETY (verified against the live V8 + V17 trigger definitions):
--   · trg_observation_capture_revision (V8) fires BEFORE UPDATE OF obs_value,
--     obs_status, obs_attribute — release_id is NOT in that column list, so the
--     release_id-only UPDATE below does NOT fire capture (no spurious pre-images).
--   · trg_observation_aa_release_stamp (§5) fires BEFORE INSERT OR UPDATE; on the
--     backfill UPDATE the app.release_id GUC is UNSET, so its body is a no-op and
--     does NOT overwrite the explicit SET release_id below.
--   · trg_obs_auto_version (V17) fires AFTER INSERT OR UPDATE FOR EACH STATEMENT
--     (NOT column-scoped) and WOULD bump every touched dataset's ETag. We set
--     SET LOCAL app.dry_run = 'true' for this txn so the genesis stamping does not
--     churn dataset_version (the V17 trigger honours app.dry_run). The setting is
--     LOCAL — it expires with the migration txn.
-- IDEMPOTENT: re-run stamps only still-NULL release_id rows (WHERE release_id IS
-- NULL) and only NULL set_by_release_id revision rows; genesis releases are keyed
-- by metadata->>'genesis' so a second run reuses them.
DO $$
DECLARE
  ds       RECORD;
  rel_id   UUID;
  pub_at   TIMESTAMPTZ;
BEGIN
  -- Suppress the V17 statement-level ETag bump for the backfill (txn-local).
  PERFORM set_config('app.dry_run', 'true', true);

  FOR ds IN
    SELECT DISTINCT dataset_code FROM stats.observation WHERE release_id IS NULL
  LOOP
    -- Reuse an existing genesis release for this dataset if a prior run made one.
    SELECT id INTO rel_id
      FROM stats.release
     WHERE dataset_code = ds.dataset_code
       AND metadata->>'genesis' = 'true'
     LIMIT 1;

    IF rel_id IS NULL THEN
      -- published_at = earliest known write for the dataset, else now().
      SELECT COALESCE(min(updated_at), now()) INTO pub_at
        FROM stats.observation
       WHERE dataset_code = ds.dataset_code;

      INSERT INTO stats.release (
        label, dataset_code, status, is_current, published_at, opened_by, metadata
      )
      VALUES (
        jsonb_build_object('en', 'Genesis release (' || ds.dataset_code || ')'),
        ds.dataset_code,
        'published',
        -- Only ONE current per dataset scope (uq_release_current). No prior
        -- current release can exist (this is the first), so genesis is current.
        true,
        pub_at,
        'V25-genesis-backfill',
        jsonb_build_object('genesis', true)
      )
      RETURNING id INTO rel_id;
    END IF;

    -- Stamp the current cube. release_id is NOT a capture-trigger column, so this
    -- UPDATE writes no revision rows. Only still-NULL rows are touched (re-run
    -- safe; a row already stamped by a real release is never overwritten).
    UPDATE stats.observation
       SET release_id = rel_id
     WHERE dataset_code = ds.dataset_code
       AND release_id IS NULL;

    -- Pre-V25 pre-images: their value was originally set by genesis (best effort);
    -- their supersession predates release tracking → superseded_by stays NULL.
    UPDATE stats.observation_revision
       SET set_by_release_id = rel_id
     WHERE dataset_code = ds.dataset_code
       AND set_by_release_id IS NULL;
  END LOOP;
END $$;


-- ════════════════════════════════════════════════════════════════════════
-- 8. stats.open_release() — lifecycle: open a release for attaching submissions
-- ════════════════════════════════════════════════════════════════════════
-- Opens a new 'open' release (published_at NULL) and returns its id. The curator
-- bundling path: open → attach submissions (set submission.release_id) → publish.
-- The single-submission path does NOT need this — publish auto-opens (see the
-- publish.ts integration); open_release is the explicit curator seam.
--
-- SIGNATURE (ADR-0025): open_release(p_dataset_code, p_label, p_opened_by). The
-- opener is an EXPLICIT parameter, NOT derived from the app.revised_by GUC: the
-- HTTP call sites pass the actor directly (publish.ts → submissionId on the auto
-- path; releases.ts POST / → req.jwtPayload.sub), and those code paths do NOT set
-- app.revised_by. The 3-arg form is the contract both call sites already invoke
-- (SELECT stats.open_release($1, $2::jsonb, $3)); deriving from the GUC would have
-- written NULL opened_by on every real call. DEFAULTs keep it Postel-tolerant
-- (a bare 2-arg call still resolves), but the canonical caller is 3-arg.
--
-- A plain CREATE OR REPLACE CANNOT change a function's argument list (it would
-- error on a renamed/added input parameter, or silently create a second OVERLOAD
-- leaving the stale 2-arg version resolvable). DROP the prior 2-arg signature
-- first so EXACTLY ONE stats.open_release exists and there is no overload
-- ambiguity. Idempotent: DROP IF EXISTS + CREATE OR REPLACE → re-run is a no-op.
DROP FUNCTION IF EXISTS stats.open_release(TEXT, JSONB);
CREATE OR REPLACE FUNCTION stats.open_release(
  p_dataset_code TEXT,
  p_label        JSONB DEFAULT '{}',
  p_opened_by    TEXT  DEFAULT NULL
) RETURNS UUID LANGUAGE sql AS $$
  INSERT INTO stats.release (label, dataset_code, status, opened_by)
  VALUES (
    COALESCE(p_label, '{}'::jsonb),
    p_dataset_code,
    'open',
    p_opened_by
  )
  RETURNING id;
$$;

COMMENT ON FUNCTION stats.open_release(TEXT, JSONB, TEXT) IS
  'ADR-0025 lifecycle: opens a new release (status=open, published_at NULL) for the given dataset scope (NULL = cross-dataset) and returns its id. Curator bundling seam: open → attach submissions (submission.release_id) → stats.publish_release. opened_by is an EXPLICIT param (the HTTP actor — submissionId on the auto path, jwt.sub on the curator path), NOT the app.revised_by GUC. 3-arg signature matches the publish.ts / releases.ts call sites verbatim.';


-- ════════════════════════════════════════════════════════════════════════
-- 9. stats.publish_release() — lifecycle: publish a release atomically
-- ════════════════════════════════════════════════════════════════════════
-- Publishing flips the prior current release of the SAME scope to 'superseded',
-- stamps this release published (published_at = now(), is_current = true), and
-- bumps the dataset's ETag via the V6 stats.bump_dataset_version (REUSED — not a
-- duplicated counter; release and dataset_version are different jobs, SSOT each).
-- Returns published_at (the as-of anchor of the new vintage).
--
-- The caller wraps the FACT writes in the SAME txn with SET LOCAL app.release_id
-- = '<this id>' so the stamp/capture triggers attribute the value changes to this
-- release; publish_release is the FINALIZER of that txn. Order inside the txn:
-- SET LOCAL app.release_id → write facts (triggers stamp) → publish_release.
CREATE OR REPLACE FUNCTION stats.publish_release(p_release_id UUID)
RETURNS TIMESTAMPTZ AS $$
DECLARE
  rel    stats.release%ROWTYPE;
  now_ts TIMESTAMPTZ := now();
BEGIN
  SELECT * INTO rel FROM stats.release WHERE id = p_release_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'publish_release: release % not found', p_release_id;
  END IF;
  IF rel.status = 'published' THEN
    -- Idempotent re-publish: already current → return its anchor unchanged.
    RETURN rel.published_at;
  END IF;
  IF rel.status = 'superseded' THEN
    RAISE EXCEPTION 'publish_release: release % is already superseded (cannot re-publish)', p_release_id;
  END IF;

  -- Flip the prior current release of the SAME scope to superseded. NULL-scope
  -- (cross-dataset) is compared via COALESCE so the NULL bucket matches itself
  -- (mirrors uq_release_current). Excludes self for re-run safety.
  UPDATE stats.release
     SET status = 'superseded', is_current = false
   WHERE is_current = true
     AND id <> p_release_id
     AND COALESCE(dataset_code, '') = COALESCE(rel.dataset_code, '');

  -- Stamp this release published + current. uq_release_current now holds (the
  -- prior current was just demoted), so this never trips the partial unique index.
  UPDATE stats.release
     SET status = 'published', is_current = true, published_at = now_ts
   WHERE id = p_release_id;

  -- ETag invalidation: REUSE the V6 idempotent counter for the dataset scope.
  -- A cross-dataset (NULL scope) release bumps nothing here — its member
  -- submissions each bumped their own dataset via the V17 trigger on the fact
  -- write; release is the WHO/WHEN, dataset_version the cache token (SSOT each).
  IF rel.dataset_code IS NOT NULL THEN
    PERFORM stats.bump_dataset_version(rel.dataset_code);
  END IF;

  RETURN now_ts;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION stats.publish_release(UUID) IS
  'ADR-0025 lifecycle: publishes a release atomically — demotes the prior current release of the same scope to superseded, stamps this one published (published_at=now(), is_current=true), and bumps stats.dataset_version (REUSED V6 counter; release and dataset_version are different jobs, SSOT each). Idempotent on an already-published release; rejects re-publish of a superseded one (fail fast). Returns published_at, the as-of anchor of the new vintage. Caller sets SET LOCAL app.release_id before the fact writes so stamp/capture attribute them to this release; publish_release finalizes the txn.';
