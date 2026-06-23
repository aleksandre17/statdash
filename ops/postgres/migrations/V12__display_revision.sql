-- ════════════════════════════════════════════════════════════════════════
-- V12__display_revision.sql — classifier-display revision audit log
-- ════════════════════════════════════════════════════════════════════════
-- WHAT THIS ADDS (and WHY) — all ADDITIVE; V1-V11 are applied + immutable.
--
--   Symmetric sibling of V8's stats.observation_revision, applied to the OTHER
--   curator-editable surface: stats.classifier_display (V6) — the per-member,
--   per-locale UI overlay ({ label, color, fullLabel, … }). Today a curator's
--   edit of a display label is an UPDATE that silently OVERWRITES the prior
--   value: the old "Real GDP" label is lost the moment it becomes "GDP, real".
--   No audit trail, no "who changed the official-vs-curated label, when, why".
--
--   GAP — revision history for the display overlay. stats.classifier_display_
--   revision = an append-only log + a BEFORE UPDATE OF display trigger that
--   captures the OLD.display pre-image whenever display actually changes. The
--   current label always lives on stats.classifier_display (SSOT); this table
--   is the immutable trail of what it USED to be (event-sourcing-lite for the
--   most editorially-sensitive datum in the cube's presentation layer). No
--   change to the seed or any write path — the audit is implicit, trigger-driven.
--
--   FK DECISION (differs from V8 — read this) —
--     V8's observation_revision could NOT carry a foreign key: stats.observation
--     is a TimescaleDB hypertable, and a hypertable cannot be the TARGET of an
--     FK (no stable referenced unique key across chunks). It referenced by the
--     logical key only.
--     stats.classifier_display is a PLAIN table, so an FK IS valid here — and we
--     use one. The valid target is its ACTUAL primary key, the COMPOSITE
--     (member_id, locale) (V6 line 57). There is no `id` surrogate on
--     classifier_display to point at; an FK must reference a PK/UNIQUE column
--     set, so the referential link is the composite (member_id, locale), which
--     the revision row already carries as its logical reference. One real FK,
--     no redundant surrogate — the audit's logical key IS its referential key.
--
--     ON DELETE SET NULL (not CASCADE): an audit log must OUTLIVE the row it
--     audits (data outlives code). If a curator deletes a display overlay, the
--     history of what it once said must NOT vanish with it — cascade would
--     erase exactly the evidence the log exists to keep. SET NULL severs the
--     live link while preserving the pre-image (display_old) and the captured
--     keys. Because SET NULL must be able to write NULL, the FK columns
--     (member_id, locale) are NULLABLE; they are always populated AT CAPTURE
--     (the trigger reads OLD.*), and only ever nulled later by a parent delete.
--
-- ── 09 §B RISK GATE (Class-A additive migration) ────────────────────────
--   Reversibility : TWO-WAY. Pure addition of one table + one function + one
--                   trigger. No V1-V11 column/type/constraint/index is altered;
--                   the ONLY touch to an existing object is ATTACHING a new
--                   trigger to stats.classifier_display (no reshape, no rewrite).
--   Blast radius  : NONE on V1-V11 objects. The new trigger fires only on
--                   UPDATE OF display (BEFORE UPDATE OF …), so INSERTs (the
--                   seed's hot path) and updated_at-only touches pay nothing.
--                   classifier_display is a plain table — no hypertable concerns.
--   Rollback plan : DROP TRIGGER trg_classifier_display_capture_revision
--                     ON stats.classifier_display;
--                   DROP FUNCTION stats.capture_display_revision();
--                   DROP TABLE stats.classifier_display_revision;
--                   (Audit rows are sacrificed on rollback — acceptable for a
--                   log table; the display overlays themselves are untouched.)
--
-- Idempotent: CREATE TABLE IF NOT EXISTS / CREATE OR REPLACE FUNCTION /
-- DROP TRIGGER IF EXISTS + CREATE / CREATE INDEX IF NOT EXISTS. Re-run = no-op.
-- Additive only; never edits V1-V11. Re-run = converge, never error.
-- ════════════════════════════════════════════════════════════════════════


-- ════════════════════════════════════════════════════════════════════════
-- stats.classifier_display_revision — append-only display revision audit log
-- ════════════════════════════════════════════════════════════════════════
-- GRAIN: one row per DISPLAY-changing update of a classifier_display overlay,
-- capturing the pre-image (OLD.display). The current overlay always lives on
-- stats.classifier_display (SSOT); this table is the immutable trail of what it
-- USED to be. Symmetric equivalent of stats.observation_revision (V8).
CREATE TABLE IF NOT EXISTS stats.classifier_display_revision (
  id            BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  -- Best-effort composite FK to the live overlay's PK (member_id, locale).
  -- Nullable so ON DELETE SET NULL can sever the link while keeping history;
  -- always populated at capture time by the trigger (from OLD.*).
  member_id     BIGINT,
  locale        TEXT,
  display_old   JSONB       NOT NULL,                 -- the pre-image: what the overlay was BEFORE the change
  revised_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  revised_by    TEXT,                                 -- curator/operator id (from app.revised_by GUC)
  revision_note TEXT,                                 -- optional human note
  CONSTRAINT classifier_display_revision_display_fk
    FOREIGN KEY (member_id, locale)
    REFERENCES stats.classifier_display (member_id, locale)
    ON DELETE SET NULL
);

COMMENT ON TABLE stats.classifier_display_revision IS
  'Append-only revision audit log for stats.classifier_display (V6). One row per display-changing UPDATE, holding the PRE-image (display_old). Symmetric to stats.observation_revision (V8). Unlike V8 it CAN and DOES carry an FK: classifier_display is a plain table, so the composite (member_id, locale) references its actual PK. ON DELETE SET NULL keeps history when an overlay is deleted (data outlives code).';
COMMENT ON COLUMN stats.classifier_display_revision.display_old IS
  'Pre-image of stats.classifier_display.display captured BEFORE the curator''s change ({ label, color, fullLabel, … }). The current value lives on classifier_display (SSOT); this is the immutable predecessor.';
COMMENT ON COLUMN stats.classifier_display_revision.member_id IS
  'Logical + referential key (with locale) to stats.classifier_display. Nullable to permit ON DELETE SET NULL; populated at capture from OLD.member_id, only nulled later by a parent overlay delete.';
COMMENT ON COLUMN stats.classifier_display_revision.revised_by IS
  'Who made the change. Sourced from the app.revised_by GUC if the session sets it (SET LOCAL app.revised_by = ''curator:alice''); NULL otherwise. Mirrors V8.';

-- "history of one classifier member's display" — the hot read for a timeline.
CREATE INDEX IF NOT EXISTS idx_display_revision_member
  ON stats.classifier_display_revision (member_id, locale);
-- "what changed recently, newest first" — audit review across all overlays.
CREATE INDEX IF NOT EXISTS idx_display_revision_time
  ON stats.classifier_display_revision (revised_at DESC);


-- ── Capture trigger — records the pre-image on a display-changing UPDATE ───
-- Fires BEFORE UPDATE OF display only, so updated_at-only touches and pure
-- INSERTs cost nothing. Guards on IS DISTINCT FROM so a no-op write (same
-- display) records no revision — an idempotent re-seed leaves the log clean.
-- Symmetric to stats.capture_observation_revision() (V8).
CREATE OR REPLACE FUNCTION stats.capture_display_revision()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.display IS DISTINCT FROM OLD.display THEN
    INSERT INTO stats.classifier_display_revision (
      member_id, locale, display_old, revised_by
    )
    VALUES (
      OLD.member_id, OLD.locale, OLD.display,
      -- NULL-safe: returns NULL when the GUC is unset (missing_ok = true).
      current_setting('app.revised_by', true)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION stats.capture_display_revision() IS
  'BEFORE UPDATE OF display: appends the OLD.display pre-image to stats.classifier_display_revision when display actually changes (IS DISTINCT FROM guard → no log row on a same-value write). revised_by from the app.revised_by GUC. Symmetric to stats.capture_observation_revision() (V8).';

DROP TRIGGER IF EXISTS trg_classifier_display_capture_revision ON stats.classifier_display;
CREATE TRIGGER trg_classifier_display_capture_revision
  BEFORE UPDATE OF display ON stats.classifier_display
  FOR EACH ROW EXECUTE FUNCTION stats.capture_display_revision();
