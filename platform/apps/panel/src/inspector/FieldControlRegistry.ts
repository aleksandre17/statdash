// ── FieldControlRegistry — PropFieldType → FieldControl (C1 OCP seam) ────────
//
//  THE Open/Closed seam the ADR names: the Inspector renders a property panel
//  GENERICALLY by dispatching each PropField through this registry. A NEW
//  PropFieldType (e.g. the engine agent's incoming 'enum-ref') = ONE register()
//  call here; the Inspector body never changes (Strategy + Registry, mirroring
//  the engine's NodeRegistry).
//
//  Keyed by a runtime string (PropFieldType) so types the panel's TS does not
//  yet know about (engine additions landing in parallel) can still be served:
//  register('enum-ref', …) works before 'enum-ref' is in the PropFieldType union.
//
//  Resolution order for a field:
//    1. coverage:'localized'  → LocaleField (the localized-variant override)
//    2. type === 'enum-ref'   → EnumRefField (data-driven options)
//    3. field.options present + static select → SelectControl
//    4. controls.get(field.type) → registered control
//    5. fallback → JsonControl (raw-JSON editor, the documented default)
//  (1–3 are resolved by the Inspector via resolveControl; 4–5 by get().)
//
import type { PropField } from '@statdash/react/engine'
import type { FieldControl, FieldControlKey } from './fieldControl.types'
import {
  TextControl, NumberControl, BooleanControl,
  ColorControl, SelectControl, JsonControl,
} from './controls/primitives'
import { LocaleField }  from './controls/LocaleField'
import { EnumRefField } from './controls/EnumRefField'

/** Open keyed registry of field controls. Map-backed; string keys (see header). */
class FieldControlRegistryImpl {
  private controls = new Map<string, FieldControl>()
  private fallbackControl: FieldControl = JsonControl

  /** Register (or override) the control for a PropFieldType. Returns this (chainable). */
  register(key: FieldControlKey | (string & {}), control: FieldControl): this {
    this.controls.set(key, control)
    return this
  }

  /** True if a control is registered for the given key. */
  has(key: string): boolean {
    return this.controls.has(key)
  }

  /**
   * Resolve the control for a PropField, applying the documented precedence:
   * localized variant → enum-ref → static-options select → by-type → fallback.
   */
  resolve(field: PropField): FieldControl {
    // 1. coverage:'localized' (engine-agent addition) → multi-locale authoring.
    //    Defensive read: `coverage` is not yet in the PropField type union.
    if ((field as { coverage?: string }).coverage === 'localized') return LocaleField

    // 2. data-driven enum.
    if (field.type === ('enum-ref' as FieldControlKey)) return EnumRefField

    // 3. static options on a non-rich field → a plain select.
    if (field.options && field.options.length > 0) return SelectControl

    // 4. registered control by declared type, else 5. raw-JSON fallback.
    return this.controls.get(field.type) ?? this.fallbackControl
  }

  /** Direct lookup by key (no precedence) — used by tests + introspection. */
  get(key: string): FieldControl | undefined {
    return this.controls.get(key)
  }

  /** Set the fallback control used when no type-specific control is registered. */
  setFallback(control: FieldControl): this {
    this.fallbackControl = control
    return this
  }
}

export type FieldControlRegistry = FieldControlRegistryImpl

/**
 * The platform default registry, pre-populated with controls for every known
 * PropFieldType. Apps register richer controls (e.g. a DataSpecEditor for
 * 'DataSpec') by calling .register() — OCP, no edit to this file.
 */
export const fieldControlRegistry: FieldControlRegistry = new FieldControlRegistryImpl()
  // primitives
  .register('string',       TextControl)
  .register('number',       NumberControl)
  .register('boolean',      BooleanControl)
  .register('color',        ColorControl)
  .register('icon',         TextControl)   // plain key; richer icon-picker is a later registration
  // localized text — LocaleField also wins via coverage:'localized' in resolve()
  .register('LocaleString', LocaleField)
  // data-driven enum (engine 'enum-ref' lands in parallel; key registered now)
  .register('enum-ref',     EnumRefField)
  // rich/opaque types → raw-JSON editor (documented default)
  .register('object',       JsonControl)
  .register('array',        JsonControl)
  .register('DataSpec',     JsonControl)
  .register('ChartDef',     JsonControl)
