-- ════════════════════════════════════════════════════════════════════════
-- V34__gdp_dsd_approach_align.sql — align GDP_ANNUAL DSD to the CANONICAL
--                                    4-dim shape [measure, approach, time, geo]
-- ════════════════════════════════════════════════════════════════════════
-- WHAT THIS ADDS (and WHY) — ADDITIVE / corrective; V1-V33 are applied + immutable.
--
--   THE GAP (fresh-provision reproducibility bug, flagged during the live cutover).
--   V5 + V7 pre-register GDP_ANNUAL with the OLD 3-dim DSD [measure, time, geo].
--   The platform's REAL demo data is the CANONICAL 4-dim GDP — series key
--   { measure, approach, geo }, time axis — produced by the canonical workbook
--   DATA/canonical/GDP_ANNUAL.xlsx (DSD dimensions [time, approach, measure, geo]).
--   approach is a FIRST-CLASS fact dimension (production / expenditure / income /
--   total → _Z), NOT classifier metadata of measure (the V7 modelling was wrong:
--   it carried approach as a measure attribute, so the GDP cube could not be sliced
--   by approach the way the production / expenditure / income panels require).
--
--   THE BREAK on a fresh `compose up`:
--     1. flyway applies V1..V34 → V7 registers 3-dim GDP.
--     2. the canonical GDP_ANNUAL.xlsx (4-dim) is ingested at bring-up. The route's
--        compat pre-pass (apps/api/.../ingest/canonical/compat.ts) sees the dim SET
--        differ by +approach → DSD_INCOMPATIBLE *error* (DSD = FULL-governed) and
--        BLOCKS the ingest — unless a dataset_version is minted out of band. The
--        live cutover worked around this manually with `?datasetVersion=` (a governed
--        widen). A fresh provision has no such manual step → GDP never lands 4-dim.
--     3. the (now-neutralized) R__ seed used to ALSO write a conflicting 3-dim GDP
--        DSD + facts, which fail the V22 set-equality dim_key trigger once the live
--        DSD is 4-dim. (R__ is neutralized from the prod flyway location in this
--        same change set — see ops/compose/docker-compose.prod.yml.)
--
--   THE FIX — make the PRE-REGISTERED GDP DSD already match the canonical workbook,
--   so the canonical ingest is a ROUTINE compat (no version mint, no manual step)
--   and the V22 dim_key trigger accepts 4-dim GDP facts. This is the forward-migration
--   form of the live `?datasetVersion=` widen: it lands the SAME structural change
--   (the +approach dim, ord realigned to the canonical [measure, approach, time, geo]
--   order) deterministically on EVERY fresh DB. We do NOT edit V5/V7 (immutable, an
--   applied migration is never altered — checksum + append-only contract); we add the
--   `approach` row to stats.dataset_dimension and realign ord here.
--
--   WHY A MIGRATION (not the seed / not the workbook): the GDP DSD is STRUCTURE
--   (declarative, stable, low-volume) — V7's own stated principle ("structure =
--   migrations; high-volume bundle-derived data = the seed/ingest"). The DATA (the
--   real GDP facts + classifier members) still arrives the canonical way, through
--   the ingest pipeline from DATA/canonical/GDP_ANNUAL.xlsx (the demo-data SSOT).
--   This migration only declares the cube SHAPE the canonical workbook expects.
--
--   The `approach` DIMENSION (the axis row) already exists from V7
--   (stats.dimension 'approach', ord 4) — this only declares GDP_ANNUAL's USE of it.
--
-- ── 09 §B RISK GATE (Class-M migration) ──────────────────────────────────
--   Reversibility : MOSTLY TWO-WAY. Adding the approach DSD row + realigning ord is
--                   additive/droppable (see Rollback). The one-way aspect is purely
--                   data-dependent: once 4-dim GDP facts exist, dropping the approach
--                   DSD row would orphan their dim_key — but on a FRESH DB at migrate
--                   time NO GDP facts exist yet (V5/V7 declare structure only; facts
--                   arrive via the post-migrate ingest), so this migration runs against
--                   an EMPTY GDP fact set. Adding a key dim to a cube that already holds
--                   3-dim facts WOULD violate the V22 set-equality trigger on the next
--                   write — hence the guard below: it refuses to widen if any 3-dim GDP
--                   fact is present (fail-fast; that DB must re-ingest 4-dim, not widen
--                   under live 3-dim facts).
--   Blast radius  : LOW. stats.dataset_dimension is a PLAIN table (no hypertable).
--                   stats.observation is NOT touched. The widen affects only the GDP_ANNUAL
--                   DSD contract that future writes validate against.
--   Pre-flight    : the INSERT is ON CONFLICT DO NOTHING / the ord UPDATEs re-converge
--                   (same values on re-run) → re-running V34 is a no-op. The guard
--                   asserts no pre-existing 3-dim GDP fact before widening.
--   Rollback plan :
--                   -- (only safe while GDP_ANNUAL holds NO 4-dim facts)
--                   DELETE FROM stats.dataset_dimension
--                     WHERE dataset_code='GDP_ANNUAL' AND dim_code='approach';
--                   UPDATE stats.dataset_dimension SET ord=1 WHERE dataset_code='GDP_ANNUAL' AND dim_code='time';
--                   UPDATE stats.dataset_dimension SET ord=2 WHERE dataset_code='GDP_ANNUAL' AND dim_code='geo';
--                   -- (restores the V5 3-dim ord ladder measure=1, time=2, geo=3)
--
-- Idempotent: INSERT … ON CONFLICT DO NOTHING; UPDATE … re-converges. No V1-V33
-- object is dropped or altered.
-- ════════════════════════════════════════════════════════════════════════

