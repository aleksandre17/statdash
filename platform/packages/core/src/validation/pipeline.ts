// ── Validation Pipeline ────────────────────────────────────────────────
//
//  Every config type in the engine is self-describing and self-validating.
//  validateXxx() functions return structured results — no thrown exceptions.
//
//  The Constructor (admin panel, phase 2) uses these validators to:
//    - Show inline errors as the user edits configs
//    - Block saving invalid configurations
//    - Surface warnings for deprecated patterns
//
//  ValidationError uses JSONPath in .path for precise error location.
//

import type { DataSpec }              from '../config/data-spec'
import { defaultRegistry }            from '../registry/engine'
import type {
  ValidationSeverity,
  ValidationCode,
  ValidationError,
  ValidationResult,
} from './types'

// ── Builder ────────────────────────────────────────────────────────────

class ValidationBuilder {
  private readonly errors:   ValidationError[] = []
  private readonly warnings: ValidationError[] = []
  private readonly infos:    ValidationError[] = []

  error(path: string, code: ValidationCode, message: string): this {
    this.errors.push({ path, code, message, severity: 'error' })
    return this
  }

  warn(path: string, code: ValidationCode, message: string): this {
    this.warnings.push({ path, code, message, severity: 'warning' })
    return this
  }

  info(path: string, code: ValidationCode, message: string): this {
    this.infos.push({ path, code, message, severity: 'info' })
    return this
  }

  build(): ValidationResult {
    return {
      valid:    this.errors.length === 0,
      errors:   this.errors,
      warnings: this.warnings,
      infos:    this.infos,
    }
  }
}

function validate(): ValidationBuilder {
  return new ValidationBuilder()
}

// ── Known spec/chart types — derived from the registry, never mirrored ──
//
//  The registry is the single source of truth. A hardcoded Set drifts the
//  moment a resolver/interpreter registers without updating it (it already
//  did: hbar-diverging · contribution · treemap · area were registered and
//  working but flagged "Unknown"). Both validateDataSpec and validateChartDef
//  read defaultRegistry.{specTypes,chartTypes}(). Fail-open when the registry
//  is not yet populated (isolated use) — we cannot call a type unknown if we
//  don't know the registered set.

// ── DataSpec validation ────────────────────────────────────────────────

export function validateDataSpec(
  spec: DataSpec,
  path = 'data',
): ValidationResult {
  const v = validate()

  const knownSpecs = defaultRegistry.specTypes()
  if (knownSpecs.length > 0 && !knownSpecs.includes(spec.type)) {
    return v.error(path + '.type', 'UNKNOWN_SPEC_TYPE',
      `Unknown spec type: '${spec.type}'. Known types: ${knownSpecs.join(', ')}`
    ).build()
  }

  switch (spec.type) {
    case 'row-list':
      if (!spec.rows.length)
        v.error(path + '.rows', 'EMPTY_ROWS', 'row-list requires at least one row')
      spec.rows.forEach((r, i) => {
        if (!r.code)
          v.error(`${path}.rows[${i}].code`, 'MISSING_REQUIRED', 'Row is missing a code')
      })
      break

    case 'ratio-list':
      if (!spec.pairs.length)
        v.error(path + '.pairs', 'EMPTY_PAIRS', 'ratio-list requires at least one pair')
      spec.pairs.forEach((p, i) => {
        if (!p.code)  v.error(`${path}.pairs[${i}].code`,  'MISSING_REQUIRED', 'Pair missing code')
        if (!p.denom) v.error(`${path}.pairs[${i}].denom`, 'MISSING_REQUIRED', 'Pair missing denom')
      })
      break

    case 'timeseries':
      if (!spec.code) v.error(path + '.code', 'MISSING_REQUIRED', 'timeseries requires a code')
      if (!spec.years?.length) v.error(path + '.years', 'MISSING_REQUIRED', 'timeseries requires years')
      break

    case 'growth':
      if (!spec.code) v.error(path + '.code', 'MISSING_REQUIRED', 'growth requires a code')
      if (!spec.years?.length) v.error(path + '.years', 'MISSING_REQUIRED', 'growth requires years')
      break

    case 'query':
      if (!spec.query?.measure)
        v.error(path + '.query.measure', 'MISSING_REQUIRED', 'query requires a measure')
      if (!spec.encoding?.label)
        v.error(path + '.encoding.label', 'MISSING_ENCODING', 'query requires encoding.label')
      break

    case 'custom':
      v.warn(path + '.type', 'DEPRECATED_CUSTOM_FN',
        'custom spec uses a function — not JSON-serializable. Consider a declarative spec type.')
      break

    case 'by-mode': {
      const results = Object.entries(spec.modes).map(([key, branch]) =>
        validateDataSpec(branch, `${path}.modes.${key}`)
      )
      return mergeResults(results)
    }
  }

  return v.build()
}


// NOTE (Layer 0.4): the former `validateSectionDef` validated the dead Track-B
// `SectionDef` type (no live config uses it) — removed (gap #27).
//
// RESOLVED (ADR adr-config-and-render-vision §7.2): the engine-tier STRUCTURAL
// FLOOR for the whole page tree now legitimately lives in core as
// `validateConfig` (./config.ts). The earlier note conflated two concerns: the
// known-TYPE-SET (the engine CAN hold this — a derived projection injected via
// registry/nodeTypes.ts, fail-open when empty, exactly like the spec-type set
// above) versus the per-node slice-`validate()` hooks (those genuinely stay in
// @statdash/react — they need the renderer registry). Only the latter is up-tier;
// `validateConfig` reuses this same {path,code,severity} ValidationError model
// (it calls validateDataSpec for each node's `data`), so there is no shape
// reconciliation to do here.

// ── Helpers ────────────────────────────────────────────────────────────

function mergeResults(results: ValidationResult[]): ValidationResult {
  const errors   = results.flatMap(r => r.errors)
  const warnings = results.flatMap(r => r.warnings)
  const infos    = results.flatMap(r => r.infos)
  return { valid: errors.length === 0, errors, warnings, infos }
}

// Re-export types for convenience
export type { ValidationSeverity, ValidationCode, ValidationError, ValidationResult }