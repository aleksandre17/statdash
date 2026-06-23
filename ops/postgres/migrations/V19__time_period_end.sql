-- ════════════════════════════════════════════════════════════════════════
-- V19__time_period_end.sql — SDMX TIME_PERIOD → END-of-period DATE anchor
-- ════════════════════════════════════════════════════════════════════════
-- WHY — the observations read route maps a client range to dates. It assumed
-- ANNUAL boundaries (`${from}-01-01` / `${to}-12-31`), which is a hardcoded
-- frequency. The cube is frequency-generic (A/S/Q/M/W/D — see V9). A range
-- query must therefore close on the LAST date of the `to` period, whatever its
-- frequency: `to='2020-Q1'` must include all of 2020-01-01 .. 2020-03-31.
--
-- stats.parse_time_period (V4/V9) already gives the START of a period. This
-- migration adds its companion stats.parse_time_period_end giving the END (the
-- inclusive last DATE) of a period. The two are the SSOT for SDMX period↔date
-- boundaries; the route composes them, it does not re-derive date math.
--
-- DESIGN — END = (START of the SAME period) + (one period) - 1 day. We anchor
-- on stats.parse_time_period(p) (already correct & tested for every frequency)
-- and add the frequency's own interval, then step back a day. This reuses the
-- parser as the single source of period-start truth (DRY) and keeps the two
-- functions provably consistent: end(p) is defined in terms of start(p).
--   '2020'       → 2020-12-31   (start 2020-01-01 + 1 year  - 1 day)
--   '2020-S1'    → 2020-06-30   (start 2020-01-01 + 6 months- 1 day)
--   '2020-S2'    → 2020-12-31   (start 2020-07-01 + 6 months- 1 day)
--   '2020-Q1'    → 2020-03-31   (start 2020-01-01 + 3 months- 1 day)
--   '2020-Q4'    → 2020-12-31   (start 2020-10-01 + 3 months- 1 day)
--   '2020-06'    → 2020-06-30   (start 2020-06-01 + 1 month - 1 day)
--   '2020-W52'   → last day(Sun) (start = Monday    + 7 days  - 1 day)
--   '2020-01-15' → 2020-01-15   (start 2020-01-15 + 1 day   - 1 day)
-- Unknown formats → NULL (parse_time_period returns NULL → end is NULL too).
--
-- IMMUTABLE STRICT — same contract as parse_time_period: deterministic, no
-- side effects, NULL in → NULL out. (Not used in a generated column, but the
-- markers let the planner fold it and keep the two functions symmetric.)
--
-- ── 09 §B RISK GATE (Class-S migration — pure additive function) ─────────
--   Reversibility : TWO-WAY. Adds ONE new function; no table, column, index,
--                   constraint, hypertable, or data touched. Rollback =
--                   DROP FUNCTION stats.parse_time_period_end(TEXT).
--   Blast radius  : NONE on existing objects. parse_time_period is read by
--                   name only (not altered). No write path, no partition column,
--                   no compression, no constraint is affected.
--   Rollback plan : DROP FUNCTION IF EXISTS stats.parse_time_period_end(TEXT);
--   Idempotent    : CREATE OR REPLACE FUNCTION — re-run converges. No DROP of
--                   any V1-V18 object.
-- ════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION stats.parse_time_period_end(p TEXT) RETURNS DATE AS $$
  SELECT CASE
    -- Annual: '2020' → Dec 31.
    WHEN p ~ '^\d{4}$'
      THEN stats.parse_time_period(p) + INTERVAL '1 year'   - INTERVAL '1 day'

    -- Semi-annual: '2020-S1' → Jun 30, '2020-S2' → Dec 31.
    WHEN p ~ '^\d{4}-S[12]$'
      THEN stats.parse_time_period(p) + INTERVAL '6 months' - INTERVAL '1 day'

    -- Quarterly: '2020-Q1' → Mar 31 … '2020-Q4' → Dec 31.
    WHEN p ~ '^\d{4}-Q[1-4]$'
      THEN stats.parse_time_period(p) + INTERVAL '3 months' - INTERVAL '1 day'

    -- Weekly (ISO 8601): '2020-W52' → Sunday of that ISO week (Mon..Sun).
    WHEN p ~ '^\d{4}-W\d{2}$'
      THEN stats.parse_time_period(p) + INTERVAL '7 days'   - INTERVAL '1 day'

    -- Monthly: '2020-06' → Jun 30 (last day, leap-safe via + 1 month - 1 day).
    WHEN p ~ '^\d{4}-\d{2}$'
      THEN stats.parse_time_period(p) + INTERVAL '1 month'  - INTERVAL '1 day'

    -- Daily (ISO): '2020-01-15' → the day itself (period length = 1 day).
    WHEN p ~ '^\d{4}-\d{2}-\d{2}$'
      THEN stats.parse_time_period(p)

    ELSE NULL
  END::DATE;
$$ LANGUAGE SQL IMMUTABLE STRICT;

COMMENT ON FUNCTION stats.parse_time_period_end(TEXT) IS
  'Universal SDMX TIME_PERIOD text → inclusive END-of-period DATE (the LAST day of the period). Companion to stats.parse_time_period (start anchor); end(p) = start(p) + one period - 1 day. Full frequency set A/S/Q/W/M/D. IMMUTABLE STRICT. Unknown formats → NULL. Use for inclusive upper bounds in range reads: time_period_date <= parse_time_period_end($to).';
