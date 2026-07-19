// ── specEditorRegistry — the DataSpec rich-editor port (ADR-049 P1) ────────────
//
//  The engine's SPEC_CATALOG declares, per bind-kind, EITHER a `schema` (rendered
//  through the generic Inspector) OR an `editorKey` — a string resolving a
//  genuinely-rich React editor whose drag-drop / pipeline / palette modalities
//  exceed a flat property form. Those editors live in the PANEL (the dependency
//  arrow forbids React in the engine), so the engine declares the KEY and the panel
//  registers the editor here at boot — the SAME boot-time escape hatch value-mapping
//  and thresholds use (App.tsx side-effect registration).
//
//  This is what lets the DataSpec composer be a GENERIC mechanism: it resolves a
//  kind's authoring contract and dispatches editorKey→this registry OR schema→the
//  Inspector, with NO `switch (spec.type)` and NO per-kind editor import of its own
//  (FF-NO-DATASPEC-SWITCH). A NEW rich bind-kind = one SPEC_CATALOG declaration + one
//  registerSpecEditor() call, zero DataSpecEditor edits.
//
import type { ComponentType } from 'react'
import type { DataSpec } from '@statdash/engine'

/** A rich DataSpec editor — owns the full spec value, emits a replacement. */
export interface SpecEditorProps {
  value:    DataSpec
  onChange: (next: DataSpec) => void
}
export type SpecEditor = ComponentType<SpecEditorProps>

const _editors = new Map<string, SpecEditor>()

/**
 * Register (or override) the rich editor for an `editorKey`. Last-write-wins so a
 * test may swap a built-in. Idempotent at the boot call site (registerSpecEditors).
 */
export function registerSpecEditor(key: string, editor: SpecEditor): void {
  _editors.set(key, editor)
}

/** Resolve the editor for an `editorKey`, or undefined if none is registered. */
export function getSpecEditor(key: string): SpecEditor | undefined {
  return _editors.get(key)
}

/** Sorted registered keys — introspection / fitness gates. */
export function listSpecEditorKeys(): string[] {
  return [..._editors.keys()].sort()
}
