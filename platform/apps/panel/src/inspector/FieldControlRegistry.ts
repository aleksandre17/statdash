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
//    4. array/object + itemSchema → ArrayOf/Object nested editor (D7.1)
//    5. controls.get(field.type) → registered control
//    6. fallback → SummaryCard (constant-weight glance card, SPEC §3.1) —
//       JsonControl ONLY behind the dev escape (`rawJsonEscape`, FF-NO-RAW-JSON-
//       DEFAULT). No rich/opaque value ever regresses to a raw-JSON textarea.
//  (1–4 are resolved by the Inspector via resolveControl; 5–6 by get().)
//
import type { PropField } from '@statdash/react/engine'
import type { FieldControl, FieldControlKey } from './fieldControl.types'
import {
  TextControl, NumberControl, BooleanControl,
  ColorControl, SelectControl, JsonControl,
} from './controls/primitives'
import { SummaryCard } from './controls/SummaryCard'
import { isRawJsonEscapeEnabled } from './rawJsonEscape'
import { LocaleField }  from './controls/LocaleField'
import { EnumRefField } from './controls/EnumRefField'
import { StyleField }   from './controls/StyleField'
import { ArrayOfControl, ObjectControl } from './controls/NestedItemControl'

/**
 * True when an array/object field carries a structured `itemSchema` (D7.0/ADR-022)
 * — the signal that it is authored item-by-item via the recursive nested editor
 * rather than the opaque raw-JSON fallback. Mirrors the ADR's `isOpaqueNested`
 * predicate (keys off `'itemSchema' in field`): WITH it → structured, WITHOUT it
 * → opaque. Guarded to array/object only (the two nesting-capable types).
 */
function isStructuredNested(field: PropField): boolean {
  return (
    (field.type === 'array' || field.type === 'object') &&
    field.itemSchema != null
  )
}

/** Open keyed registry of field controls. Map-backed; string keys (see header). */
class FieldControlRegistryImpl {
  private controls = new Map<string, FieldControl>()
  /** The dev-only raw-JSON escape (FF-NO-RAW-JSON-DEFAULT). The DEFAULT fallback is
   *  SummaryCard — this control is reached only when `isRawJsonEscapeEnabled()`. */
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

    // 4. structured nested array/object (itemSchema present, D7.1) → the recursive
    //    item editor. WITHOUT itemSchema this predicate is false and the field
    //    falls through to the by-type JsonControl (graceful fallback — ZERO
    //    regression to any existing array/object field).
    if (isStructuredNested(field)) {
      return field.type === 'object' ? ObjectControl : ArrayOfControl
    }

    // 5. registered control by declared type.
    const registered = this.controls.get(field.type)
    if (registered) return registered

    // 6. no registered control → the rich/opaque DEFAULT is the constant-weight
    //    SummaryCard (a glance projection, never a raw-JSON dump). This is what
    //    makes the dock bounded-by-construction and JSON-free: DataSpec, ChartDef,
    //    opaque object/array, and any un-registered type all land here. The raw-JSON
    //    escape hatch is reached ONLY when a developer explicitly enables it.
    return isRawJsonEscapeEnabled() ? this.fallbackControl : SummaryCard
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
  // STYLE facet control — token-constrained NodeStyles editor (PropFieldType 'style').
  // The first FACET dispatched through this registry: the dock's generic Style section
  // resolves its `contract` field to this rich control (genericity in the DISPATCH).
  .register('style',        StyleField)
  // rich/opaque types (object · array · DataSpec · ChartDef) are DELIBERATELY not
  // registered here — they fall to the SummaryCard default (resolve() step 6), a
  // constant-weight glance card. Raw JSON is a dev escape only (FF-NO-RAW-JSON-DEFAULT).
