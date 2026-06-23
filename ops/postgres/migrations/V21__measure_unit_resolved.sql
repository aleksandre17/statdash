-- ════════════════════════════════════════════════════════════════════════
-- V21__measure_unit_resolved.sql — the unit resolution view (SSOT of the rule)
-- ════════════════════════════════════════════════════════════════════════
-- Encodes Decision C's resolution order ONCE so no consumer re-implements it:
--   per field: measure-classifier (V20) -> dataset default (V16) -> NULL
-- Grain: one row per (dataset_code, measure_code). Measure↔dataset bridged via
-- stats.dataset_dimension (classifiers are dataset-agnostic; DSD is the bridge).
-- base_period is dataset-only. Read surface for the cube-profile endpoint.
-- Two-way: CREATE OR REPLACE VIEW; rollback = DROP VIEW IF EXISTS.
-- ════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE VIEW stats.measure_unit_resolved AS
SELECT
  dd.dataset_code,
  c.code                                AS measure_code,
  c.id                                  AS measure_classifier_id,
  COALESCE(c.unit_code, d.unit_code)    AS unit_code,
  CASE
    WHEN c.unit_code IS NOT NULL THEN 'measure'
    WHEN d.unit_code IS NOT NULL THEN 'dataset'
    ELSE 'none'
  END                                   AS unit_source,
  COALESCE(c.unit_mult, d.unit_mult)    AS unit_mult,
  COALESCE(c.decimals,  d.decimals)     AS decimals,
  d.base_period                         AS base_period,
  u.symbol                              AS unit_symbol,
  u.label                               AS unit_label,
  u.unit_type                           AS unit_type
FROM stats.dataset_dimension dd
JOIN stats.classifier c
  ON c.dim_code = dd.dim_code
 AND dd.dim_code = 'measure'
JOIN stats.dataset d
  ON d.code = dd.dataset_code
LEFT JOIN stats.unit_measure u
  ON u.code = COALESCE(c.unit_code, d.unit_code);

COMMENT ON VIEW stats.measure_unit_resolved IS
  'Decision C unit resolution, encoded once. One row per (dataset_code, measure_code). Per field: measure-classifier (V20) -> dataset default (V16) -> NULL. unit_source names the winning tier. base_period dataset-only. Read surface for the cube-profile endpoint.';
