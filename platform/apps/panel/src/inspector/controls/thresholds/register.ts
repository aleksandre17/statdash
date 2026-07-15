// ── register — surface the thresholds FieldControl on the registry ────────────
//
//  Side-effect registration. Kept OUT of FieldControlRegistry.ts to avoid a cycle:
//  ThresholdField → Inspector → FieldControlRegistry, so the registry must not import
//  the field. The app imports this module at boot; a PropField with `type: 'thresholds'`
//  then resolves to the friendly step-list editor instead of the raw-JSON fallback —
//  making conditional formatting authorable through the Inspector. Mirrors the
//  value-mapping register exactly.
//
import { fieldControlRegistry } from '../../FieldControlRegistry'
import { ThresholdField } from './ThresholdField'

/** The PropField type a schema declares to get the thresholds step-list editor. */
export const THRESHOLDS_FIELD_TYPE = 'thresholds'

let registered = false

/** Idempotently register the thresholds control. Safe to call from boot + tests. */
export function registerThresholdsControl(): void {
  if (registered) return
  fieldControlRegistry.register(THRESHOLDS_FIELD_TYPE, ThresholdField as never)
  registered = true
}

// Self-register on import so a bare `import '.../thresholds/register'` wires it.
registerThresholdsControl()
