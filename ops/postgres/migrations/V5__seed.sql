-- ════════════════════════════════════════════════════════════════════════
-- V5__seed.sql — minimal dev seed (idempotent)
-- ════════════════════════════════════════════════════════════════════════
-- Just enough to make the platform runnable end-to-end on first boot.
-- Every INSERT is ON CONFLICT DO NOTHING so re-running never errors or dupes.

-- Site config
INSERT INTO config.site_config (key, value) VALUES
  ('name',           '"სტატდეში"'),
  ('default_locale', '"ka"'),
  ('version',        '"1.0.0"')
ON CONFLICT (key) DO NOTHING;

-- Dimensions
INSERT INTO stats.dimension (code, label, ord) VALUES
  ('measure', '{"ka":"მაჩვენებელი","en":"Measure"}',     1),
  ('time',    '{"ka":"პერიოდი","en":"Time Period"}',       2),
  ('geo',     '{"ka":"ტერიტორია","en":"Geography"}',       3)
ON CONFLICT (code) DO NOTHING;

-- Classifiers for measure
INSERT INTO stats.classifier (dim_code, code, label, color, ord) VALUES
  ('measure', 'GDP',     '{"ka":"მშპ სულ","en":"GDP Total"}',          '#2563eb', 1),
  ('measure', 'GDP_CON', '{"ka":"მოხმარება","en":"Consumption"}',      '#7c3aed', 2),
  ('measure', 'GDP_IND', '{"ka":"მრეწველობა","en":"Industry"}',        '#059669', 3),
  ('measure', 'GDP_SVC', '{"ka":"მომსახურება","en":"Services"}',       '#d97706', 4),
  ('measure', 'EXP',     '{"ka":"ექსპორტი","en":"Exports"}',           '#dc2626', 5),
  ('measure', 'IMP',     '{"ka":"იმპორტი","en":"Imports"}',            '#7f1d1d', 6)
ON CONFLICT (dim_code, code) DO NOTHING;

-- Classifiers for geo
INSERT INTO stats.classifier (dim_code, code, label, ord) VALUES
  ('geo', 'GE',   '{"ka":"საქართველო","en":"Georgia"}',  1),
  ('geo', 'GE-TB','{"ka":"თბილისი","en":"Tbilisi"}',      2),
  ('geo', 'GE-KA','{"ka":"კახეთი","en":"Kakheti"}',       3)
ON CONFLICT (dim_code, code) DO NOTHING;

-- Time classifiers (annual 2019–2024)
INSERT INTO stats.classifier (dim_code, code, label, ord)
SELECT 'time', y::TEXT, jsonb_build_object('ka', y::TEXT, 'en', y::TEXT), y - 2018
FROM generate_series(2019, 2024) y
ON CONFLICT (dim_code, code) DO NOTHING;

-- Sample dataset
INSERT INTO stats.dataset (code, label, frequency) VALUES
  ('GDP_ANNUAL', '{"ka":"მშპ წლიური","en":"GDP Annual"}', 'A')
ON CONFLICT (code) DO NOTHING;

INSERT INTO stats.dataset_dimension (dataset_code, dim_code, is_time_dim, ord) VALUES
  ('GDP_ANNUAL', 'measure', false, 1),
  ('GDP_ANNUAL', 'time',    true,  2),
  ('GDP_ANNUAL', 'geo',     false, 3)
ON CONFLICT (dataset_code, dim_code) DO NOTHING;
