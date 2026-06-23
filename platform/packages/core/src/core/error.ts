// ── EngineError ────────────────────────────────────────────────────────
//
//  Typed error hierarchy for @statdash/engine.
//  All engine functions throw EngineError — never raw Error.
//
//  code:    machine-readable identifier (switch in error handlers)
//  path:    JSONPath to the offending config node  'sections[0].chart.type'
//  context: diagnostic key/value pairs for debugging
//
//  Same pattern as: Grafana datasource errors, Retool query errors.
//

export type EngineErrorCode =
  | 'UNKNOWN_SPEC_TYPE'
  | 'UNKNOWN_CHART_TYPE'
  | 'UNKNOWN_RESOLVER'
  | 'UNKNOWN_INTERPRETER'
  | 'MISSING_REQUIRED_FIELD'
  | 'INVALID_INDICATOR_CODE'
  | 'INVALID_DIMENSION'
  | 'STORE_UNAVAILABLE'
  | 'CIRCULAR_BY_MODE'
  | 'EXPORT_UNSUPPORTED'
  | 'SCHEMA_VIOLATION'

export class EngineError extends Error {
  override readonly name = 'EngineError'

  readonly code:     EngineErrorCode
  readonly path?:    string
  readonly context?: Record<string, unknown>

  constructor(
    message:  string,
    code:     EngineErrorCode,
    path?:    string,
    context?: Record<string, unknown>,
  ) {
    super(message)
    this.code    = code
    this.path    = path
    this.context = context
    // Restore prototype chain (required when extending built-in Error)
    Object.setPrototypeOf(this, new.target.prototype)
  }

  /** Human-readable diagnostic summary — useful in dev-mode overlays. */
  toDiagnostic(): string {
    const parts = [`[EngineError:${this.code}] ${this.message}`]
    if (this.path)    parts.push(`  at: ${this.path}`)
    if (this.context) parts.push(`  ctx: ${JSON.stringify(this.context)}`)
    return parts.join('\n')
  }
}