// ── TelemetryPort [N23] ────────────────────────────────────────────────
//
//  Unified observability seam for the engine boundary.
//  Replaces the per-seam setSpecResolveObserver / setDiagnosticObserver
//  pattern with one opt-in port that the app layer wires up once at startup.
//
//  Precedence: setTelemetryPort wins over the individual setters.
//  The per-seam setters are kept as backward-compat deprecated shims.
//
//  Usage (app layer, dev-only):
//    import { setTelemetryPort } from '@statdash/engine'
//    if (import.meta.env.DEV) {
//      setTelemetryPort({
//        onDiagnostic:    d   => console.warn('[engine]', d),
//        onSpecResolved:  (tag, _ctx, rows) => console.debug(tag, rows.length),
//      })
//    }
//

import type { Diagnostic }    from './diagnostic'
import type { SectionContext } from './context'
import type { EngineRow }     from '../data/encoding'

/** All observable engine events. Every hook is optional. */
export interface TelemetryPort {
  /**
   * Called after each successful `interpretSpec` dispatch.
   * @param tag  - DataSpec.type (e.g. 'query', 'timeseries', 'growth')
   * @param ctx  - the SectionContext that drove the resolution
   * @param rows - the resolved EngineRow[]
   */
  onSpecResolved?: (tag: string, ctx: SectionContext, rows: EngineRow[]) => void

  /**
   * Called when the engine emits a Diagnostic (warning / error / info).
   * Supersedes the standalone DiagnosticObserver seam.
   */
  onDiagnostic?: (d: Diagnostic) => void

  /**
   * Called when a table's row count exceeds its configured `rowThreshold`.
   * Use this for performance monitoring / alerting — the table will render
   * a truncated view; this hook lets the app layer observe the truncation.
   *
   * @param rowCount  - total number of rows in the dataset
   * @param threshold - the rowThreshold that was exceeded
   */
  onLargeDataset?: (rowCount: number, threshold: number) => void
}

let _port: TelemetryPort | undefined

/** Register the telemetry port. Call once at app startup. */
export function setTelemetryPort(port: TelemetryPort): void {
  _port = port
}

/** Retrieve the registered port, or an empty object if not set. @internal */
export function getTelemetryPort(): TelemetryPort {
  return _port ?? {}
}
