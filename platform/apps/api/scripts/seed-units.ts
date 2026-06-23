// ════════════════════════════════════════════════════════════════════════
// seed-units.ts — GAP 3: unit / decimals per MEASURE code (SSOT mirror, ACL)
// ════════════════════════════════════════════════════════════════════════
// The structural SSOT for a measure's unit + precision is the engine metric
// registry (apps/geostat/src/data/metrics.ts, registerMetric({ unit, … })).
// The seed CANNOT import it: metrics.ts is side-effectful (it calls
// registerMetric at module load) and imports @statdash/engine, which would
// couple the ETL to the engine type graph (violates Law 3 + the seed's ACL
// stance). So, exactly as the seed owns its OWN input contract for facts, it
// owns a small mirror of the unit data here — a deliberate, reviewable copy of
// the few fields the ETL needs (Anti-Corruption Layer), NOT a runtime
// dependency on the engine.
//
// DECISION (Gap 3, Option B): unit_measure + decimals are written into
// stats.classifier.metadata of each MEASURE member — not a new column, not
// per-observation. A measure (GDP, GVA, B1G…) has ONE unit + precision shared
// by all its observations, so the classifier member is the natural, normalized
// home (SSOT: one datum, one place). The V8 obs_attribute bag remains the
// per-observation fallback for the rare case a single series overrides its
// unit. UNIT_MEASURE uses SDMX-style codes (GEL_MN / PERCENT / USD); DECIMALS is
// the SDMX count of fractional digits to display.
//
// When the live API replaces the bundles, this mirror is retired with the
// seed — the Java/SDMX source carries UNIT_MEASURE + DECIMALS as real
// attributes and this hand-maintained map disappears.
// ════════════════════════════════════════════════════════════════════════

export interface MeasureUnitIn {
  unit_measure: string
  decimals: number
}

const MEASURE_UNITS: Record<string, MeasureUnitIn> = {
  // Levels in GEL million (the dominant national-accounts unit).
  GDP: { unit_measure: 'GEL_MN', decimals: 1 },
  GDP_AGRI: { unit_measure: 'GEL_MN', decimals: 1 },
  GDP_IND: { unit_measure: 'GEL_MN', decimals: 1 },
  GDP_CON: { unit_measure: 'GEL_MN', decimals: 1 },
  GDP_SVC: { unit_measure: 'GEL_MN', decimals: 1 },
  GDP_NET_TAX: { unit_measure: 'GEL_MN', decimals: 1 },
  C: { unit_measure: 'GEL_MN', decimals: 1 },
  I_GFCF: { unit_measure: 'GEL_MN', decimals: 1 },
  X: { unit_measure: 'GEL_MN', decimals: 1 },
  M: { unit_measure: 'GEL_MN', decimals: 1 },
  D1: { unit_measure: 'GEL_MN', decimals: 1 },
  NET_TAX_PROD: { unit_measure: 'GEL_MN', decimals: 1 },
  OS_GROSS: { unit_measure: 'GEL_MN', decimals: 1 },
  MIXED_INC: { unit_measure: 'GEL_MN', decimals: 1 },
  GFCF_RES: { unit_measure: 'GEL_MN', decimals: 1 },
  GFCF_STRUCT: { unit_measure: 'GEL_MN', decimals: 1 },
  GFCF_MACH: { unit_measure: 'GEL_MN', decimals: 1 },
  GFCF_BIO: { unit_measure: 'GEL_MN', decimals: 1 },
  GFCF_IP: { unit_measure: 'GEL_MN', decimals: 1 },
  GVA: { unit_measure: 'GEL_MN', decimals: 1 },
  // SNA aggregates (ACCOUNTS) — GEL million.
  P1: { unit_measure: 'GEL_MN', decimals: 1 },
  B1G: { unit_measure: 'GEL_MN', decimals: 1 },
  B2G: { unit_measure: 'GEL_MN', decimals: 1 },
  B5G: { unit_measure: 'GEL_MN', decimals: 1 },
  B6G: { unit_measure: 'GEL_MN', decimals: 1 },
  B8G: { unit_measure: 'GEL_MN', decimals: 1 },
  B9: { unit_measure: 'GEL_MN', decimals: 1 },
  // Rates / shares in percent.
  GDP_GROWTH: { unit_measure: 'PERCENT', decimals: 1 },
  GDP_DEFLATOR: { unit_measure: 'PERCENT', decimals: 2 },
  NOE_SHARE: { unit_measure: 'PERCENT', decimals: 1 },
  // Per-capita in USD.
  GDP_PER_CAPITA: { unit_measure: 'USD', decimals: 1 },
}

/**
 * Unit metadata for a measure code. ACCOUNTS aggregates not explicitly mapped
 * fall back to GEL million (every SNA sequence aggregate is a GEL-million
 * level), so a new ACCOUNTS code seeds with a correct default rather than no
 * unit at all.
 */
export function unitFor(measureCode: string): MeasureUnitIn {
  return MEASURE_UNITS[measureCode] ?? { unit_measure: 'GEL_MN', decimals: 1 }
}
