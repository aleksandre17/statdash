// ── Diagnostic — typed engine problem report [N17] ───────────────────
//
//  One type across all engine diagnostic paths:
//    - emitDiagnostic() → non-fatal, observed at the app layer
//    - EngineError      → fatal, thrown (kept for truly unrecoverable cases)
//
//  Replaces ad-hoc (code: string, detail: string) pairs with a typed value
//  the Constructor's error boundary can route, display, and surface.
//
//  Result<T> wraps a computation that may fail with a Diagnostic —
//  used at public engine boundary functions.  Internal resolvers still return
//  raw T; the boundary wraps them.
//
//  Reference: roadmap Layer 9.4 [N17].
//

/** Severity of a diagnostic event. */
export type DiagnosticLevel = 'error' | 'warning' | 'info'

/**
 * Typed problem report from the engine boundary.
 *
 * `code`    — machine-readable key; matches EngineErrorCode where applicable.
 * `message` — human-readable explanation.
 * `path`    — JSONPath-like location within the config ('sections[0].data.type').
 * `context` — key/value pairs for debugging / telemetry grouping.
 * `level`   — error = config is broken; warning = degraded gracefully; info = FYI.
 */
export interface Diagnostic {
  code:     string
  message:  string
  path?:    string
  context?: Record<string, unknown>
  level:    DiagnosticLevel
}

// ── Helpers ───────────────────────────────────────────────────────────

/** Create an error-level Diagnostic. */
export function diagError(
  code:    string,
  message: string,
  extras?: Pick<Diagnostic, 'path' | 'context'>,
): Diagnostic {
  return { code, message, level: 'error', ...extras }
}

/** Create a warning-level Diagnostic. */
export function diagWarning(
  code:    string,
  message: string,
  extras?: Pick<Diagnostic, 'path' | 'context'>,
): Diagnostic {
  return { code, message, level: 'warning', ...extras }
}

/** Create an info-level Diagnostic. */
export function diagInfo(
  code:    string,
  message: string,
  extras?: Pick<Diagnostic, 'path' | 'context'>,
): Diagnostic {
  return { code, message, level: 'info', ...extras }
}

// ── Result<T, E> ──────────────────────────────────────────────────────
//
//  Standard discriminated union for engine boundary functions.
//  Internal resolvers return T directly; the boundary wraps with ok/err.
//

export type Result<T, E = Diagnostic> =
  | { ok: true;  value: T }
  | { ok: false; error: E; value?: never }

/** Wrap a successful value in a Result. */
export function ok<T>(value: T): Result<T> {
  return { ok: true, value }
}

/** Wrap a failure in a Result. */
export function err<T = never>(error: Diagnostic): Result<T> {
  return { ok: false, error }
}
