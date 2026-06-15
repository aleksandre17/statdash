// ── Engine Diagnostics — cross-cutting observability seam ─────────────────────
//
//  Any engine module can call emitDiagnostic() without importing from EngineRegistry
//  or spec.ts. Pattern: same as SpecResolveObserver (spec.ts) and FilterDeriveObserver
//  (filter-derive.ts) — an opt-in observer, zero-cost when not wired.
//

/** Called when the engine detects a potentially incorrect configuration at runtime. */
export type DiagnosticObserver = (code: string, detail: string) => void

let _observer: DiagnosticObserver | undefined

/** Register the diagnostic observer. Call once at app boot (e.g. setupRegistrations.ts). */
export function setDiagnosticObserver(fn: DiagnosticObserver): void {
  _observer = fn
}

/** Emit a diagnostic. No-op if no observer is registered. */
export function emitDiagnostic(code: string, detail: string): void {
  _observer?.(code, detail)
}
