// ── Engine Diagnostics — cross-cutting observability seam ─────────────────────
//
//  Any engine module can call emitDiagnostic() without importing from EngineRegistry
//  or spec.ts. Pattern: same as SpecResolveObserver (spec.ts) and FilterDeriveObserver
//  (filter-derive.ts) — an opt-in observer, zero-cost when not wired.
//
//  Phase 9.4 [N17]: observer now receives a typed Diagnostic object instead of
//  ad-hoc (code: string, detail: string) pairs — one diagnostic language across
//  the engine boundary.
//
import type { Diagnostic } from '../core/diagnostic'

/**
 * Called when the engine detects a potentially incorrect configuration at runtime.
 * Receives a fully-typed Diagnostic; the app layer routes it to the error boundary,
 * telemetry, or dev console.
 */
export type DiagnosticObserver = (d: Diagnostic) => void

let _observer: DiagnosticObserver | undefined

/** Register the diagnostic observer. Call once at app boot (e.g. setupRegistrations.ts). */
export function setDiagnosticObserver(fn: DiagnosticObserver): void {
  _observer = fn
}

/** Emit a typed diagnostic. No-op if no observer is registered. */
export function emitDiagnostic(d: Diagnostic): void {
  _observer?.(d)
}
