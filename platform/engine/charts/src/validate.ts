// ── Chart Validation (Constructor-facing) ─────────────────────────────
//
//  validateChartDef moved from @geostat/engine's validation/pipeline.ts.
//  Known types come from chartRegistry (single source of truth).
//

import type { ValidationCode, ValidationError, ValidationResult } from '@geostat/engine'
import type { ChartDef } from './types'
import { chartRegistry } from './registry'

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

  build(): ValidationResult {
    return {
      valid:    this.errors.length === 0,
      errors:   this.errors,
      warnings: this.warnings,
      infos:    this.infos,
    }
  }
}

export function validateChartDef(def: ChartDef, path = 'chart'): ValidationResult {
  const v = new ValidationBuilder()

  const knownCharts = chartRegistry.chartTypes()
  if (knownCharts.length > 0 && !knownCharts.includes(def.type)) {
    v.error(path + '.type', 'UNKNOWN_CHART_TYPE',
      `Unknown chart type: '${def.type}'. Known: ${knownCharts.join(', ')}`)
  }

  if (!def.label) v.warn(path + '.label', 'MISSING_REQUIRED', 'Chart label is empty')

  if (def.fieldConfig?.thresholds) {
    const bases = def.fieldConfig.thresholds.filter(t => t.value === null)
    if (bases.length > 1) {
      v.warn(path + '.fieldConfig.thresholds', 'THRESHOLD_ORDER',
        'More than one base threshold (value: null) — only the last one applies')
    }
  }

  return v.build()
}
