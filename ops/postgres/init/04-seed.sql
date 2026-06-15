-- DEPRECATED: Use Flyway migrations in ops/postgres/migrations/ (V5__seed.sql).
-- This file kept for reference only. Flyway is the canonical migration source.
-- ════════════════════════════════════════════════════════════════════════
-- 04-seed.sql — minimal dev seed (idempotent)
-- ════════════════════════════════════════════════════════════════════════
-- Just enough to make the platform runnable end-to-end on first boot.
-- Every INSERT is ON CONFLICT DO NOTHING so re-running never errors or dupes.

-- ── Site config ─────────────────────────────────────────────────────────
INSERT INTO config.site_config (key, value) VALUES
  ('name',           '"სტატდეში"'),
  ('default_locale', '"ka"')
ON CONFLICT (key) DO NOTHING;


-- ── Dimensions (generic axes — names are data, not schema) ──────────────
INSERT INTO stats.dimension (code, label, ord) VALUES
  ('measure', '{"ka":"მაჩვენებელი","en":"Measure"}',     1),
  ('time',    '{"ka":"პერიოდი","en":"Time Period"}',     2),
  ('geo',     '{"ka":"ტერიტორია","en":"Geography"}',      3)
ON CONFLICT (code) DO NOTHING;


-- ── Dimension values (sample code-list entries) ─────────────────────────
INSERT INTO stats.dimension_value (dim_code, code, label, color, ord) VALUES
  ('measure', 'GDP',     '{"ka":"მშპ სულ","en":"GDP Total"}',     '#2563eb', 1),
  ('measure', 'GDP_CON', '{"ka":"მოხმარება","en":"Consumption"}', '#7c3aed', 2),
  ('time',    '2022',    '{"ka":"2022","en":"2022"}',             NULL,      1),
  ('time',    '2023',    '{"ka":"2023","en":"2023"}',             NULL,      2),
  ('geo',     'GE',      '{"ka":"საქართველო","en":"Georgia"}',    NULL,      1)
ON CONFLICT (dim_code, code) DO NOTHING;


-- ── Dataset + its key structure (DSD) ───────────────────────────────────
INSERT INTO stats.dataset (code, label, frequency) VALUES
  ('GDP_ANNUAL', '{"ka":"მშპ წლიური","en":"GDP Annual"}', 'A')
ON CONFLICT (code) DO NOTHING;

INSERT INTO stats.dataset_dimension (dataset_code, dim_code, is_time_dim, ord) VALUES
  ('GDP_ANNUAL', 'measure', false, 1),
  ('GDP_ANNUAL', 'time',    true,  2),
  ('GDP_ANNUAL', 'geo',     false, 3)
ON CONFLICT (dataset_code, dim_code) DO NOTHING;


-- ── Sample observations (exercise the dim_key + upsert path) ────────────
-- Conflict target = the (dataset_code, time_period, dim_key_hash) unique index.
-- dim_key_hash is generated, so we conflict on the index, not the column.
INSERT INTO stats.observation (dataset_code, time_period, dim_key, obs_value, obs_status) VALUES
  ('GDP_ANNUAL', '2022', '{"measure":"GDP","geo":"GE"}', 62000.0, 'A'),
  ('GDP_ANNUAL', '2023', '{"measure":"GDP","geo":"GE"}', 71000.0, 'P')
ON CONFLICT (dataset_code, time_period, dim_key_hash) DO NOTHING;
