// ── FF-DATASPEC-AUTHORING-COMPLETE — every bind-kind is authorable (ADR-049 P1) ──
//
//  Mirrors the node FF-SCHEMA-COMPLETE, one axis over (binding, not identity): every
//  DataSpec kind in the engine's SPEC_CATALOG must resolve to a live authoring
//  surface — a `schema` rendered by the generic Inspector, OR an `editorKey` bound to
//  a boot-registered rich editor — and must seed a valid spec via its `make()`
//  factory. A kind that declares neither surface (only the steward raw-JSON
//  last-resort) FAILS this gate, so the binding port can never silently regress to a
//  drop-to-JSON cliff.
//
//  SSOT-enumerated: it iterates SPEC_CATALOG itself (not a hand-list), so a NEW kind
//  added without an authoring surface reds the build here. `pipeline` is DELIBERATELY
//  not in SPEC_CATALOG (authored via the three-pane workbench, not a picker editor —
//  coverage.fitness allowlists it), so it is correctly out of this gate's scope.
//
import { describe, it, expect } from 'vitest'
import { SPEC_CATALOG, resolveSpecAuthoring } from '@statdash/engine'
import { getSpecEditor } from './specEditorRegistry'
import { registerSpecEditors } from './registerSpecEditors'

// Populate the rich-editor registry the way boot does (idempotent self-register on
// import; the explicit call guards against import-order surprises in the runner).
registerSpecEditors()

const KINDS = Object.keys(SPEC_CATALOG)

describe('FF-DATASPEC-AUTHORING-COMPLETE — every SPEC_CATALOG kind is authorable (ADR-049 P1)', () => {
  it('the catalog is non-trivially populated (guard is running)', () => {
    expect(KINDS.length).toBeGreaterThanOrEqual(8)
  })

  it('every kind seeds a valid spec of its OWN type via make()', () => {
    const gaps: string[] = []
    for (const kind of KINDS) {
      const seed = resolveSpecAuthoring(kind)?.make()
      if (!seed || seed.type !== kind) gaps.push(`${kind} → ${seed ? seed.type : 'no make()'}`)
    }
    expect(gaps, `kinds whose make() does not seed their own type: ${gaps.join(', ')}`).toEqual([])
  })

  it('every kind resolves to EXACTLY ONE authoring arm (schema xor a registered editor)', () => {
    const gaps: string[] = []
    for (const kind of KINDS) {
      const d = resolveSpecAuthoring(kind)!
      const hasSchema = Array.isArray(d.schema) && d.schema.length > 0
      const hasEditor = d.editorKey != null && getSpecEditor(d.editorKey) != null
      if (!hasSchema && !hasEditor)
        gaps.push(`${kind} — NO surface (declares neither a schema nor a registered editorKey)`)
      if (hasSchema && d.editorKey != null)
        gaps.push(`${kind} — BOTH a schema and an editorKey (ambiguous authoring arm)`)
      if (d.editorKey != null && !hasEditor)
        gaps.push(`${kind} — editorKey '${d.editorKey}' has no registered editor`)
    }
    expect(gaps, `authoring-surface gaps: ${gaps.join(' | ')}`).toEqual([])
  })
})
