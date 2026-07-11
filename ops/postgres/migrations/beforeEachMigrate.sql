-- ════════════════════════════════════════════════════════════════════════
-- beforeEachMigrate.sql — Flyway CALLBACK (NOT a versioned migration)
-- ════════════════════════════════════════════════════════════════════════
-- ADR-035 root-cause fix. Seeds the STRUCTURAL codelist members that V33's
-- corrections depend on but which were historically minted by the canonical
-- REGIONAL_GVA / ACCOUNTS_SEQUENCE ingest — geo `_T`+`R2..R12`, sector
-- `_T`+activities, and the SNA `account` members. Doing this as a callback (which
-- executes before each versioned migration on a fresh boot, once the schema is
-- ready) is the ONLY forward-only lever that runs BEFORE V33 without editing any
-- applied migration: V1..V38 are frozen (checksum-stable law), and any NEW
-- migration is >= V39 → would run AFTER V33 → could not stop V33's first-pass
-- RAISE. See ADR-035 for the full reasoning and the `claimed_at` (V37) trap this
-- also dissolves.
--
-- WHY THESE MEMBERS ARE STRUCTURE (not data): an SDMX codelist is structure —
-- V7's own stated principle ("structure = migrations; high-volume bundle-derived
-- data = the seed"). The geo/sector/account CODE LISTS are low-volume, declarative
-- and stable; only the OBSERVATIONS keyed on them are high-volume ingest data.
-- V33 encodes corrections onto these members (geo/sector `parent_code='_T'`
-- roll-up in §5c/§6b; the `account` `order`/display in §4). On a fresh single
-- `flyway migrate` those members do not yet exist (V5 seeds only geo GE/GE-TB/
-- GE-KA), so:
--   • V33 §7's `IF n_geo_regions < 11 THEN RAISE` HALTS the whole migrate, and
--   • §4/§6 would silently no-op (their targets absent) → the account/sector
--     corrections would be permanently lost in a migrate-then-ingest ordering.
-- Seeding all three here makes a single uncapped `flyway migrate` reach V38 clean
-- AND makes the subsequent canonical ingest purely ADDITIVE (facts only) — the
-- interleave (ADR-035 Phases 1-4) collapses to `migrate → ingest`.
--
-- ── WHY THIS IS A PURE NO-OP ON AN ALREADY-MIGRATED DB (prod / staging) ──────
--   • It is a CALLBACK, not a versioned migration → it is NOT in Flyway's
--     schema_history version chain. `flyway validate` (which only compares applied
--     migrations to their files) is UNAFFECTED → stays green on prod/staging.
--     beforeEachMigrate runs ONLY during `migrate`, and ONLY before a migration
--     that is actually being applied — so on a fully-migrated line with no pending
--     migration it never even executes.
--   • When it DOES execute on a populated line (e.g. before a future V39), every
--     member already exists → the `WHERE NOT EXISTS` guard makes every INSERT a
--     no-op. It is EXISTENCE-guarded (seed-if-missing): it never compares labels,
--     never revises (no SCD-2 close), never updates, never deletes. It therefore
--     cannot clobber a prod label that differs from canonical, and cannot break an
--     already-migrated DB. If any of these guarantees could fail on prod, this
--     file would be wrong — it is deliberately additive-and-idempotent only.
--
-- ── ORDERING SAFETY (the V23 code_path trigger + V18/V24 acyclicity guard) ────
--   Guard 2 below makes the seed body run ONLY once `stats.classifier.parent_code`
--   exists — i.e. only from the pass AFTER V23. So the seed NEVER runs before V23:
--   when it fires, the code_path trigger (V23) and the acyclicity guard (V18→V24)
--   are already present and correct, the V6 SCD-2 columns + partial-unique exist,
--   the V18 blanket-unique is dropped, the V14 locale-completeness trigger is live,
--   and the geo/sector/account dimensions exist (V7). Additionally, every member is
--   seeded FLAT (parent_code = NULL, exactly as the canonical CL_* sheets declare
--   them): a NULL parent means the code_path trigger materializes code_path = the
--   member's own sanitised code (no parent lookup) and the cycle guard returns
--   immediately (no chain walk). There is therefore NO parent/code_path
--   interdependency AT SEED TIME — the roll-up hierarchy (`parent_code='_T'`) is
--   stamped later by V33 §5c/§6b, where `_T` already exists as a seeded root,
--   exactly as it was stamped on prod after the Phase-2 ingest. This is the
--   resolution of the flagged before-V23 ordering risk: gate past V23, seed flat.
--
-- ── SOURCE OF TRUTH ──────────────────────────────────────────────────────────
--   Codes, bilingual (ka/en) labels and order are the EXACT canonical CL_* values:
--     geo/sector  → DATA/canonical/REGIONAL_GVA.xlsx  (CL_GEO, CL_SECTOR)
--     account     → DATA/canonical/ACCOUNTS_SEQUENCE.xlsx (CL_ACCOUNT)
--   Matching them exactly is load-bearing: the later ingest's upsertClassifier
--   closes+re-inserts a member ONLY when the label DIFFERS; identical labels ⇒
--   `ON CONFLICT (dim_code, code) WHERE is_current DO NOTHING` ⇒ the ingest is a
--   convergent no-op on these members (no SCD-2 churn, parent_code preserved).
--   Labels carry BOTH active locales so the V14 completeness trigger passes.
-- ════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  -- Guard 1 — skip the pre-V4 passes on a fresh DB (the table isn't created yet).
  IF to_regclass('stats.classifier') IS NULL THEN
    RETURN;
  END IF;

  -- Guard 2 — skip until the V33-era shape is present. parent_code is added by V23;
  -- before it, the SCD-2 / code_path machinery V33 relies on isn't live and seeding
  -- would be premature. Once it exists, everything the seed touches is in place.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'stats'
       AND table_name   = 'classifier'
       AND column_name  = 'parent_code'
  ) THEN
    RETURN;
  END IF;

  -- Seed-if-missing. FLAT (parent_code left NULL); V33 stamps the hierarchy/order.
  -- valid_from = today, is_current = true (mirrors the ingest writer, upsert.ts).
  -- Correlated NOT EXISTS on (dim_code, code, is_current) = arbiter-independent,
  -- label-agnostic idempotency (works before/after V18's unique-index swap, and is
  -- a no-op on any DB where the current member already exists).
  INSERT INTO stats.classifier (dim_code, code, label, ord, valid_from, is_current)
  SELECT s.dim_code, s.code, s.label::jsonb, s.ord, now()::date, true
    FROM (VALUES
      -- ── geo (REGIONAL_GVA CL_GEO) — _T national total + the 11 regions R2..R12 ──
      ('geo', '_T',  '{"ka":"საქართველო","en":"Georgia"}',                                                     1),
      ('geo', 'R2',  '{"ka":"თბილისი","en":"Tbilisi"}',                                                        2),
      ('geo', 'R3',  '{"ka":"აჭარის ა.რ.","en":"Adjara A.R."}',                                                3),
      ('geo', 'R4',  '{"ka":"გურია","en":"Guria"}',                                                            4),
      ('geo', 'R5',  '{"ka":"იმერეთი","en":"Imereti"}',                                                        5),
      ('geo', 'R6',  '{"ka":"კახეთი","en":"Kakheti"}',                                                         6),
      ('geo', 'R7',  '{"ka":"მცხეთა-მთიანეთი","en":"Mtskheta-Mtianeti"}',                                      7),
      ('geo', 'R8',  '{"ka":"რაჭა-ლეჩხუმი და ქვემო სვანეთი","en":"Racha-Lechkhumi and Kvemo Svaneti"}',        8),
      ('geo', 'R9',  '{"ka":"სამეგრელო-ზემო სვანეთი","en":"Samegrelo-Zemo Svaneti"}',                          9),
      ('geo', 'R10', '{"ka":"სამცხე-ჯავახეთი","en":"Samtskhe-Javakheti"}',                                    10),
      ('geo', 'R11', '{"ka":"ქვემო ქართლი","en":"Kvemo Kartli"}',                                             11),
      ('geo', 'R12', '{"ka":"შიდა ქართლი","en":"Shida Kartli"}',                                              12),
      -- ── sector (REGIONAL_GVA CL_SECTOR) — _T all-activities + the NACE activities ──
      ('sector', '_T',  '{"ka":"ყველა საქმიანობა","en":"All activities (total)"}',                              1),
      ('sector', '1',   '{"ka":"სოფლის, სატყეო და თევზის მეურნეობა","en":"Agriculture, forestry and fishing"}', 2),
      ('sector', '3',   '{"ka":"დამამუშავებელი მრეწველობა","en":"Manufacturing"}',                              3),
      ('sector', '6',   '{"ka":"მშენებლობა","en":"Construction"}',                                              4),
      ('sector', '7',   '{"ka":"საბითუმო და საცალო ვაჭრობა; ავტომობილების და მოტოციკლების რემონტი","en":"Wholesale and retail trade; repair of motor vehicles and motorcycles"}', 5),
      ('sector', '8',   '{"ka":"ტრანსპორტი და დასაწყობება","en":"Transportation and storage"}',                 6),
      ('sector', '12',  '{"ka":"უძრავ ქონებასთან დაკავშირებული საქმიანობები","en":"Real estate activities"}',   7),
      ('sector', '15',  '{"ka":"სახელმწიფო მმართველობა და თავდაცვა; სავალდებულო სოციალური უსაფრთხოება","en":"Public administration and defence; compulsory social security"}', 8),
      ('sector', '16',  '{"ka":"განათლება","en":"Education"}',                                                  9),
      ('sector', 'OTH', '{"ka":"სხვა დანარჩენი","en":"Other"}',                                                10),
      -- ── account (ACCOUNTS_SEQUENCE CL_ACCOUNT) — the SNA sequence of accounts ──
      ('account', 'production-account',                       '{"ka":"წარმოების ანგარიში","en":"Production Account"}',                              1),
      ('account', 'generation-of-income-account',             '{"ka":"შემოსავლების ფორმირების ანგარიში","en":"Generation of income Account"}',      2),
      ('account', 'allocation-of-primary-income-account',     '{"ka":"პირველადი შემოსავლების განაწილების ანგარიში","en":"Allocation of Primary Income Account"}',   3),
      ('account', 'secondary-distribution-of-income-account', '{"ka":"შემოსავლების მეორადი განაწილების ანგარიში","en":"Secondary Distribution of Income Account"}', 4),
      ('account', 'use-of-disposable-income-account',         '{"ka":"შემოსავლების გამოყენების ანგარიში","en":"Use of Disposable Income Account"}',  5),
      ('account', 'capital-account',                          '{"ka":"კაპიტალის ანგარიში","en":"Capital Account"}',                                 6)
    ) AS s(dim_code, code, label, ord)
   WHERE NOT EXISTS (
     SELECT 1
       FROM stats.classifier c
      WHERE c.dim_code = s.dim_code
        AND c.code     = s.code
        AND c.is_current
   );
END;
$$;