-- ── 0. Fail-fast guard — refuse to widen a cube that already holds 3-dim GDP facts ──
-- On a fresh DB (the target case) GDP_ANNUAL has ZERO facts at migrate time, so this
-- passes silently. If a DB already carries 3-dim GDP facts (e.g. an old R__-seeded
-- cube that was never cut over), widening the DSD here would make the V22 set-equality
-- trigger reject those rows on their next touch — that DB must RE-INGEST the canonical
-- 4-dim GDP, not be silently widened. Surface it instead of corrupting the contract.
DO $$
DECLARE
  n_legacy_gdp INT;
BEGIN
  SELECT COUNT(*) INTO n_legacy_gdp
    FROM stats.observation
   WHERE dataset_code = 'GDP_ANNUAL'
     AND NOT (dim_key ? 'approach');   -- a 3-dim (pre-approach) GDP fact
  IF n_legacy_gdp > 0 THEN
    RAISE EXCEPTION
      'V34: GDP_ANNUAL already holds % observation(s) WITHOUT approach in dim_key. '
      'Widening the DSD to 4-dim would invalidate them against the V22 dim_key trigger. '
      'Re-ingest the canonical 4-dim GDP (DATA/canonical/GDP_ANNUAL.xlsx) on this DB '
      'instead of applying this widen under legacy 3-dim facts.', n_legacy_gdp;
  END IF;
END;
$$;


-- ── 1. Declare GDP_ANNUAL's use of the `approach` dimension (the +approach widen) ──
-- The canonical series key is { measure, approach, geo } (time is the time axis). We
-- realign ord to the canonical STRUCTURE order [measure, approach, time, geo] so the
-- served dim DISPLAY order matches the workbook (the compat check compares the dim SET,
-- not ord — ord is the display contract). measure stays ord 0 (V5: measure=1, but R__/
-- the canonical shape index from 0; we converge the whole ladder to the canonical order
-- below so the result is unambiguous regardless of the V5 vs R__ base ord).
INSERT INTO stats.dataset_dimension (dataset_code, dim_code, is_time_dim, ord)
  VALUES ('GDP_ANNUAL', 'approach', false, 1)
  ON CONFLICT (dataset_code, dim_code) DO NOTHING;


-- ── 2. Realign the full ord ladder to the canonical order [measure, approach, time, geo] ──
-- Idempotent: each UPDATE only fires when the ord is not already canonical.
UPDATE stats.dataset_dimension SET ord = 0
  WHERE dataset_code = 'GDP_ANNUAL' AND dim_code = 'measure'  AND ord IS DISTINCT FROM 0;
UPDATE stats.dataset_dimension SET ord = 1
  WHERE dataset_code = 'GDP_ANNUAL' AND dim_code = 'approach' AND ord IS DISTINCT FROM 1;
UPDATE stats.dataset_dimension SET ord = 2
  WHERE dataset_code = 'GDP_ANNUAL' AND dim_code = 'time'     AND ord IS DISTINCT FROM 2;
UPDATE stats.dataset_dimension SET ord = 3
  WHERE dataset_code = 'GDP_ANNUAL' AND dim_code = 'geo'      AND ord IS DISTINCT FROM 3;


-- ── 3. Post-condition (read-only assertion — fail fast if the shape is wrong) ──
DO $$
DECLARE
  dims TEXT;
BEGIN
  SELECT string_agg(dim_code, ',' ORDER BY ord) INTO dims
    FROM stats.dataset_dimension
   WHERE dataset_code = 'GDP_ANNUAL';
  IF dims IS DISTINCT FROM 'measure,approach,time,geo' THEN
    RAISE EXCEPTION 'V34: GDP_ANNUAL DSD = "%", expected "measure,approach,time,geo"', dims;
  END IF;
END;
$$;
