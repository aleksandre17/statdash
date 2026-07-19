// ── register — surface the trend FieldControl on the registry (ADR-049 P2a Lane 3) ──
//
//  Side-effect registration. Kept OUT of FieldControlRegistry.ts to avoid a cycle:
//  TrendField → Inspector → FieldControlRegistry, so the registry must not import the
//  field. The app imports this module at boot; a PropField with `type: 'trend'` then
//  resolves to the discriminant trend editor instead of the raw-JSON fallback — making
//  the KpiTrendSpec union (yoy/cagr/share/static) authorable through the Inspector.
//  Mirrors the thresholds / value-mapping registers exactly.
//
import { fieldControlRegistry } from '../../FieldControlRegistry'
import { TrendField } from './TrendField'

/** The PropField type a schema declares to get the trend discriminant editor. */
export const TREND_FIELD_TYPE = 'trend'

let registered = false

/** Idempotently register the trend control. Safe to call from boot + tests. */
export function registerTrendControl(): void {
  if (registered) return
  fieldControlRegistry.register(TREND_FIELD_TYPE, TrendField as never)
  registered = true
}

// Self-register on import so a bare `import '.../trend/register'` wires it.
registerTrendControl()
