// ── perspectiveScopeSchemaSource — Inspector schema port for a PerspectiveDef.scope [P-final] ──
//
//  The Constructor's ONE generic Inspector renders any element's property panel
//  from a PropSchema resolved through a SchemaSource port. A perspective's `scope`
//  (its per-perspective EFFECT bag — timeBinding / metric / …) is just another such
//  element: each scope KEY carries an authoring PropSchema in the engine's
//  perspective-scope-key registry (perspective-scope-registry, OCP). This source
//  UNIONS every registered key's schema — so the scope is authored by the SAME
//  Inspector that renders node / panel / chrome / transform-step / ParamDef /
//  visibility-leaf properties, with NO bespoke per-key form (the ADR mandate,
//  mirroring filterParamSchemaSource / visibilityLeafSchemaSource).
//
//  THE Law-8 / OCP move: the pane is DRIVEN by the registry. A new scope door
//  (store / dims / blend / facet) becomes authorable the moment it calls
//  registerPerspectiveScopeKey() — this source enumerates it via
//  listPerspectiveScopeKeys(), zero pane-code edit. The coverage gate's 5th axis
//  (PERSPECTIVE_SCOPE_KEYS) is satisfied by the SAME registry this source reads, so
//  "the Constructor sees only what's registered" holds for the perspective scope too.
//
//  Dot-path prefixing: a scope-key schema declares its fields relative to the key
//  (e.g. `timeBinding.dim`, `timeBinding.pin`, `metric`). The author edits the whole
//  PerspectiveDef, whose `scope` lives at `def.scope`, so each field is re-prefixed
//  to the `scope.` dot-path the Inspector reads/writes (`scope.timeBinding.dim`) —
//  the IDENTICAL re-prefix pageSchemaSource applies to `presentation.*` projector
//  fields. getAtPath/setAtPath then read/write the field where it is displayed from.
//
import { listPerspectiveScopeKeys, getPerspectiveScopeKeySchema } from '@statdash/engine'
import type { PropSchema } from '@statdash/react/engine'
import type { SchemaSource } from '../../inspector/schemaSource'

/**
 * The union of every registered scope-key's authoring PropSchema, each field
 * re-prefixed to the `scope.<key-path>` dot-path. Built lazily (a function, not a
 * const) because scope keys register at module load — at module-eval time the
 * registry may not yet be imported; calling it at render time is always populated.
 *
 * Order follows listPerspectiveScopeKeys() (sorted), so the rendered fields are
 * stable across renders (timeBinding before metric, deterministically).
 */
export function perspectiveScopeSchema(): PropSchema {
  const out: PropSchema = []
  for (const key of listPerspectiveScopeKeys()) {
    const schema = getPerspectiveScopeKeySchema(key)
    if (!schema) continue
    for (const field of schema) {
      out.push({ ...field, field: `scope.${field.field}` })
    }
  }
  return out
}

/**
 * SchemaSource for a perspective's scope. Identity-independent (every perspective's
 * scope is authored by the same registered keys), so it ignores the passed node and
 * returns the registry-driven schema. No accordion grouping (the scope fields are a
 * flat set under the pane's "Scope" section). The PerspectiveDefEditor models the
 * PerspectiveDef as a CanvasNode so the SAME Inspector path renders it.
 */
export const perspectiveScopeSchemaSource: SchemaSource = {
  getSchema: () => perspectiveScopeSchema(),
  getGroups: () => [],
}
