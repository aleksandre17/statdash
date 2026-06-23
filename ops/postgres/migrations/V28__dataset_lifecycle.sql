-- ════════════════════════════════════════════════════════════════════════
-- V28__dataset_lifecycle.sql — ADR (SDMX-P1-B) Dataset lifecycle FSM:
--                              maintainable-artefact status, ORTHOGONAL to release
-- ════════════════════════════════════════════════════════════════════════
-- WHAT THIS ADDS (and WHY) — all ADDITIVE; V1-V27 are applied + immutable.
--
--   THE GAP (ADR SDMX-P1-B) — stats.dataset has NO lifecycle. A Dataflow/DSD is a
--   maintainable artefact with its OWN lifecycle (draft → published → deprecated →
--   superseded-by-vNext, with a validity window and a supersession chain). Today a
--   dataset cannot be marked draft, deprecated, or retired; the published-only
--   delivery surfaces (bootstrap, cube-profile, public observations) have no way to
--   hide a draft or a superseded dataset from discovery.
--
--   THE CRITICAL DISTINCTION — this is NOT stats.release (V25). release.status
--   (open/published/superseded) is the lifecycle of a DATA VINTAGE ("GDP as
--   published on D"). dataset.status is the lifecycle of the ARTEFACT ("the
--   GDP_ANNUAL artefact is deprecated, superseded by GDP_ANNUAL_2025"). They are
--   ORTHOGONAL: a dataset publishes many releases; a deprecated dataset still has a
--   current release. Conflating them was the trap — REJECTED explicitly (ADR).
--   This is also distinct from stats.dataset_version (V6), the monotonic ETag
--   counter — different concern, NOT merged (SSOT each).
--
--   THE DECISION — add an artefact-lifecycle FSM to stats.dataset:
--     status       draft | published | deprecated | superseded  (dataset_status_chk)
--     valid_from   TIMESTAMPTZ — SDMX validFrom (set on publish if null)
--     valid_to     TIMESTAMPTZ — SDMX validTo   (set on supersede)
--     replaced_by  self-FK → stats.dataset(code) — the supersession (version) chain
--   + dataset_superseded_chk: (status='superseded') = (replaced_by IS NOT NULL) —
--     make the illegal state UNREPRESENTABLE (fail fast at write, not in app code).
--   + dataset_validity_chk: valid_to >= valid_from when both present.
--   + stats.set_dataset_status(code, new_status, replaced_by) — the transition
--     function, MIRRORING stats.publish_release (V25): validated transitions, the
--     validity-window side effects, idempotent re-apply.
--
--   THE FSM (enforced by stats.set_dataset_status):
--     draft ──publish──→ published ──deprecate──→ deprecated
--       │                    │                        │
--       │                    └──supersede(replaced_by)──→ superseded
--       └─(may stay draft / be deleted while draft only)
--     · draft → published   : sets valid_from = now() if NULL. Only published (and
--                             deprecated) datasets are visible in delivery.
--     · published → deprecated : still READABLE (existing dashboards keep working),
--                             but flagged; Constructor de-emphasises. No valid_to
--                             forced (deprecated ≠ withdrawn).
--     · published/deprecated → superseded : REQUIRES replaced_by; sets valid_to =
--                             now(). The SDMX version chain.
--
--   WHAT HAPPENS TO OBSERVATIONS (the load-bearing, non-negotiable decision):
--     A lifecycle transition DELETES NO FACTS. A superseded/deprecated dataset's
--     observations remain in stats.observation (data outlives code — the cube's
--     standing law; auditability — a permalink to an old dashboard must not 404).
--     Lifecycle is a PROJECTION FILTER, not a data operation:
--       · the delivery surfaces project PUBLISHED-ONLY by default
--         (status IN ('published','deprecated') — deprecated still served, flagged;
--          draft/superseded hidden from discovery).
--       · superseded datasets stay readable via direct/permalink + vintage (asOf)
--         reads (auditability), but are ABSENT from discovery/catalog.
--     This mirrors V25/V26: enforce the rule in the READ projection, NOT the hot
--     write path. NO trigger on the hypertable; NO column on stats.observation.
--     The SSOT for "what delivery shows" is the view stats.dataset_published below,
--     reused by bootstrap + cube-profile + the public observations route.
--
--   WHY THIS SHAPE (rationale + rejected alternatives):
--     · REJECTED — lifecycle as a dataset.metadata JSONB flag. Not constrainable
--       (no illegal-state CHECK), not FK-validated (the supersession chain), not
--       indexable for the published-only projection. (SSOT, fail-fast.)
--     · REJECTED — a separate stats.dataset_version table (full maintainable-artefact
--       versioning). Over-built: we have ONE live version per dataset; the self-FK
--       replaced_by chain captures supersession without a version-history table.
--       Escalation door if true multi-version-concurrent becomes real (YAGNI).
--     · REJECTED — deleting/archiving observations on supersede. Breaks vintage
--       reconstruction (V25), revision triangles, and permalinks (auditability).
--       Rejected hard.
--
-- ── 09 §B RISK GATE (Class-M migration — TWO-WAY reversible) ─────────────
--   Reversibility : TWO-WAY (pure addition). Four nullable/defaulted ADD COLUMNs +
--                   three CHECK constraints + one self-FK on stats.dataset (a PLAIN
--                   table) + one VIEW + one FUNCTION. status has a DEFAULT 'draft'
--                   — a DEFAULT add of a CONSTANT is metadata-only on PG ≥ 11 (no
--                   row rewrite); the backfill (§3) then promotes existing rows to
--                   'published' so live datasets stay visible (see Blast). The other
--                   three columns are nullable, no-default (metadata-only).
--   Blast radius  : MODERATE-by-default, NEUTRALISED by the backfill. A new
--                   status='draft' DEFAULT would HIDE every existing dataset from the
--                   published-only projection (delivery would go dark). The backfill
--                   §3 promotes all PRE-V28 datasets to 'published' (valid_from =
--                   their earliest known write, else now()) so delivery is unchanged
--                   the instant V28 applies. NEW datasets created after V28 default
--                   to 'draft' (the intended governance — publish is explicit). NO
--                   trigger is added to stats.observation, NO column added to it, NO
--                   change to the partition key / unique index / compression — the
--                   cube's hot write path is byte-for-byte unchanged (pre-V28).
--   Hypertable    : UNAFFECTED. stats.dataset is a PLAIN table; the new view
--                   stats.dataset_published is a trivial filter over it (no
--                   hypertable scan). stats.observation is not touched.
--   Illegal state : dataset_superseded_chk makes status='superseded' representable
--                   IFF replaced_by is present (and vice versa) — the FSM invariant
--                   is enforced by the type system, not app code (fail fast).
--   Rollback plan : DROP VIEW     IF EXISTS stats.dataset_published;
--                   DROP FUNCTION IF EXISTS stats.set_dataset_status(TEXT, TEXT, TEXT);
--                   ALTER TABLE stats.dataset
--                     DROP CONSTRAINT IF EXISTS dataset_validity_chk,
--                     DROP CONSTRAINT IF EXISTS dataset_superseded_chk,
--                     DROP CONSTRAINT IF EXISTS dataset_status_chk,
--                     DROP CONSTRAINT IF EXISTS dataset_replaced_by_fk,
--                     DROP COLUMN     IF EXISTS replaced_by,
--                     DROP COLUMN     IF EXISTS valid_to,
--                     DROP COLUMN     IF EXISTS valid_from,
--                     DROP COLUMN     IF EXISTS status;
--                   (No cube datum is touched; lifecycle deletes no facts, so a
--                    rollback only forgets the status/validity metadata.)
--
-- Idempotent: ADD COLUMN IF NOT EXISTS · ADD CONSTRAINT guarded by existence check ·
-- CREATE OR REPLACE VIEW/FUNCTION · the backfill only promotes still-'draft' PRE-V28
-- rows once (guarded). Re-run = converge, never error. Never edits a V1-V27 object.
-- ════════════════════════════════════════════════════════════════════════


-- ════════════════════════════════════════════════════════════════════════
-- 1. stats.dataset += lifecycle columns (status / validity window / replaced_by)
-- ════════════════════════════════════════════════════════════════════════
-- status DEFAULT 'draft' — the governance default for NEW datasets (publish is an
-- explicit transition). PRE-V28 datasets are promoted to 'published' by the §3
-- backfill so delivery is unchanged. valid_from/valid_to are the SDMX artefact
-- validity window. replaced_by is the self-referential supersession chain.
ALTER TABLE stats.dataset
  ADD COLUMN IF NOT EXISTS status      TEXT NOT NULL DEFAULT 'draft';
ALTER TABLE stats.dataset
  ADD COLUMN IF NOT EXISTS valid_from  TIMESTAMPTZ;
ALTER TABLE stats.dataset
  ADD COLUMN IF NOT EXISTS valid_to    TIMESTAMPTZ;
ALTER TABLE stats.dataset
  ADD COLUMN IF NOT EXISTS replaced_by TEXT;

-- The supersession chain self-FK (guarded so re-run is a no-op). ON DELETE SET NULL:
-- deleting the successor dataset must not cascade-delete the predecessor (it only
-- loses its forward pointer). Note: this would then leave a 'superseded' row with a
-- NULL replaced_by, violating dataset_superseded_chk — but a CHECK is only evaluated
-- on INSERT/UPDATE of the row, so the SET NULL would itself be the UPDATE that trips
-- it, correctly REJECTING deletion of a still-referenced successor (fail fast — you
-- must re-point or un-supersede the predecessor first). Documented so the
-- interaction is understood, not surprising.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'dataset_replaced_by_fk'
      AND conrelid = 'stats.dataset'::regclass
  ) THEN
    ALTER TABLE stats.dataset
      ADD CONSTRAINT dataset_replaced_by_fk
      FOREIGN KEY (replaced_by) REFERENCES stats.dataset(code) ON DELETE SET NULL;
  END IF;
