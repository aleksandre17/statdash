-- ════════════════════════════════════════════════════════════════════════
-- V9__time_period_full_frequency.sql — full SDMX TIME_PERIOD frequency support
-- ════════════════════════════════════════════════════════════════════════
-- GAP 2 — the cube must accept EVERY SDMX TIME_PERIOD frequency, not just the
-- annual/quarterly/monthly/daily subset V4 shipped. This adds:
--   · Semi-annual  '2024-S1' → 2024-01-01 , '2024-S2' → 2024-07-01
--   · Weekly       '2024-W01' → first day (Mon) of that ISO week
--   while preserving the existing annual / quarterly / monthly / daily logic.
--
-- ── IMPORTANT CORRECTION TO THE NAIVE PLAN ──────────────────────────────
-- V4 did NOT use `time_period::date` for the generated column (that plan was
-- written against an assumed schema). V4 ALREADY backs time_period_date with
--     GENERATED ALWAYS AS (stats.parse_time_period(time_period)) STORED
-- and stats.parse_time_period ALREADY handles A/Q/M/D. Therefore:
--   * The generated column does NOT need to be dropped/rebuilt. It references
--     the parser BY NAME, so CREATE OR REPLACE of the parser is all that is
--     needed to teach the cube new frequencies — the hypertable partition
--     column is never touched. This is the safest possible path.
--   * The ONLY structural blocker is V4's CHECK constraint
--     obs_time_period_fmt_chk, whose regex rejects '-S1' / '-W01'. A CHECK
--     cannot be edited in place; it is dropped and re-added with a widened
--     (superset) pattern. Because the new pattern ACCEPTS everything the old
--     one did, every existing row already satisfies it — re-validation is
--     trivially true.
--
-- ── 09 §B RISK GATE (Class-M migration) ─────────────────────────────────
--   Reversibility : Effectively TWO-WAY for the live concern. The parser is
--                   CREATE OR REPLACE (revert = restore the V4 body). The CHECK
--                   is dropped + re-added (revert = re-add the V4 regex) — and
--                   re-tightening is only blocked if S/W rows have since been
--                   written, which is the expected one-way property of any
--                   accept-set widening (Postel: widening is safe, narrowing is
--                   the door that needs scrutiny). No data is mutated.
--   Blast radius  : LOW. The partition column (time_period_date), the unique
--                   index, the compression config, and EVERY existing column
--                   type are untouched. Existing rows (all A/Q/M/D) are NOT
--                   recomputed by CREATE OR REPLACE and parse identically under
--                   the new body, so their stored time_period_date is unchanged
--                   and still correct → partition placement is stable.
--   Rollback plan : 1) re-CREATE OR REPLACE stats.parse_time_period with the
--                      exact V4 body; 2) ALTER TABLE stats.observation
--                      DROP CONSTRAINT obs_time_period_fmt_chk, then re-add the
--                      V4 regex (will FAIL only if S/W rows now exist — by then
--                      the widening is load-bearing and rollback is moot).
--   Hypertable    : PARTITION COLUMN UNTOUCHED. No create_hypertable, no
--                   reorder, no recompression. parse_time_period stays IMMUTABLE
--                   STRICT (required to back a GENERATED STORED column) — both
--                   markers are preserved verbatim.
--
-- WHY a STORED generated column is NOT recomputed on function replace: Postgres
-- materialized the value at write time; replacing the function changes future
-- writes only. This is exactly what we want — historical placement is frozen,
-- and any genuine recompute (if ever needed) is an explicit, reviewed backfill,
-- not a silent side effect of this migration.
--
-- Idempotent: CREATE OR REPLACE FUNCTION; the CHECK swap is guarded with
-- DROP CONSTRAINT IF EXISTS before ADD. Re-run = converge. No DROP of any V1-V7
-- table or column.
-- ════════════════════════════════════════════════════════════════════════


