// ── Metadata slot → V31 reference_metadata mapping (ADR-0031 §6 / Wave 3b) ─────
//
// The canonical STRUCTURE sheet carries SIMS/ESMS-lite metadata as extra key/value
// rows; the parser collects ALL non-core keys into `CanonicalDsd.meta` (a plain
// Record<string,string>). This PURE mapper recognizes the keys V31's
// `stats.reference_metadata` ALREADY accepts (BAKE-NOW) and ignores the rest (the
// full ~21-concept ESMS/SIMS tree is SEAM-DEFER — no consumer today, explicit YAGNI).
//
// WHY ONLY THE NON-LOCALE PROVENANCE COLUMNS (methodology_url, last_updated):
// V31's content fields (methodology/source/coverage/quality/note) are LocaleString
// JSONB with COMPLETENESS TEETH — `config.enforce_locale_string_optional` REJECTS a
// provided-but-half-translated field at write (every active locale must have a
// non-empty entry). A canonical `meta` value is a PLAIN string (e.g. source='GeoStat',
// vintage='2026-06-26'), which cannot satisfy ka+en completeness — writing it into a
// content column would either fail the trigger or silently fabricate a half-translation.
// So the BAKE-NOW surface is exactly the columns whose values are plain text/date:
//   meta.methodology_ref → methodology_url (TEXT — a methodology link/citation)
//   meta.last_update     → last_updated    (DATE  — the badge "last updated" anchor)
// Promoting source/vintage into LocaleString columns waits for the curator-authored
// bilingual ESMS path (SEAM-DEFER) — Postel: accept what we can map losslessly, never
// fabricate the rest.
//
// PURE (no DB, no Fastify): the publish path calls this, then writes the row. It
// returns null when nothing recognized maps, so the publish path skips the INSERT
// entirely (an omitted report is valid — the serve route 404s a dataset with no report).

/** The V31 columns this mapper can populate losslessly from a canonical `meta` bag. */
export interface RecognizedReferenceMetadata {
  /** stats.reference_metadata.methodology_url (TEXT) — from meta.methodology_ref. */
  methodologyUrl?: string
  /** stats.reference_metadata.last_updated (DATE 'YYYY-MM-DD') — from meta.last_update. */
  lastUpdated?: string
}

// The recognized meta-key → V31 column map (SSOT). A new BAKE-NOW key is one entry
// here, not an edit to a switch (OCP). Keys NOT listed flow into the ESMS SEAM-DEFER
// bucket and are intentionally dropped at this stage.
const META_KEY = {
  methodologyRef: 'methodology_ref',
  lastUpdate:     'last_update',
} as const

/**
 * Project a canonical `CanonicalDsd.meta` bag onto the V31-acceptable columns.
 * Returns null when none of the recognized keys are present (the publish path then
 * writes no reference_metadata row). Blank/whitespace values are treated as absent
 * (fail-soft: a stray empty meta cell never writes an empty badge).
 */
export function recognizeReferenceMetadata(
  meta: Record<string, string>,
): RecognizedReferenceMetadata | null {
  const out: RecognizedReferenceMetadata = {}

  const methodologyUrl = (meta[META_KEY.methodologyRef] ?? '').trim()
  if (methodologyUrl) out.methodologyUrl = methodologyUrl

  const lastUpdated = (meta[META_KEY.lastUpdate] ?? '').trim()
  if (lastUpdated) out.lastUpdated = lastUpdated

  return Object.keys(out).length > 0 ? out : null
}
