-- ════════════════════════════════════════════════════════════════════════
-- V7__real_dataset_structure.sql — DSD for the three real bundles (structure only)
-- ════════════════════════════════════════════════════════════════════════
-- WHAT THIS ADDS (and WHY):
--   The platform's three live datasets — GDP (flat facts), ACCOUNTS (SDMX-JSON
--   sequence) and REGIONAL (surrogate-id facts) — each need their cube STRUCTURE
--   declared before the seed script can load facts (the V4 validation trigger
--   rejects any observation whose dim_key keys don't match a declared DSD).
--
--   Structure = dimensions (axes) + datasets (dataflows) + dataset_dimension
--   (the DSD / series key). This is DECLARATIVE and stable, so it lives in a
--   migration (versioned, reviewable). The DATA (classifier members, display
--   overlays, observations) is high-volume and bundle-derived, so it lives in
--   the idempotent seed script (apps/api/scripts/seed.ts), NOT here.
--
--   This separation = SSOT for structure (migrations) vs SSOT for data (bundles
--   via the seed). A new dataset that reuses these dimensions adds rows here
--   only; a genuinely new dimension is one INSERT into stats.dimension — never
--   a DDL change (Law 1: dimensions are data, not columns).
--
-- Idempotent: every INSERT is ON CONFLICT DO NOTHING. Re-run = no-op.
-- Does NOT touch V1-V5. Reuses dimensions seeded in V5 (measure, time, geo).
-- ════════════════════════════════════════════════════════════════════════


-- ── Dimensions (axes) — the new ones the real bundles need ───────────────
-- 'measure', 'time', 'geo' already exist (V5). We add the bundle-specific axes.
-- A dimension is a ROW (Law 1): adding 'approach'/'side'/'account'/'sector' is
-- data, never schema.
INSERT INTO stats.dimension (code, label, ord) VALUES
  ('approach', '{"ka":"მიდგომა","en":"Approach"}',  4),  -- GDP: production/expenditure/income/…
  ('account',  '{"ka":"ანგარიში","en":"Account"}',  5),  -- ACCOUNTS: SNA sequence account
  ('side',     '{"ka":"მხარე","en":"Side"}',         6),  -- ACCOUNTS: R (resources) / U (uses)
  ('sector',   '{"ka":"სექტორი","en":"Sector"}',     7)   -- REGIONAL: NACE-style activity sector
ON CONFLICT (code) DO NOTHING;


-- ════════════════════════════════════════════════════════════════════════
-- Dataset 1 — GDP_ANNUAL (already created in V5; here we lock its DSD shape)
-- ════════════════════════════════════════════════════════════════════════
-- Bundle: apps/geostat/src/data/gdp — flat facts { time, measure, value, obsStatus }.
-- Series key (non-time) = { measure }. (The bundle also carries 'approach' as a
-- classifier attribute of each measure, NOT as a fact dimension — so it is NOT
-- in the DSD. approach is modelled as classifier metadata, see seed.ts.)
-- V5 already declared GDP_ANNUAL with dims (measure, time, geo). The real GDP
-- bundle has NO geo dimension on its facts — every fact is national. We do NOT
-- edit V5; instead GDP_ANNUAL keeps its V5 DSD and the seed loads geo='GE' on
-- every GDP observation to satisfy it (one constant geo member). This keeps V5
-- immutable while remaining faithful to the bundle (a single national geo).
--
-- Rationale recorded so a future reader doesn't "fix" V5: the bundle is
-- national-only; geo=GE is the correct constant, not a hardcode leak.


-- ════════════════════════════════════════════════════════════════════════
-- Dataset 2 — ACCOUNTS_SEQUENCE (SNA 2008 sequence of accounts)
-- ════════════════════════════════════════════════════════════════════════
-- Bundle: apps/geostat/src/data/accounts — facts { time, value, status, measure,
-- side, account, seqPos }. Series key (non-time) = { measure, side, account }.
-- seqPos is an SDMX ATTRIBUTE (carry-forward chain position), not a key dim —
-- it is stored on the observation metadata, not in dim_key.
INSERT INTO stats.dataset (code, label, frequency, source, metadata) VALUES
  ('ACCOUNTS_SEQUENCE',
   '{"ka":"ეროვნული ანგარიშების თანმიმდევრობა","en":"National Accounts Sequence"}',
   'A',
   'Geostat',
   '{"snaFramework":"SNA2008","sdmxId":"NATIONAL_ACCOUNTS_SEQUENCE"}')
ON CONFLICT (code) DO NOTHING;

INSERT INTO stats.dataset_dimension (dataset_code, dim_code, is_time_dim, ord) VALUES
  ('ACCOUNTS_SEQUENCE', 'measure', false, 1),
  ('ACCOUNTS_SEQUENCE', 'account', false, 2),
  ('ACCOUNTS_SEQUENCE', 'side',    false, 3),
  ('ACCOUNTS_SEQUENCE', 'time',    true,  4)
ON CONFLICT (dataset_code, dim_code) DO NOTHING;


-- ════════════════════════════════════════════════════════════════════════
-- Dataset 3 — REGIONAL_GVA (regional gross value added by sector)
-- ════════════════════════════════════════════════════════════════════════
-- Bundle: apps/geostat/src/data/regional — facts { time, geo, sector, measure,
-- value } with SURROGATE ids on geo/sector. The seed maps surrogate id → code
-- (REGIONAL_CLASSIFIERS) before building dim_key, so the cube stores CODES
-- (geo='tbilisi', sector='AGRI'), consistent with the GDP/ACCOUNTS datasets and
-- with what the engine's DimResolver expects (Kimball: facts carry ids in the
-- bundle, codes at the query boundary).
-- Series key (non-time) = { measure, geo, sector }.
INSERT INTO stats.dataset (code, label, frequency, source, metadata) VALUES
  ('REGIONAL_GVA',
   '{"ka":"რეგიონული დამატებული ღირებულება","en":"Regional Gross Value Added"}',
   'A',
   'Geostat',
   '{}')
ON CONFLICT (code) DO NOTHING;

INSERT INTO stats.dataset_dimension (dataset_code, dim_code, is_time_dim, ord) VALUES
  ('REGIONAL_GVA', 'measure', false, 1),
  ('REGIONAL_GVA', 'geo',     false, 2),
  ('REGIONAL_GVA', 'sector',  false, 3),
  ('REGIONAL_GVA', 'time',    true,  4)
ON CONFLICT (dataset_code, dim_code) DO NOTHING;


-- ── Seed the version rows so the API has an ETag baseline from first boot ──
-- (The seed script bumps these after loading facts; this just ensures a row
-- exists even before the first seed run.)
INSERT INTO stats.dataset_version (dataset_code, version) VALUES
  ('GDP_ANNUAL',        1),
  ('ACCOUNTS_SEQUENCE', 1),
  ('REGIONAL_GVA',      1)
ON CONFLICT (dataset_code) DO NOTHING;