-- ── stats.parse_time_period — universal SDMX TIME_PERIOD → start-of-period DATE
-- Superset of the V4 body: A, Q, M, D unchanged; S (semi-annual) and W (ISO
-- week) added. Order of WHEN arms is significant — the more specific patterns
-- (S, Q, W) are tested before the generic month/day arms they could otherwise
-- be mistaken for (they cannot here because the literal S/Q/W disambiguates,
-- but the explicit ordering documents intent and is robust to future arms).
--
-- ISO week: '2024-W01' → the Monday of ISO week 1 of 2024. Computed via the
-- ISO-week date algorithm (Postgres has no direct "ISO week → date" cast, so
-- we anchor on Jan 4th — always in ISO week 1 — and offset by whole weeks).
CREATE OR REPLACE FUNCTION stats.parse_time_period(p TEXT) RETURNS DATE AS $$
  SELECT CASE
    -- Annual: '2024'
    WHEN p ~ '^\d{4}$'
      THEN (p || '-01-01')::DATE

    -- Semi-annual: '2024-S1' → 01-01, '2024-S2' → 07-01
    WHEN p ~ '^\d{4}-S[12]$'
      THEN (substring(p, 1, 4) || '-' ||
            CASE substring(p, 7, 1) WHEN '1' THEN '01' ELSE '07' END ||
            '-01')::DATE

    -- Quarterly: '2024-Q1'..'2024-Q4' → 01-01 / 04-01 / 07-01 / 10-01
    WHEN p ~ '^\d{4}-Q[1-4]$'
      THEN (substring(p, 1, 4) || '-' ||
            lpad(((substring(p, 7, 1)::INT - 1) * 3 + 1)::TEXT, 2, '0') ||
            '-01')::DATE

    -- Weekly (ISO 8601): '2024-W01' → Monday of that ISO week.
    -- Anchor: Jan 4 is always in ISO week 1. Subtract its ISO DOW (1=Mon) to
    -- reach the Monday of week 1, then add (week-1) weeks.
    WHEN p ~ '^\d{4}-W\d{2}$'
      THEN (
        (substring(p, 1, 4) || '-01-04')::DATE
          - (EXTRACT(ISODOW FROM (substring(p, 1, 4) || '-01-04')::DATE)::INT - 1)
          + ((substring(p, 7, 2)::INT - 1) * 7)
      )

    -- Monthly: '2024-01'..'2024-12'
    WHEN p ~ '^\d{4}-\d{2}$'
      THEN (p || '-01')::DATE

    -- Daily (ISO): '2024-01-15'
    WHEN p ~ '^\d{4}-\d{2}-\d{2}$'
      THEN p::DATE

    ELSE NULL
  END;
$$ LANGUAGE SQL IMMUTABLE STRICT;

COMMENT ON FUNCTION stats.parse_time_period(TEXT) IS
  'Universal SDMX TIME_PERIOD text → start-of-period DATE anchor (A/S/Q/W/M/D). IMMUTABLE STRICT — backs observation.time_period_date GENERATED STORED. Superset of the V4 body (adds S semi-annual + W ISO-week). Unknown formats → NULL (caller/CHECK rejects).';


-- ── Widen the write-time format CHECK to the full frequency set ──────────
-- V4's obs_time_period_fmt_chk regex: '^\d{4}(-Q[1-4]|-\d{2}(-\d{2})?)?$'
-- (A/Q/M/D only). The new regex is a SUPERSET adding -S[12] and -W\d{2}, so
-- every existing row already satisfies it → re-add validates instantly.
-- DROP IF EXISTS keeps the swap idempotent (re-run after success is a no-op:
-- the V4 constraint is gone, ours is present, IF EXISTS skips, ADD would dupe
-- the name → so we also guard the ADD by dropping our own name first).
ALTER TABLE stats.observation DROP CONSTRAINT IF EXISTS obs_time_period_fmt_chk;
ALTER TABLE stats.observation
  ADD CONSTRAINT obs_time_period_fmt_chk CHECK (
    time_period ~ '^\d{4}(-S[12]|-Q[1-4]|-W\d{2}|-\d{2}(-\d{2})?)?$'
  );

COMMENT ON CONSTRAINT obs_time_period_fmt_chk ON stats.observation IS
  'SDMX TIME_PERIOD write-time format guard. Full frequency set: annual / semi-annual (S1-S2) / quarterly (Q1-Q4) / weekly (W01-W53) / monthly / daily. Superset of the V4 regex; stats.parse_time_period parses exactly this set.';
