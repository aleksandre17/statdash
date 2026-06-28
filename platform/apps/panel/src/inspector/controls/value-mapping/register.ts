// ── register — surface the value-mapping FieldControl on the registry [EXP-06] ──
//
//  Side-effect registration. Kept OUT of FieldControlRegistry.ts to avoid a cycle:
//  ValueMappingField → Inspector → FieldControlRegistry, so the registry must not
//  import the field. The app imports this module at boot (App.tsx); a PropField with
//  `type: 'value-mapping'` then resolves to the friendly rule-list editor instead of
//  the raw-JSON fallback — making value mappings authorable through the Inspector.
//
import { fieldControlRegistry } from '../../FieldControlRegistry'
import { ValueMappingField } from './ValueMappingField'

/** The PropField type a schema declares to get the value-mapping rule-list editor. */
export const VALUE_MAPPING_FIELD_TYPE = 'value-mapping'

let registered = false

/** Idempotently register the value-mapping control. Safe to call from boot + tests. */
export function registerValueMappingControl(): void {
  if (registered) return
  fieldControlRegistry.register(VALUE_MAPPING_FIELD_TYPE, ValueMappingField as never)
  registered = true
}

// Self-register on import so a bare `import '.../value-mapping/register'` wires it.
registerValueMappingControl()
