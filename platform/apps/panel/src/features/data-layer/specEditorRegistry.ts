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
import type { CapabilityId, DataSpec } from '@statdash/engine'

/** A rich DataSpec editor — owns the full spec value, emits a replacement. */
export interface SpecEditorProps {
  value:    DataSpec
  onChange: (next: DataSpec) => void
}
export type SpecEditor = ComponentType<SpecEditorProps>

const _editors  = new Map<string, SpecEditor>()
const _provides = new Map<string, readonly CapabilityId[]>()

/**
 * Register (or override) the rich editor for an `editorKey`. Last-write-wins so a
 * test may swap a built-in. Idempotent at the boot call site (registerSpecEditors).
 *
 * `provides` DECLARES the authoring capabilities this editor delivers (DESIGN-0104 §2·C2 ·
 * E1). It is the editor's face of the Capability Matrix: the parity fitness proves every
 * capability a kind REQUIRES has a provider here (or in the workbench core), and that the
 * claim is PROBED — a claim cannot lie, an unclaimed requirement cannot slip through. These
 * dedicated whole-kind editors feed the PARITY check + the fallback lane; the three-pane
 * admissibility union takes the workbench-core surfaces (+ future step editors), never these
 * (`workbenchCapabilities.ts`) — so a fallback editor's provides can never widen the panes.
 */
export function registerSpecEditor(key: string, editor: SpecEditor, provides: readonly CapabilityId[] = []): void {
  _editors.set(key, editor)
  _provides.set(key, provides)
}

/** Drop a registered editor + its capability claim — the J-PARITY harness's degradation lever. */
export function unregisterSpecEditor(key: string): void {
  _editors.delete(key)
  _provides.delete(key)
}

/** Resolve the editor for an `editorKey`, or undefined if none is registered. */
export function getSpecEditor(key: string): SpecEditor | undefined {
  return _editors.get(key)
}

/** The capabilities a registered editor CLAIMS to provide (empty if unknown). */
export function specEditorProvides(key: string): readonly CapabilityId[] {
  return _provides.get(key) ?? []
}

/** The union of every registered editor's claimed capabilities — the parity provider pool. */
export function providedByRegisteredEditors(): ReadonlySet<CapabilityId> {
  const all = new Set<CapabilityId>()
  for (const caps of _provides.values()) for (const c of caps) all.add(c)
  return all
}

/** Sorted registered keys — introspection / fitness gates. */
export function listSpecEditorKeys(): string[] {
  return [..._editors.keys()].sort()
}