END;
$$;

-- The FSM state set.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'dataset_status_chk' AND conrelid = 'stats.dataset'::regclass
  ) THEN
    ALTER TABLE stats.dataset
      ADD CONSTRAINT dataset_status_chk
      CHECK (status IN ('draft', 'published', 'deprecated', 'superseded'));
  END IF;
END;
$$;

-- Make the illegal state unrepresentable: superseded IFF replaced_by present.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'dataset_superseded_chk' AND conrelid = 'stats.dataset'::regclass
  ) THEN
    ALTER TABLE stats.dataset
      ADD CONSTRAINT dataset_superseded_chk
      CHECK ((status = 'superseded') = (replaced_by IS NOT NULL));
  END IF;
END;
$$;

-- Validity window sanity (both NULL, one NULL, or to >= from).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'dataset_validity_chk' AND conrelid = 'stats.dataset'::regclass
  ) THEN
    ALTER TABLE stats.dataset
      ADD CONSTRAINT dataset_validity_chk
      CHECK (valid_to IS NULL OR valid_from IS NULL OR valid_to >= valid_from);
  END IF;
END;
$$;

COMMENT ON COLUMN stats.dataset.status IS
  'SDMX maintainable-artefact lifecycle FSM (P1-B; dataset_status_chk): draft → published → deprecated → superseded. ORTHOGONAL to stats.release.status (the DATA VINTAGE lifecycle) and to stats.dataset_version (the ETag counter) — SSOT each, NOT merged. Delivery projects published-only (published+deprecated visible; draft/superseded hidden) via stats.dataset_published. NEW datasets default to draft; pre-V28 datasets were backfilled to published.';
