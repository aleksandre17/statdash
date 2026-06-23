-- ════════════════════════════════════════════════════════════════════════
-- V30__seed_concept_role.sql — set SDMX concept_role on the seed dimensions,
--                              (re)run the V27 concept backfill + bind, AND close
--                              the V29 category acyclicity gap (§4)
-- ════════════════════════════════════════════════════════════════════════
-- WHAT THIS ADDS (and WHY) — pure DATA correction; all ADDITIVE. V1-V29 are
-- applied + immutable and are NOT edited.
--
--   THE GAP — the seed dimensions (measure/time/geo from V5; approach/account/
--   side/sector from V7) were seeded with NULL concept_role. V18 added the
--   stats.dimension.concept_role column; V27 then PROMOTES the role to its SSOT
--   (stats.concept) by BACKFILLING one concept per role-typed dimension and
--   binding the dimension to it. But V27's backfill reads concept_role at APPLY
--   time — and because every seed dimension had NULL concept_role, V27 seeded
--   ZERO concepts and bound ZERO dimensions. The cube therefore has an empty
--   stats.concept table, so:
--     · concept-scheme.fitness ("a bound dimension resolves its role through the
--       concept") has nothing to resolve through, and
--     · cube-profile's conceptRole = COALESCE(concept.role, dim.role) silently
--       falls back to the dimension alias for every dimension (the concept SSOT
--       never wins) — the P1-A separation is inert.
--
--   THE DECISION — set concept_role on the seed dimensions to their correct SDMX
--   roles (the dimensions genuinely HAVE these roles; the seed merely never set
--   them), then RE-RUN the V27 backfill + bind logic so stats.concept is
--   populated and each role-typed dimension is bound to its concept. Because V27
--   already ran (and is immutable), re-populating concept_role in an EDITED V5/V7
--   would (a) break the Flyway checksum of an applied migration and (b) not
--   re-trigger V27 anyway. A NEW migration that both sets the roles AND re-runs
--   the idempotent backfill is the correct, checksum-safe, order-independent fix.
--
--   ROLE ASSIGNMENT (SDMX concept roles, the V18/V27 closed vocabulary):
--     measure  → 'measure'         (the quantitative measure axis — SUM/AVG valid)
--     time     → 'time'            (the time dimension — exactly one per DSD)
--     geo      → 'geo'             (the spatial dimension)
--     approach → 'classification'  (GDP production/expenditure/income — classifies)
--     account  → 'classification'  (SNA sequence account — classifies)
--     side     → 'classification'  (resources/uses — classifies the account entry)
--     sector   → 'classification'  (NACE-style activity sector — classifies)
--   Rationale: a dimension whose members partition/categorise the facts is a
--   'classification' (SDMX classification codelist), NOT an 'attribute' (which is
--   a non-key metadata qualifier that never appears in a dim_key). approach/
--   account/side/sector are all KEY dimensions (they sit in dataset_dimension and
--   in dim_key — see V7), so they classify, they do not attribute. measure/time/
--   geo take their canonical SDMX cross-domain roles.
--
--   IDEMPOTENT — the UPDATEs only set still-NULL concept_role (a dimension already
--   classified by authoring is left alone); the backfill mirrors V27 verbatim
--   (INSERT … ON CONFLICT DO NOTHING; bind only still-NULL bindings). Re-run
--   converges to the same state. NO concept name is hardcoded in the backfill
--   (Law 1 — it reads dimension.concept_role DATA, exactly as V27).
--
-- ── 09 §B RISK GATE (Class-M migration — TWO-WAY reversible) ─────────────
--   Reversibility : TWO-WAY. This migration only (a) sets a previously-NULL
--                   nullable column on a PLAIN table (stats.dimension.concept_role,
--                   under the V18 CHECK), (b) INSERTs rows into the two V27 PLAIN
--                   tables (stats.concept_scheme / stats.concept), and (c) sets the
--                   nullable concept binding on stats.dimension. It alters NO
--                   existing column type/constraint, drops nothing, and touches NO
--                   V1-V29 object definition. Rollback = NULL the concept_role +
--                   binding it set and delete the seeded concepts (re-derivable on
--                   re-apply).
--   Blast radius  : NONE on the hot path. stats.observation is NOT touched (no
--                   trigger, no column, no partition/compression change). The cube's
--                   write path is byte-for-byte unchanged. The only behavioural
--                   change is that conceptRole now resolves THROUGH the concept SSOT
--                   for the seed dimensions (the intended P1-A activation), and the
--                   dimension.concept_role alias agrees with it (no drift — asserted
--                   below, the same gate V27 runs).
--   V4 dim_key    : UNAFFECTED. concept_role is metadata on the dimension; it is not
--                   part of dim_key, the DSD validation (validate_observation_dim_key),
--                   or any unique index. Setting it cannot change which observations
--                   validate.
--   i18n          : the backfilled stats.concept rows carry label '{}' (filled by
--                   provisioning) — same posture as V27; stats.concept is NOT wired
--                   to the V13 completeness trigger, so '{}' is accepted.
--   Rollback plan : UPDATE stats.dimension
--                     SET concept_scheme_code = NULL, concept_code = NULL
--                   WHERE concept_scheme_code = 'CROSS_DOMAIN'
--                     AND code IN ('measure','time','geo','approach','account','side','sector');
--                   UPDATE stats.dimension SET concept_role = NULL
--                   WHERE code IN ('measure','time','geo','approach','account','side','sector');
--                   DELETE FROM stats.concept
--                   WHERE scheme_code = 'CROSS_DOMAIN'
--                     AND code IN ('measure','time','geo','approach','account','side','sector');
--                   -- (leave stats.concept_scheme 'CROSS_DOMAIN' — harmless if empty;
--                   --  re-derived on the next apply.)
--
-- Idempotent: UPDATE … WHERE concept_role IS NULL · INSERT … ON CONFLICT DO NOTHING ·
-- bind UPDATE only on still-NULL bindings. Re-run = no-op. Never edits a V1-V29 object.
-- ════════════════════════════════════════════════════════════════════════


-- ════════════════════════════════════════════════════════════════════════
-- 1. Set concept_role on the seed dimensions (only where still NULL)
-- ════════════════════════════════════════════════════════════════════════
-- The dimension code IS the identity; the role is the correction. Only touches
-- dimensions whose concept_role is still NULL (authoring that already classified a
-- dimension is never overwritten — re-run / pre-authored safe). The values are
-- members of the V18 dimension_concept_role_chk vocabulary, so the CHECK holds.
UPDATE stats.dimension SET concept_role = 'measure'
 WHERE code = 'measure'  AND concept_role IS NULL;
UPDATE stats.dimension SET concept_role = 'time'
 WHERE code = 'time'     AND concept_role IS NULL;
UPDATE stats.dimension SET concept_role = 'geo'
 WHERE code = 'geo'      AND concept_role IS NULL;
UPDATE stats.dimension SET concept_role = 'classification'
 WHERE code = 'approach' AND concept_role IS NULL;
UPDATE stats.dimension SET concept_role = 'classification'
 WHERE code = 'account'  AND concept_role IS NULL;
UPDATE stats.dimension SET concept_role = 'classification'
 WHERE code = 'side'     AND concept_role IS NULL;
UPDATE stats.dimension SET concept_role = 'classification'
 WHERE code = 'sector'   AND concept_role IS NULL;


-- ════════════════════════════════════════════════════════════════════════
-- 2. (RE)RUN the V27 concept backfill + bind — now that roles exist
-- ════════════════════════════════════════════════════════════════════════
-- Verbatim mirror of V27 §4 (Law 1: no hardcoded concept name — reads concept_role
-- DATA). V27's own run seeded nothing (roles were NULL); this re-run picks up the
-- roles set in §1. The default ConceptScheme + one concept per role-typed dimension
-- (code = dimension code), then bind each still-unbound role-typed dimension to its
-- concept. All idempotent.
DO $$
DECLARE
  default_scheme CONSTANT TEXT := 'CROSS_DOMAIN';
BEGIN
  IF EXISTS (SELECT 1 FROM stats.dimension WHERE concept_role IS NOT NULL) THEN
    INSERT INTO stats.concept_scheme (code, agency, version, label, metadata)
    VALUES (
      default_scheme, 'SDMX', '1.0',
      '{}'::jsonb,
      jsonb_build_object('seeded_by', 'V30-concept-backfill')
    )
    ON CONFLICT (code) DO NOTHING;

    INSERT INTO stats.concept (scheme_code, code, label, concept_role, metadata)
    SELECT
      default_scheme,
      d.code,
      '{}'::jsonb,
      d.concept_role,
      jsonb_build_object('seeded_by', 'V30-concept-backfill')
    FROM stats.dimension d
    WHERE d.concept_role IS NOT NULL
    ON CONFLICT (scheme_code, code) DO NOTHING;

    UPDATE stats.dimension d
       SET concept_scheme_code = default_scheme,
           concept_code        = d.code
     WHERE d.concept_role IS NOT NULL
       AND d.concept_scheme_code IS NULL
       AND d.concept_code        IS NULL
       AND EXISTS (
         SELECT 1 FROM stats.concept c
          WHERE c.scheme_code = default_scheme AND c.code = d.code
       );
  END IF;
END;
$$;


-- ════════════════════════════════════════════════════════════════════════
-- 3. NO-DRIFT ASSERTION (read-only) — the same gate V27 §5 runs
-- ════════════════════════════════════════════════════════════════════════
-- The expand-contract invariant: a BOUND dimension's role MUST equal its concept's
-- role. The backfill guarantees this for what it seeded; this fails the migration
-- fast if any bound pair disagrees (e.g. a pre-existing manual binding contradicting
-- the role we just set).
DO $$
DECLARE
  drift INT;
BEGIN
  SELECT COUNT(*) INTO drift
    FROM stats.dimension d
    JOIN stats.concept c
      ON c.scheme_code = d.concept_scheme_code
     AND c.code        = d.concept_code
   WHERE d.concept_role IS DISTINCT FROM c.concept_role;

  IF drift > 0 THEN
    RAISE EXCEPTION
      'V30 no-drift: % bound dimension(s) whose concept_role disagrees with their concept''s role', drift;
  END IF;
END;
$$;


-- ════════════════════════════════════════════════════════════════════════
-- 4. CLOSE THE V29 CATEGORY ACYCLICITY GAP — explicit cycle-prevention trigger
-- ════════════════════════════════════════════════════════════════════════
-- THE GAP — V29 gives stats.category only a CHECK against DIRECT self-parent
-- (category_no_self_parent_chk) and relies on "the path build cannot complete a
-- cycle (the parent's path would be NULL)". That reasoning holds for INSERT of a
-- fresh node, but NOT for RE-PARENTING an existing node into its own descendant:
-- e.g. with root A and child B (path 'A.B'), UPDATE A SET parent_code='B' builds
-- A.category_path = B.path || 'A' = 'A.B.A' WITHOUT error — a 2-node cycle (A→B→A)
-- silently enters. The classifier hierarchy already guards this with V18's
-- trg_classifier_no_cycle; stats.category was missing the equivalent. This closes
-- it with the SAME idiom (walk the ancestor chain; reject if it reaches NEW.code).
--
-- ── 09 §B RISK GATE (this section) ───────────────────────────────────────
--   Reversibility : TWO-WAY. New FUNCTION + new TRIGGER on the V29 PLAIN table
--                   stats.category only. Rollback = DROP TRIGGER + DROP FUNCTION.
--                   No existing object is altered; stats.observation is untouched;
--                   V4 dim_key is untouched (a category is not a cube axis).
--   Blast radius  : LOW. BEFORE INSERT/UPDATE OF parent_code only — a non-parent
--                   write pays nothing. It only REJECTS cycles, which are already
--                   invalid (a category tree must be a DAG); no legal write is newly
--                   blocked. Fires before trg_category_code_path (name sorts earlier:
--                   'trg_category_no_cycle' < 'trg_category_code_path') so a cycle is
--                   caught with a clear message before the path build would bake it in.
--   Rollback plan : DROP TRIGGER IF EXISTS trg_category_no_cycle ON stats.category;
--                   DROP FUNCTION IF EXISTS stats.prevent_category_cycle();
--
-- Walks the parent_code ancestor chain WITHIN THE SAME SCHEME from NEW.parent_code
-- upward; if it reaches NEW.code, the edge would close a cycle → reject. Bounded hop
-- count guards a malformed pre-existing chain (fail fast, never hang). Mirrors
-- stats.prevent_classifier_cycle() (V18) — code-chain variant (parent_code, not
-- parent_id).
CREATE OR REPLACE FUNCTION stats.prevent_category_cycle()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  ancestor_code TEXT;
  hops          INT := 0;
BEGIN
  IF NEW.parent_code IS NULL THEN
    RETURN NEW;
  END IF;

  ancestor_code := NEW.parent_code;
  -- Bounded walk: a real taxonomy is shallow; 10000 hops is far beyond any depth,
  -- so a runaway loop (a pre-existing malformed chain) fails fast instead of hanging.
  WHILE ancestor_code IS NOT NULL AND hops < 10000 LOOP
    IF ancestor_code = NEW.code THEN
      RAISE EXCEPTION
        'category_cycle: setting (scheme_code=%, code=%) parent_code=% would create a cycle',
        NEW.scheme_code, NEW.code, NEW.parent_code;
    END IF;
    SELECT parent_code INTO ancestor_code
      FROM stats.category
     WHERE scheme_code = NEW.scheme_code AND code = ancestor_code;
    hops := hops + 1;
  END LOOP;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION stats.prevent_category_cycle() IS
  'BEFORE INSERT/UPDATE OF parent_code guard on stats.category: walks the parent_code ancestor chain within the scheme; rejects with a clear category_cycle message if it reaches NEW.code. Closes the V29 gap where re-parenting a node into its own descendant (A→B→A) slipped past the path build. Mirrors stats.prevent_classifier_cycle() (V18), code-chain variant. Bounded hop count guards a malformed chain.';

DROP TRIGGER IF EXISTS trg_category_no_cycle ON stats.category;
CREATE TRIGGER trg_category_no_cycle
  BEFORE INSERT OR UPDATE OF parent_code ON stats.category
  FOR EACH ROW EXECUTE FUNCTION stats.prevent_category_cycle();

COMMENT ON TRIGGER trg_category_no_cycle ON stats.category IS
  'Rejects a parent_code edge that would create a cycle in the category tree. Name sorts before trg_category_code_path so the cycle is caught with a clear message BEFORE the path materialization would bake it in. BEFORE INSERT/UPDATE OF parent_code — a non-parent write costs nothing. Closes the V29 acyclicity gap (re-parent into own descendant).';
