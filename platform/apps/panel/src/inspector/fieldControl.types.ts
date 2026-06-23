// ── fieldControl.types — the FieldControl contract (C1 OCP seam) ────────────
//
//  A FieldControl is the React control that edits ONE PropField value. The
//  Inspector dispatches PropFieldType → FieldControl through FieldControlRegistry
//  (Strategy + Registry). A new PropFieldType = register a new control; the
//  Inspector body is unchanged (Open/Closed — the ADR's key seam).
//
//  Controlled-component standard: the control never owns the value. It receives
//  the current value + an onChange, and the Inspector writes through to the
//  store (which composes with the existing undo/redo history).
//
import type { ComponentType } from 'react'
import type { PropField, PropFieldType } from '@statdash/react/engine'
import type { Locale } from '../types/constructor'

/**
 * Props every FieldControl receives. Generic over the value type for clarity
 * at the registration site; the registry erases it (controls are keyed by a
 * runtime PropFieldType string, a correlated-union TS limitation).
 */
export interface FieldControlProps<T = unknown> {
  /** The PropField descriptor — type, label, validation, options, etc. */
  field:    PropField
  /** Stable DOM id for the control's primary input (label[htmlFor] target). */
  id:       string
  /** Current value read from the node's props at field.field (may be undefined). */
  value:    T
  /** Active locale list — drives LocaleField; ordered, default first. */
  locales:  Locale[]
  /** The locale to show single-locale labels/placeholders in. */
  locale:   Locale
  /**
   * The sibling prop values of the node being edited (the whole `props` bag).
   * A control needs this when its options depend on ANOTHER field's value —
   * e.g. a `cube.members` enum-ref scoped to the dimension chosen in a sibling
   * `cube.dimensions` field. Optional: most controls ignore it. Read-only; a
   * control NEVER writes a sibling, it only reads to resolve its own options.
   */
  siblingValues?: Record<string, unknown>
  /** Emit the next value for this field. The Inspector owns the store write. */
  onChange: (next: T) => void
}

export type FieldControl<T = unknown> = ComponentType<FieldControlProps<T>>

/** Discriminant the registry is keyed by — the PropField's declared type. */
export type FieldControlKey = PropFieldType