COMMENT ON COLUMN stats.dataset.valid_from IS
  'SDMX artefact validFrom — set to now() on the draft→published transition (stats.set_dataset_status) if NULL. The artefact validity window, NOT a data vintage instant (that is stats.release.published_at).';
COMMENT ON COLUMN stats.dataset.valid_to IS
  'SDMX artefact validTo — set to now() on supersession. Deprecated does NOT force valid_to (deprecated ≠ withdrawn; still readable).';
COMMENT ON COLUMN stats.dataset.replaced_by IS
  'Supersession (version) chain: the dataset code that replaces this one. Self-FK (dataset_replaced_by_fk, ON DELETE SET NULL). dataset_superseded_chk ties status=superseded IFF replaced_by present (illegal state unrepresentable). NULL unless superseded.';


-- ════════════════════════════════════════════════════════════════════════
-- 2. stats.dataset_published — the published-only projection (delivery SSOT)
-- ════════════════════════════════════════════════════════════════════════
-- THE SINGLE SOURCE OF TRUTH for "what the delivery surfaces show". bootstrap,
-- cube-profile and the public observations route ALL filter through THIS view
-- (Protected Variations) — one definition of the published-only projection, never
-- three WHERE clauses that could drift. A dataset is in delivery iff its status is
-- 'published' or 'deprecated' (deprecated is still served — existing dashboards
-- keep working — but the row carries the status so the consumer can flag it).
-- 'draft' and 'superseded' are HIDDEN from discovery (a superseded dataset stays
-- readable only via direct permalink/asOf — that path does NOT go through this view;
-- see the observations route, which keeps its hot scan and only consults this view
-- to gate DISCOVERY, never to delete a permalinked read).
--
-- It SELECTs * so a consumer gets the full dataset row + status (no second join to
-- learn the lifecycle); the projection is the WHERE, not a column narrowing.
CREATE OR REPLACE VIEW stats.dataset_published AS
  SELECT d.*
    FROM stats.dataset d
   WHERE d.status IN ('published', 'deprecated');

