// ── Reference Metadata wire contract (GET /api/stats/datasets/:code/metadata) ─
//
//  The SDMX Reference Metadata (ESMS-lite) report a dataset carries, as it crosses
//  the api ↔ runner boundary. Produced by the api (apps/api/src/routes/stats/
//  reference-metadata.ts), consumed by the geostat runner to hydrate the engine's
//  MetadataPort (packages/core/src/core/provenance.ts) so the Law-9 methodology /
//  source / last-updated / quality badges (ONS / IMF / Eurostat data-integrity
//  standard) render from STRUCTURED metadata instead of ad-hoc strings.
//
//  WHY here (not re-declared per side): the api cannot import @statdash/react across
//  the dependency arrow, yet the api SERVES this shape and the runner CONSUMES it.
//  This is the shared, zero-dep home — the same rationale as SiteManifestContract.
//
//  RELATION to the engine ProvenanceRecord: this contract is the WIRE projection of
//  the DB stats.reference_metadata row. Its CONTENT fields map 1:1 onto the engine's
//  ProvenanceRecord ({ methodology, source, note, lastUpdated, … }) — the runner
//  adapts this contract into a ProvenanceRecord at store-build time. The contract is
//  i18n-COMPLETE (LocaleString per content field) where ProvenanceRecord is a single
//  resolved string: the runner resolves each LocaleString against the active locale
//  via the engine's resolveLocaleString. Contract carries all locales; engine carries
//  the resolved one (the V13/V14 i18n discipline crossing the wire).
//
//  Backward-compatible (expand-contract): every content field is OPTIONAL — a report
//  may omit any of them, and a consumer that does not know a future field ignores it
//  (Postel). A dataset with NO report at all yields a 404 (the route), never a
//  half-shaped object.

/**
 * A bilingual/multilingual string as it crosses the wire — the JSON projection of a
 * DB LocaleString (V13). Keyed by BCP 47 locale code ('ka','en'). Declared locally
 * (not imported) to keep @statdash/contracts zero-dependency.
 */
export type ContractLocaleString = Record<string, string>

/**
 * The SDMX Reference Metadata report for one dataset (the current SCD-2 vintage).
 *
 *  - `metadataflow` — the SDMX Metadataflow the report conforms to ('ESMS_LITE').
 *  - content fields  — i18n LocaleStrings (the badge text); each OPTIONAL.
 *  - `lastUpdated`   — the authoritative last-updated ISO date (the badge date).
 *  - `contact*` / `methodologyUrl` — locale-agnostic provenance.
 *  - `revision`/`validFrom` — the SCD-2 vintage of THIS report (auditability).
 */
export interface ReferenceMetadataContract {
  /** The target dataset code this report describes. */
  datasetCode:     string
  /** The SDMX Metadataflow code the report conforms to (e.g. 'ESMS_LITE'). */
  metadataflow:    string

  /** Methodology / compilation notes (the badge ℹ link body). */
  methodology?:    ContractLocaleString
  /** Source / provenance (e.g. "Geostat National Accounts"). */
  source?:         ContractLocaleString
  /** Statistical coverage / population / scope. */
  coverage?:       ContractLocaleString
  /** Quality / accuracy / revision note. */
  quality?:        ContractLocaleString
  /** Free-text provenance note (badge tooltip). */
  note?:           ContractLocaleString

  /** Authoritative "last updated" date (ISO 8601, e.g. '2024-09-15'). */
  lastUpdated?:    string
  /** Contact name (SDMX CONTACT concept) — locale-agnostic. */
  contactName?:    string
  /** Contact email. */
  contactEmail?:   string
  /** External methodology page URL (drives the badge ℹ link href). */
  methodologyUrl?: string

  /** SCD-2 revision number of THIS report (monotonic per dataset). */
  revision:        number
  /** ISO timestamp this report version became current (the vintage). */
  validFrom:       string
}
