-- ════════════════════════════════════════════════════════════════════════
-- V33__demo_classifier_data.sql — classifier DATA the demo page configs need
-- ════════════════════════════════════════════════════════════════════════
-- WHAT THIS ADDS (and WHY) — all ADDITIVE / corrective; V1-V32 are applied +
-- immutable. This seeds the missing/duplicated CLASSIFIER DATA the surviving
-- demo page configs (apps/api/provisioning/geostat.provisioning.json) reference
-- but which is absent or polluted in the live cube, so the ACCOUNTS and REGIONAL
-- panels render at OLD-version parity. Two gaps, one migration:
--
--   GAP 1 — the `aggregates` virtual classifier (ACCOUNTS).
--     The accounts hero / per-account pipe does:
--       join   { fields:['order'],    on:'account', with:{$cl:'account'} }
--       join   { fields:['isClosing'],on:'measure',  with:{$cl:'aggregates'} }
--       sort   by order, side, seqPos, isClosing
--       lookup { fields:['label','color'], from:{$d:'aggregates'}, key:'measure' }
--       lookup { fields:['label','color'], from:{$d:'account'},    key:'account' }
--     `/api/stats/classifiers/aggregates` returns {data:[]} today — the classifier
--     does not exist. The OLD static app supplied it as a virtual MEASURE-classifier
--     keyed to the SNA balancing-item codes (git 7a47e5d^:apps/geostat/src/data/
--     accounts/raw.ts ACCOUNTS_CLASSIFIERS.aggregates + ACCOUNTS_DISPLAY.aggregates),
--     carrying isClosing (whether the item is the closing balance of its account),
--     label and color. V33 seeds it keyed to the NEW canonical measure codes
--     (B1G, B2G_B3G, D4_D1, D5, … — confirmed from DATA/canonical/
--     ACCOUNTS_SEQUENCE.xlsx CL_MEASURE and the live stats.observation), NOT the
--     OLD normalized codes (the OLD CODE_MAP B2g+B3g→B2G is superseded by the
--     canonical CL_MEASURE codes).
--
--     WHERE isClosing LIVES so {$cl:'aggregates'} reads it: stats.classifier.metadata
--     (the open SDMX attribute bag, V8). The classifiers API route GET /:dim_code
--     (apps/api/src/routes/stats/classifiers.ts) returns `metadata` in the row
--     projection; the engine's $cl resolver (resolveClassifierRef → codelistOf,
--     packages/core/src/data/codelist.ts) returns the entry verbatim and the stats
--     adapter (fromStatsClassifiers) spreads metadata onto the entry — so the
--     join's `isClosing` field resolves from metadata.isClosing. The same home
--     carries the SNA `account` linkage (metadata.account), exactly the OLD
--     `aggregates[].account` ATTRIBUTE — it is an attribute, NOT a hierarchy edge
--     (the OLD list was flat per account), so parent_code stays NULL for aggregates.
--
--     label/color for {$d:'aggregates'} go to stats.classifier_display (V6) per
--     locale (the display SSOT the GET /:dim_code/display route joins). A color is
--     ALSO mirrored onto stats.classifier.color (the route's fallback) so a missing
--     overlay never strands a member without a color.
--
--   GAP 1b — the `account` classifier `order` + display.
--     The hero sorts by:'order' from join {$cl:'account'} fields:['order']. The
--     account members exist (V7-seeded via canonical ingest) with the correct `ord`
--     1..6 but NO `order` field on the entry and an EMPTY metadata/display. V33
--     stamps metadata.order = ord (so the `order` field surfaces on the entry) and
--     seeds the account display overlay (label/color → accountLabel/accountColor).
--
--   GAP 2 — de-duplicate the `geo` classifier (REGIONAL) + SDMX hierarchy.
--     The geo codelist carries each region as BOTH an ISO code (GE-TB, GE-KA) and
--     the canonical Rn code (R2, R6) that the facts actually use — duplicate,
--     conflicting members polluting {$d:'geo'}'s by-code index and the map. The
--     REGIONAL_GVA facts use _T + R2..R12 (confirmed live); GDP_ANNUAL facts use
--     the national GE. So: RETIRE the ISO duplicates GE-TB / GE-KA (SCD-2 close,
--     never DELETE — data outlives code), KEEP GE (load-bearing for GDP) and
--     _T + R2..R12 (load-bearing for REGIONAL). The ISO↔Rn mapping is the map's
--     geoCodeMap/display concern, NOT the codelist.
--     EXCEED-the-old: seed a proper SDMX hierarchy — _T as the parent of R2..R12
--     via parent_code — so the map can roll up (national total) / drill down
--     (per region), richer than the OLD flat list. Same idea for `sector`:
--     _T (All activities) as parent of the activity codes + OTH.
--
-- ── 09 §B RISK GATE (Class-M migration) ──────────────────────────────────
--   Reversibility : MOSTLY TWO-WAY. The aggregates dimension + members + displays
--                   and the account/geo/sector metadata/display/parent_code updates
--                   are additive and droppable (see Rollback). The ONE corrective
--                   step is the SCD-2 RETIRE of geo GE-TB/GE-KA: it sets
--                   is_current=false + valid_to=now() — reversible by reopening
--                   (is_current=true, valid_to=NULL) as long as no NEW current row
--                   for those codes was minted in between (none is here). No row is
--                   deleted; history is preserved.
--   Blast radius  : LOW. stats.classifier / classifier_display / dimension are
--                   PLAIN tables (no hypertable). stats.observation is NOT touched —
--                   no fact references aggregates (it is a virtual lookup keyed to
--                   the measure code) and ZERO facts reference GE-TB/GE-KA (verified
--                   live: 0 observations). The geo/sector parent_code updates fire
--                   trg_classifier_code_path (materialize code_path) + the V18
--                   acyclicity guard — both attach children to an existing current
--                   root (_T), so no cycle, no missing-parent raise.
--   Pre-flight    : every INSERT is ON CONFLICT DO NOTHING / idempotent UPSERT;
--                   every UPDATE re-converges (same values on re-run). Re-running
--                   V33 is a no-op. Labels carry BOTH active locales (ka, en) so the
--                   V14 enforce_locale_string completeness trigger passes.
--   Rollback plan :
--                   -- aggregates
--                   DELETE FROM stats.classifier_display WHERE member_id IN
--                     (SELECT id FROM stats.classifier WHERE dim_code='aggregates');
--                   DELETE FROM stats.classifier WHERE dim_code='aggregates';
--                   DELETE FROM stats.dimension  WHERE code='aggregates';
--                   -- account/geo/sector overlays + metadata (reset to pre-V33)
--                   DELETE FROM stats.classifier_display WHERE member_id IN
--                     (SELECT id FROM stats.classifier
--                       WHERE dim_code IN ('account','geo','sector'));
--                   UPDATE stats.classifier SET metadata='{}'::jsonb, color=NULL
--                     WHERE dim_code IN ('account','geo','sector');
--                   UPDATE stats.classifier SET parent_code=NULL
--                     WHERE dim_code IN ('geo','sector');  -- code_path re-materializes
--                   -- reopen the retired ISO geo members
--                   UPDATE stats.classifier SET is_current=true, valid_to=NULL
--                     WHERE dim_code='geo' AND code IN ('GE-TB','GE-KA');
--
-- MECHANISM (workbook+re-ingest vs DB seed — the SSOT decision, justified):
--   The canonical SSOT path (add a sheet to the workbook + POST /api/ingest/
--   canonical) CANNOT carry this data, by three structural facts of the canonical
--   parser (apps/api/src/ingest/canonical/parse.ts):
--     (1) `aggregates` is NOT a DSD dimension of ACCOUNTS_SEQUENCE (its DSD is
--         measure/account/side/time). The parser only emits a CL_<dim> sheet for
--         a dim ∈ dsd.dimensions — a CL_AGGREGATES sheet would never be read.
--     (2) parseCodelist hardcodes `metadata: {}` and reads only code|parent|order|
--         name_<lang>. There is NO carrier for isClosing through a CL sheet — the
--         one datum {$cl:'aggregates'} exists to expose.
--     (3) Re-ingest is ADDITIVE/SCD-2 — it cannot RETIRE the polluting geo ISO
--         duplicates (the GAP 2 correction is destructive-by-design), and the
--         canonical workbooks carry no parent_code, so they cannot add the geo/
--         sector hierarchy either.
--   `aggregates` is STRUCTURAL SNA metadata — declarative, stable, low-volume
--   (19 members) — which by V7's own stated principle ("structure = migrations;
--   high-volume bundle-derived data = the seed") belongs in a versioned migration.
--   Hence: a single additive Flyway migration is the canonical, reviewable home.
--
-- Idempotent throughout: INSERT … ON CONFLICT DO NOTHING / DO UPDATE; UPDATE …
-- re-converges. No V1-V32 object is dropped or altered.
-- ════════════════════════════════════════════════════════════════════════


-- ════════════════════════════════════════════════════════════════════════
-- 1. `aggregates` — the virtual SNA balancing-item classifier (dimension)
-- ════════════════════════════════════════════════════════════════════════
-- A dimension is a ROW (Law 1). `aggregates` is a parallel codelist keyed to the
-- canonical measure codes that annotates each measure with its SNA structural role
-- (which account it belongs to, whether it is that account's closing balance). It
-- is NOT a fact-key dimension (facts key on `measure`); it is the $cl/$d lookup
-- target the accounts pipe joins. concept_role = 'classification' (it classifies
-- measures into SNA structural groups), consistent with V30's role convention for
-- the non-measure/time/geo dims.
INSERT INTO stats.dimension (code, label, ord, concept_role) VALUES
  ('aggregates',
   '{"ka":"აგრეგატები","en":"Aggregates"}',
   8,
   'classification')
ON CONFLICT (code) DO NOTHING;


-- ════════════════════════════════════════════════════════════════════════
-- 2. `aggregates` members — keyed to the CANONICAL measure codes
-- ════════════════════════════════════════════════════════════════════════
-- code        = canonical CL_MEASURE code (B1G, B2G_B3G, D4_D1, D5, D9P, P5G, …)
-- label       = the bilingual CL_MEASURE name (V14 completeness: ka + en)
-- color       = the OLD ACCOUNTS_DISPLAY color, mapped by SNA account family;
--               the two NEW canonical codes (D9P payable, P5G) take their family
--               color (D9P = the payable/outflow red used for D4_PAY/D5_PAY; P5G =
--               the capital-formation magenta of P5).
-- ord         = CL_MEASURE order (the SNA sequence) — also the stable list order.
-- metadata    = { isClosing: <bool>, account: <SNA account code> }.
--               isClosing is read by join {$cl:'aggregates'} fields:['isClosing'];
--               account is the SNA linkage (the OLD aggregates[].account attribute).
-- parent_code = NULL: the OLD list was FLAT per account (account is an attribute,
--               not a hierarchy edge). The hierarchy EXCEED applies to geo/sector.
INSERT INTO stats.classifier (dim_code, code, label, color, ord, metadata) VALUES
  ('aggregates','P1',        '{"ka":"გამოშვება საბაზრო ფასებში","en":"Output at market prices"}',                                   '#a0b4e8', 1,  '{"isClosing":false,"account":"production-account"}'),
  ('aggregates','P2',        '{"ka":"შუალედური მოხმარება","en":"Intermediate Consumption"}',                                          '#a0b4e8', 2,  '{"isClosing":false,"account":"production-account"}'),
  ('aggregates','B1G',       '{"ka":"მთლიანი შიდა პროდუქტი საბაზრო ფასებში","en":"Gross Domestic Product at market prices"}',         '#5470c6', 3,  '{"isClosing":true,"account":"production-account"}'),
  ('aggregates','D1',        '{"ka":"შრომის ანაზღაურება","en":"Compensation of employees"}',                                          '#3ba272', 4,  '{"isClosing":false,"account":"generation-of-income-account"}'),
  ('aggregates','D2_D3',     '{"ka":"გადასახადები-სუბსიდიები","en":"Taxes- subsidies"}',                                              '#73c0de', 5,  '{"isClosing":false,"account":"generation-of-income-account"}'),
  ('aggregates','B2G_B3G',   '{"ka":"მთლიანი შერეული შემოსავალი+საოპერაციო მოგება","en":"Mixed Income + Operating surplus"}',          '#3ba272', 6,  '{"isClosing":true,"account":"generation-of-income-account"}'),
  ('aggregates','D4_D1',     '{"ka":"პირველადი შემოსავლების მიღება დანარჩენი მსოფლიოდან","en":"Primary income receivable from the rest of the world"}',  '#fac858', 7,  '{"isClosing":false,"account":"allocation-of-primary-income-account"}'),
  ('aggregates','D4_D1_PAY', '{"ka":"პირველადი შემოსავლების გადახდა დანარჩენი მსოფლიოსათვის","en":"Primary income payable to the rest of the world"}',   '#ee6666', 8,  '{"isClosing":false,"account":"allocation-of-primary-income-account"}'),
  ('aggregates','B5G',       '{"ka":"მთლიანი ეროვნული შემოსავალი","en":"Gross National income"}',                                      '#fac858', 9,  '{"isClosing":true,"account":"allocation-of-primary-income-account"}'),
  ('aggregates','D5',        '{"ka":"მიმდინარე ტრანსფერების მიღება დანარჩენი მსოფლიოდან","en":"Current transfers receivable from the rest of the world"}', '#9a60b4', 10, '{"isClosing":false,"account":"secondary-distribution-of-income-account"}'),
  ('aggregates','D5_PAY',    '{"ka":"მიმდინარე ტრანსფერების გადახდა დანარჩენი მსოფლიოსათვის","en":"Current transfers payable to the rest of the world"}',  '#ee6666', 11, '{"isClosing":false,"account":"secondary-distribution-of-income-account"}'),
  ('aggregates','B6G',       '{"ka":"მთლიანი განკარგვადი შემოსავალი","en":"Gross Disposable income"}',                                  '#9a60b4', 12, '{"isClosing":true,"account":"secondary-distribution-of-income-account"}'),
  ('aggregates','P3',        '{"ka":"საბოლოო მოხმარება","en":"Final consumption"}',                                                    '#fc8452', 13, '{"isClosing":false,"account":"use-of-disposable-income-account"}'),
  ('aggregates','B8G',       '{"ka":"მთლიანი დანაზოგი","en":"Gross Savings"}',                                                        '#fc8452', 14, '{"isClosing":true,"account":"use-of-disposable-income-account"}'),
  ('aggregates','D9R',       '{"ka":"კაპიტალური ტრანსფერების მიღება დანარჩენი მსოფლიოდან","en":"Capital transfers receivable from the rest of the world"}', '#91cc75', 15, '{"isClosing":false,"account":"capital-account"}'),
  ('aggregates','D9P',       '{"ka":"კაპიტალური ტრანსფერების გადახდა დანარჩენი მსოფლიოსათვის","en":"Capital transfers payable to the rest of the world"}',  '#ee6666', 16, '{"isClosing":false,"account":"capital-account"}'),
  ('aggregates','P5',        '{"ka":"მთლიანი კაპიტალის ფორმირება","en":"Gross capital formation"}',                                    '#ea7ccc', 17, '{"isClosing":false,"account":"capital-account"}'),
  ('aggregates','P5G',       '{"ka":"არაწარმოებული არაფინანსური აქტივების წმინდა შესყიდვა","en":"Acquisition less disposals of non-produced non-financial assets"}', '#ea7ccc', 18, '{"isClosing":false,"account":"capital-account"}'),
  ('aggregates','B9',        '{"ka":"წმინდა დაკრედიტება (+), წმინდა სესხება(-)","en":"Net lending (+), Net borrowing(-)"}',             '#ee6666', 19, '{"isClosing":true,"account":"capital-account"}')
-- V18 Part A dropped the V4 blanket UNIQUE (dim_code, code); the live unique key
-- is now the PARTIAL index uq_classifier_current (dim_code, code) WHERE is_current
-- (V6). The ON CONFLICT arbiter MUST match that partial predicate.
ON CONFLICT (dim_code, code) WHERE is_current DO NOTHING;


-- ════════════════════════════════════════════════════════════════════════
-- 3. `aggregates` display overlay — label + color per locale ({$d:'aggregates'})
-- ════════════════════════════════════════════════════════════════════════
-- The GET /:dim_code/display route joins stats.classifier (id→code) ⋈
-- classifier_display (member_id→display, per locale). The engine display channel
-- (being wired concurrently) reads label/color from here. We materialize the
-- overlay from the classifier rows just inserted so label/color are an exact,
-- single-source projection (DRY: no second copy of the strings). One row per
-- (member, locale); locale FK → config.locale (V14).
INSERT INTO stats.classifier_display (member_id, locale, display)
SELECT c.id, loc.locale,
       jsonb_build_object('label', c.label ->> loc.locale, 'color', c.color)
  FROM stats.classifier c
  CROSS JOIN (VALUES ('ka'), ('en')) AS loc(locale)
 WHERE c.dim_code = 'aggregates'
   AND c.is_current = true
ON CONFLICT (member_id, locale) DO UPDATE
   SET display = EXCLUDED.display, updated_at = now();


-- ════════════════════════════════════════════════════════════════════════
-- 4. `account` — surface `order` on the entry + display overlay ({$cl:'account'},
--    {$d:'account'})
-- ════════════════════════════════════════════════════════════════════════
-- 4a. metadata.order = ord. The hero does join {$cl:'account'} fields:['order']
--     then sort by:'order'. The account entry must expose an `order` field; ord is
--     already correct (1..6) but the engine entry needs `order`. We carry it in
--     metadata (the open bag the route returns + the engine spreads), keyed to the
--     existing ord so the SNA sequence order is the SSOT.
UPDATE stats.classifier
   SET metadata = metadata || jsonb_build_object('order', ord)
 WHERE dim_code = 'account'
   AND is_current = true
   AND (metadata ->> 'order') IS DISTINCT FROM ord::text;

-- 4b. account display overlay (label/color → accountLabel/accountColor via the
--     pipe's lookup rename). Colors mirror the OLD ACCOUNTS_DISPLAY.account palette
--     (one accent per SNA account). label = the account's own bilingual label.
WITH account_color(code, color) AS (
  VALUES
    ('production-account',                       '#5470c6'),
    ('generation-of-income-account',             '#3ba272'),
    ('allocation-of-primary-income-account',     '#fac858'),
    ('secondary-distribution-of-income-account', '#9a60b4'),
    ('use-of-disposable-income-account',         '#fc8452'),
    ('capital-account',                          '#91cc75')
)
UPDATE stats.classifier c
   SET color = ac.color
  FROM account_color ac
 WHERE c.dim_code = 'account' AND c.code = ac.code AND c.is_current = true
   AND c.color IS DISTINCT FROM ac.color;

INSERT INTO stats.classifier_display (member_id, locale, display)
SELECT c.id, loc.locale,
       jsonb_build_object('label', c.label ->> loc.locale, 'color', c.color)
  FROM stats.classifier c
  CROSS JOIN (VALUES ('ka'), ('en')) AS loc(locale)
 WHERE c.dim_code = 'account'
   AND c.is_current = true
ON CONFLICT (member_id, locale) DO UPDATE
   SET display = EXCLUDED.display, updated_at = now();


-- ════════════════════════════════════════════════════════════════════════
-- 5. `geo` — de-duplicate (retire ISO duplicates) + SDMX hierarchy + display
-- ════════════════════════════════════════════════════════════════════════
-- 5a. Give every current geo row a real validity window. The V5-seeded rows have
--     valid_from = NULL; an SCD-2 close needs a non-NULL open bound, and the
--     as-of read window must have width (db-gated fixtures). Backfill open bounds
--     into the past so the window is real before we close the ISO duplicates.
UPDATE stats.classifier
   SET valid_from = COALESCE(valid_from, (now() - interval '1 day')::date)
 WHERE dim_code = 'geo' AND is_current = true AND valid_from IS NULL;

-- 5b. RETIRE the ISO duplicates GE-TB / GE-KA (SCD-2 close, NEVER delete). The
--     facts use the canonical Rn codes (R2..R12) + _T; GE-TB/GE-KA are OLD ISO
--     leftovers that no observation references (verified live: 0 facts). Closing
--     them removes them from the served codelist (the route filters is_current=
--     true) while preserving history. The ISO↔Rn alias is the map's geoCodeMap /
--     display concern, not the codelist.
UPDATE stats.classifier
   SET is_current = false,
       valid_to   = now()::date
 WHERE dim_code = 'geo'
   AND code IN ('GE-TB', 'GE-KA')
   AND is_current = true;

-- 5c. EXCEED-the-old: SDMX hierarchy — _T (national total) is the parent of every
--     region R2..R12, so the map can roll up to the national total / drill down to
--     a region (richer than the OLD flat list). GE (the GDP national member) and
--     _T stay roots (NULL parent). Setting parent_code fires trg_classifier_code_
--     path (materializes code_path) + the V18 acyclicity guard; _T is an existing
--     current root, so no missing-parent raise, no cycle.
UPDATE stats.classifier
   SET parent_code = '_T'
 WHERE dim_code = 'geo'
   AND code LIKE 'R%'
   AND is_current = true
   AND parent_code IS DISTINCT FROM '_T';

-- 5d. geo display overlay (label/color → {$d:'geo'}). Colors are not part of the
--     OLD geo palette (the map themes regions itself); we still seed label so the
--     {$d:'geo'} lookup returns a usable label for every current member. color is
--     left NULL (the map owns region color); the display carries label only.
INSERT INTO stats.classifier_display (member_id, locale, display)
SELECT c.id, loc.locale,
       jsonb_build_object('label', c.label ->> loc.locale)
  FROM stats.classifier c
  CROSS JOIN (VALUES ('ka'), ('en')) AS loc(locale)
 WHERE c.dim_code = 'geo'
   AND c.is_current = true
ON CONFLICT (member_id, locale) DO UPDATE
   SET display = EXCLUDED.display, updated_at = now();


-- ════════════════════════════════════════════════════════════════════════
-- 6. `sector` — SDMX hierarchy (_T parent of the activities) + display
-- ════════════════════════════════════════════════════════════════════════
-- 6a. open-bound backfill (same rationale as geo 5a) before any structural change.
UPDATE stats.classifier
   SET valid_from = COALESCE(valid_from, (now() - interval '1 day')::date)
 WHERE dim_code = 'sector' AND is_current = true AND valid_from IS NULL;

-- 6b. _T (All activities) is the parent of every activity code AND of OTH (Other) —
--     a clean roll-up to the sector total, mirroring the geo hierarchy. _T stays a
--     root. The facts already use _T + the activity codes; the hierarchy only adds
--     roll-up structure, it changes no fact.
UPDATE stats.classifier
   SET parent_code = '_T'
 WHERE dim_code = 'sector'
   AND code <> '_T'
   AND is_current = true
   AND parent_code IS DISTINCT FROM '_T';

-- 6c. sector display overlay (label → {$d:'sector'}); color left to the consumer.
INSERT INTO stats.classifier_display (member_id, locale, display)
SELECT c.id, loc.locale,
       jsonb_build_object('label', c.label ->> loc.locale)
  FROM stats.classifier c
  CROSS JOIN (VALUES ('ka'), ('en')) AS loc(locale)
 WHERE c.dim_code = 'sector'
   AND c.is_current = true
ON CONFLICT (member_id, locale) DO UPDATE
   SET display = EXCLUDED.display, updated_at = now();


-- ════════════════════════════════════════════════════════════════════════
-- 7. Post-conditions (read-only assertions — fail fast if a gap remains)
-- ════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  n_agg          INT;
  n_agg_closing  INT;
  n_geo_iso_live INT;
  n_geo_regions  INT;
BEGIN
  -- GAP 1: all 19 canonical measure codes have an aggregates member with isClosing.
  SELECT COUNT(*) INTO n_agg
    FROM stats.classifier
   WHERE dim_code = 'aggregates' AND is_current = true
     AND metadata ? 'isClosing';
  IF n_agg <> 19 THEN
    RAISE EXCEPTION 'V33: expected 19 aggregates members with isClosing, found %', n_agg;
  END IF;

  -- The 6 SNA closing balances (B1G, B2G_B3G, B5G, B6G, B8G, B9) are flagged.
  SELECT COUNT(*) INTO n_agg_closing
    FROM stats.classifier
   WHERE dim_code = 'aggregates' AND is_current = true
     AND (metadata ->> 'isClosing')::boolean = true;
  IF n_agg_closing <> 6 THEN
    RAISE EXCEPTION 'V33: expected 6 closing-balance aggregates, found %', n_agg_closing;
  END IF;

  -- GAP 2: no ISO geo duplicate remains in the LIVE codelist.
  SELECT COUNT(*) INTO n_geo_iso_live
    FROM stats.classifier
   WHERE dim_code = 'geo' AND is_current = true AND code IN ('GE-TB', 'GE-KA');
  IF n_geo_iso_live <> 0 THEN
    RAISE EXCEPTION 'V33: % ISO geo duplicate(s) still current after de-dup', n_geo_iso_live;
  END IF;

  -- GAP 2 hierarchy: every region R2..R12 rolls up to _T.
  SELECT COUNT(*) INTO n_geo_regions
    FROM stats.classifier
   WHERE dim_code = 'geo' AND is_current = true AND code LIKE 'R%'
     AND parent_code = '_T';
  IF n_geo_regions < 11 THEN
    RAISE EXCEPTION 'V33: expected >=11 regions parented to _T, found %', n_geo_regions;
  END IF;
END;
$$;