COMMENT ON VIEW stats.dataset_published IS
  'P1-B published-only projection — the delivery SSOT reused by bootstrap, cube-profile and the public observations route (Protected Variations: one published-only definition, not three). A dataset is visible iff status IN (published, deprecated); deprecated is served but flagged (status is carried). draft/superseded are hidden from discovery — a superseded dataset stays readable via direct permalink/asOf (auditability), which does NOT route through this view.';


-- ════════════════════════════════════════════════════════════════════════
-- 3. BACKFILL — promote PRE-V28 datasets to 'published' (delivery unchanged)
-- ════════════════════════════════════════════════════════════════════════
-- The status DEFAULT 'draft' would otherwise HIDE every existing dataset from the
-- published-only projection (delivery goes dark). Promote all rows that are still
-- at the default 'draft' AND predate V28 to 'published', stamping valid_from to the
-- dataset's earliest known write (else its created_at, else now()). After this,
-- delivery shows exactly the datasets it showed pre-V28; only NEW datasets created
-- after V28 default to draft (the intended explicit-publish governance).
--
-- IDEMPOTENT/SAFE: only touches status='draft' rows (a re-run, or a dataset already
-- deliberately set to draft by authoring AFTER V28, is left alone — there is no way
-- to distinguish those on a second run, so the promotion runs ONCE inside the
-- migration where every draft is by definition a pre-V28 legacy row). On first
-- apply, every dataset is legacy → all promoted; on re-apply (same migration
-- version) Flyway will not re-run it, so the once-only semantics hold.
UPDATE stats.dataset
   SET status     = 'published',
       valid_from = COALESCE(
                      valid_from,
                      (SELECT min(o.updated_at) FROM stats.observation o
                        WHERE o.dataset_code = stats.dataset.code),
                      created_at,
                      now()
                    )
 WHERE status = 'draft';


