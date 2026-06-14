// ── Validation Types ───────────────────────────────────────────────────

export type ValidationSeverity = 'error' | 'warning' | 'info'

/** Machine-readable error codes — switch on these in error handlers. */
export type ValidationCode =
  | 'UNKNOWN_SPEC_TYPE'
  | 'UNKNOWN_CHART_TYPE'
  | 'MISSING_REQUIRED'
  | 'INVALID_VALUE'
  | 'EMPTY_ROWS'
  | 'EMPTY_PAIRS'
  | 'MISSING_ENCODING'
  | 'INCOMPATIBLE_VISIBLE_IN'
  | 'NO_CHART_FOR_MODE'
  | 'DEPRECATED_CUSTOM_FN'
  | 'THRESHOLD_ORDER'
  | 'UNREACHABLE_SPEC'

export interface ValidationError {
  /** JSONPath to the offending field: 'data.rows[0].code', 'chart.year.type'. */
  path:      string
  code:      ValidationCode
  message:   string
  severity:  ValidationSeverity
}

export interface ValidationResult {
  valid:    boolean    // true iff no errors (warnings are allowed)
  errors:   ValidationError[]
  warnings: ValidationError[]
  infos:    ValidationError[]
}