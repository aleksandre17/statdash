// ── nestedItemPlacement — a nested subject's SHAPE, derived from its schema (SL-4) ─
//
//  The Placement Law (`studio/placement`) is deliberately DOMAIN-FREE: it weighs an
//  abstract `SubjectShape` (flat-field count · nesting · depth · rich-type) and maps
//  scope × weight → container. It does NOT know what a `PropSchema` is. So the
//  translation from an authoring schema to that abstract shape lives HERE, in the
//  consumer that owns the schema (the nested-item editor) — never in the pure kernel.
//
//  This is the SL-4 escalation input: at a drill boundary, the nested-item editor
//  asks `nestedItemContainer(field)` where the subject it is about to enter belongs.
//  The verdict is `resolveSurface('nested-item', weight)` — a PURE function of the
//  subject's shape — so a workspace-weight subject (a rich-type item, a deep tree)
//  deterministically resolves to `'focus-view'` (escalate OUT of the dock) while a
//  light/structured one stays `'inline' | 'dock-drill'` (unchanged D7.1b behaviour).
//  There is NO per-type literal: the container is derived, never hand-placed.
//
import type { PropField, PropFieldType, PropSchema } from '@statdash/react/engine'
import { placeSubject, WEIGHT_THRESHOLDS, type Container, type SubjectShape } from '../../studio/placement'

// ── Rich value types (§3.1) — a field of one of these is workspace-weight ───────
//
//  A field whose value is a whole engine sub-document — a DataSpec (a query) or a
//  ChartDef (a chart grammar) — is a WORKSPACE subject regardless of breadth: it
//  needs its own screen, not a dock slot (SPEC §3.1 "dominated by a rich type").
//  The set is the PropFieldType projection of the law's abstract `hasRichType` —
//  the law never names a type; this consumer maps its own types onto the flag.
//
const RICH_FIELD_TYPES: ReadonlySet<PropFieldType> = new Set<PropFieldType>(['DataSpec', 'ChartDef'])

/** Is this field a STRUCTURED nested container (an array/object with an itemSchema)? */
function isStructuredNested(field: PropField): boolean {
  return (field.type === 'array' || field.type === 'object') && field.itemSchema != null
}

// ── schemaDepth — the maximum structural nesting of a schema (bounded, pure) ────
//
//  Walks itemSchema recursively; the guard caps the walk at the law's drill budget
//  so a malformed/cyclic itemSchema (a meta bug) can never loop. A subject whose own
//  structure already exceeds the budget is oversize by construction.
//
function schemaDepth(schema: PropSchema, guard = 0): number {
  if (guard > WEIGHT_THRESHOLDS.maxDrillDepth) return guard
  let max = 0
  for (const f of schema) {
    if (isStructuredNested(f)) max = Math.max(max, 1 + schemaDepth(f.itemSchema!, guard + 1))
  }
  return max
}

// ── schemaSubjectShape — PropSchema → the abstract SubjectShape the law weighs ──
//
//  Pure + total. Scalars (and OPAQUE array/object fields with no itemSchema, which
//  fall back to a single raw-JSON control) count as flat fields; a structured nested
//  field marks `hasNested`; a rich-typed field marks `hasRichType` (dominates → the
//  subject escalates out). `depth` is the subject's own structural depth.
//
export function schemaSubjectShape(schema: PropSchema): SubjectShape {
  let flatFields = 0
  let hasNested = false
  let hasRichType = false
  for (const f of schema) {
    if (RICH_FIELD_TYPES.has(f.type)) hasRichType = true
    else if (isStructuredNested(f)) hasNested = true
    else flatFields += 1 // scalar, or an opaque array/object → one raw-JSON control
  }
  return { flatFields, hasNested, depth: schemaDepth(schema), hasRichType }
}

/** The abstract shape of the subject you DRILL INTO when entering this field — an
 *  array item's fields, or a nested object's fields, are the field's `itemSchema`. */
export function fieldSubjectShape(field: PropField): SubjectShape {
  return schemaSubjectShape(field.itemSchema ?? [])
}

/** Where a nested-item subject with the given schema belongs — the SL-4 verdict.
 *  `'focus-view'` ⇒ escalate OUT of the dock; anything else ⇒ stay a dock drill. */
export function nestedItemContainer(schema: PropSchema): Container {
  return placeSubject('nested-item', schemaSubjectShape(schema))
}

/** True when the subject with this schema is workspace-weight and must escalate to a
 *  focus-view rather than drill in the bounded dock (FF-NO-CRAMMED-DOCK). */
export function shouldEscalate(schema: PropSchema): boolean {
  return nestedItemContainer(schema) === 'focus-view'
}