-- ════════════════════════════════════════════════════════════════════════
-- 4. stats.set_dataset_status() — the lifecycle transition function (FSM)
-- ════════════════════════════════════════════════════════════════════════
-- The ONLY sanctioned way to move a dataset through its lifecycle — mirrors
-- stats.publish_release (V25): validated transitions, validity-window side effects,
-- idempotent re-apply of the same target state. Rejects illegal transitions with a
-- clear, domain-specific message (fail fast). The supersession target (p_replaced_by)
-- is REQUIRED iff p_new_status='superseded' (and forbidden otherwise) — belt to the
-- dataset_superseded_chk braces.
--
-- LEGAL TRANSITIONS (everything else RAISES):
--   draft               → published
--   published           → deprecated | superseded
--   deprecated          → superseded | published   (un-deprecate is allowed: a
--                                                    deprecated dataset may be
--                                                    re-promoted while still live)
--   <same status>       → <same status>            (idempotent no-op, returns)
-- NOTE: there is no path OUT of 'superseded' (a superseded artefact is terminal in
-- the forward chain — its successor is the live one). Re-pointing replaced_by is a
-- separate authoring concern (UPDATE under the CHECK), not a status transition.
CREATE OR REPLACE FUNCTION stats.set_dataset_status(
  p_code        TEXT,
  p_new_status  TEXT,
  p_replaced_by TEXT DEFAULT NULL
) RETURNS stats.dataset
LANGUAGE plpgsql AS $$
DECLARE
  ds      stats.dataset%ROWTYPE;
  now_ts  TIMESTAMPTZ := now();
BEGIN
  SELECT * INTO ds FROM stats.dataset WHERE code = p_code FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'set_dataset_status: dataset % not found', p_code;
  END IF;

  -- Idempotent re-apply of the same state (only when the supersession target also
  -- matches, so a no-op cannot silently swallow a replaced_by change).
  IF ds.status = p_new_status
     AND p_replaced_by IS NOT DISTINCT FROM ds.replaced_by THEN
    RETURN ds;
  END IF;

  -- Validate the supersession-target / status pairing up front (mirrors the
  -- dataset_superseded_chk so the function fails with a clearer message than the
  -- raw constraint would).
  IF p_new_status = 'superseded' AND p_replaced_by IS NULL THEN
    RAISE EXCEPTION 'set_dataset_status: superseding % requires p_replaced_by', p_code;
  END IF;
  IF p_new_status <> 'superseded' AND p_replaced_by IS NOT NULL THEN
    RAISE EXCEPTION 'set_dataset_status: p_replaced_by is only valid when superseding (got status=%)', p_new_status;
  END IF;
  IF p_new_status = 'superseded' AND p_replaced_by = p_code THEN
    RAISE EXCEPTION 'set_dataset_status: a dataset cannot supersede itself (%)', p_code;
  END IF;

  -- Validate the transition against the FSM.
  IF NOT (
       (ds.status = 'draft'      AND p_new_status = 'published')
    OR (ds.status = 'published'  AND p_new_status IN ('deprecated', 'superseded'))
    OR (ds.status = 'deprecated' AND p_new_status IN ('superseded', 'published'))
  ) THEN
    RAISE EXCEPTION 'set_dataset_status: illegal transition % -> % for dataset %', ds.status, p_new_status, p_code;
  END IF;

  -- Apply the transition + its validity-window side effects.
  UPDATE stats.dataset
     SET status      = p_new_status,
         replaced_by = CASE WHEN p_new_status = 'superseded' THEN p_replaced_by ELSE NULL END,
         valid_from  = CASE
                         WHEN p_new_status = 'published' THEN COALESCE(valid_from, now_ts)
                         ELSE valid_from
                       END,
         valid_to    = CASE
                         WHEN p_new_status = 'superseded' THEN now_ts
                         ELSE valid_to
                       END
   WHERE code = p_code
   RETURNING * INTO ds;

  RETURN ds;
END;
$$;

COMMENT ON FUNCTION stats.set_dataset_status(TEXT, TEXT, TEXT) IS
  'P1-B dataset lifecycle FSM transition (mirrors stats.publish_release V25). Legal moves: draft→published; published→{deprecated,superseded}; deprecated→{superseded,published}. Same-state = idempotent no-op. Side effects: publish sets valid_from=now() if NULL; supersede sets valid_to=now() and requires p_replaced_by (≠ self). Rejects illegal transitions (fail fast). DELETES NO observations — lifecycle is a projection filter (stats.dataset_published), never a data operation.';
