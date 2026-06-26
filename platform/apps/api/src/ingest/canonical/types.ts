// ── Canonical workbook — the self-describing DSD parsed from STRUCTURE ─────────
//
// ADR-0031 §2. The canonical workbook (`STRUCTURE` + `CL_<DIM>` + `DATA`) is a
// self-describing SDMX-lite interchange format. `CanonicalDsd` is the parsed,
// PLAIN-DATA view of the `STRUCTURE` sheet — no functions, no logic (Law 2), so
// it is JSON-lossless (F-6 round-trip). The parser reads `dimensions` as the SSOT
// for the dim set + order and NEVER hardcodes 'time'/'geo' (Law 1).

/**
 * The DSD a canonical workbook declares, parsed from its `STRUCTURE` sheet.
 *
 * Pure data: every field is a primitive, string array, or string-record — there
 * are no functions or class instances, so `JSON.parse(JSON.stringify(dsd))`
 * round-trips identically (F-6).
 */
export interface CanonicalDsd {
  /** `dataset_code` — the dataset identity (e.g. 'ACCOUNTS_SEQUENCE'). */
  datasetCode: string
  /** `name_<lang>` STRUCTURE rows collected into a locale bag, e.g. { ka, en }. */
  name: Record<string, string>
  /**
   * The ORDERED series-key dimensions from the `dimensions` STRUCTURE row (CSV).
   * This is the SSOT for the dim set + order (Law 1) — `time` is included here
   * (it is the melted axis) but has no `CL_` sheet.
   */
  dimensions: string[]
  /** `measure` — the measure concept (e.g. 'OBS_VALUE'). */
  measureConcept: string
  /**
   * Every non-core `STRUCTURE` key/value row (the SIMS/ESMS-lite metadata slot):
   * `unit_default`, `source`, `vintage` today; `methodology_ref`, `base_period`,
   * `last_update`, `preliminary_policy`, `metadataflow`, … reserved (improvement 6).
   */
  meta: Record<string, string>
  /**
   * Per non-time dimension: how its codelist members are resolved.
   *   - `declared` — members come from this workbook's `CL_<dim>` sheet (the
   *     current 3 workbooks; resolution = upsert-and-register).
   *   - `reference` — resolve from the shared registry by id + version
   *     (SEAM-DEFER, improvement 2; resolver throws NOT_IMPLEMENTED until a
   *     workbook actually references rather than declares).
   */
  codelistRefs: Record<string, CodelistRef>
  /**
   * A whole-DSD reference (declare-OR-reference, improvement 2). Reserved: the
   * type carries it so a future `dsd_ref` STRUCTURE row resolves the entire DSD
   * from the registry; the resolver is a SEAM-DEFER stub until the first use.
   */
  dsdRef?: { id: string; version: string }
}

/** How a dimension's codelist members are sourced — declared inline or referenced. */
export type CodelistRef =
  | { kind: 'declared'; dim: string }
  | { kind: 'reference'; id: string; version: string }

// ── Structural parse issues — fail-fast at the boundary ───────────────────────
//
// Distinct from the row-level `ValidationIssue` (conform/validate, ingest/types):
// a `ParseIssue` is a STRUCTURAL defect of the workbook itself (a missing sheet,
// a malformed header) detected before any bronze row can be emitted. Surfaced at
// the HTTP boundary so the curator sees exactly why a workbook could not be read.

/** A closed vocabulary of structural defects the parser can detect. */
export type ParseIssueCode =
  | 'MISSING_STRUCTURE'   // no STRUCTURE sheet
  | 'MISSING_DIMENSIONS'  // STRUCTURE has no `dimensions` row (the Law-1 SSOT)
  | 'MISSING_DATASET_CODE'// STRUCTURE has no `dataset_code` row
  | 'MISSING_DATA'        // no DATA sheet
  | 'MISSING_CL_SHEET'    // a declared non-time dim has no CL_<dim> sheet
  | 'BAD_DATA_HEADER'     // DATA header lacks a required core column (time/obs_value)
  | 'BAD_CL_HEADER'       // a CL_<dim> header lacks the required `code` column

export interface ParseIssue {
  code: ParseIssueCode
  /** Structured context (sheet name, missing key, …) — never an interpolated string. */
  detail: Record<string, unknown>
}
