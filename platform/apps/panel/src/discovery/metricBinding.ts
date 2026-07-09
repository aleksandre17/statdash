// ── metricBinding — the pure schema-driven metric→block bind (AR-49 M0 item 9) ──
//
//  The HEART of the Metric Palette's bind affordance: binding a governed metric to
//  a block writes the metric-id into the block's MEASURE FIELD, and the config that
//  lands is BYTE-IDENTICAL to what the generic Inspector would author (spec §3).
//
//  How byte-identity is guaranteed (not asserted by hope):
//    • The measure field is NOT hardcoded per block type (that would be a Law-1 /
//      OCP violation — a privileged path map). It is DISCOVERED from the block's
//      own PropSchema: the metric-ref field is the descriptor whose
//      `type === 'enum-ref'` and `source === 'metrics'` (the governed metric
//      picker item 10 declares on each data block). Its `field` dot-path IS the
//      block's measure field.
//    • The write is `setAtPath(props, field, metricId)` — the EXACT immutable dual
//      of the path the Inspector's EnumRefField reads/writes (getAtPath/setAtPath,
//      the engine SSOT re-exported via inspector/showWhen). Same path, same value
//      (a metric-id, never a raw code) ⇒ the produced props are identical to a
//      hand-author picking that metric in the Inspector. Both gestures (drag +
//      click/keyboard) funnel through here, so there is ONE write and the two
//      input paths are provably identical (mirrors fieldwells/binding.ts).
//
//  Graceful degradation: a block whose schema declares no metric-ref field is not
//  a bind target — `firstMetricField` returns null and the caller no-ops (the
//  palette simply does not bind onto it). Until item 10 declares the governed
//  pickers on the data blocks, no block is a live target; this module is complete
//  and correct the moment those fields land — no consumer change (OCP).
//
//  Law 2 (declarative): the write is a metric-id string — data, never a function.
//  Law 1 (no privileged dims): the target is discovered generically from the
//  schema; no block type or field name is special-cased here.
//
import type { PropField, PropSchema } from '@statdash/react/engine'
import { setAtPath } from '../inspector/showWhen'
import { isSemanticSource } from './semanticCatalogOptions'

/**
 * The metric-ref field descriptors in a block's PropSchema — the governed measure
 * pickers (`type:'enum-ref', source:'metrics'`). Usually zero or one; returns all
 * so a future multi-measure block is supported without a shape change. Order is
 * schema-declaration order (deterministic).
 */
export function metricRefFields(schema: PropSchema): PropField[] {
  return schema.filter(
    (f) => f.type === 'enum-ref' && isSemanticSource(f.source) && f.source === 'metrics',
  )
}

/**
 * The block's PRIMARY metric field — the first declared metric-ref, or null when
 * the block declares none (⇒ not a bind target). The bind writes the metric-id
 * into this field's dot-path.
 */
export function firstMetricField(schema: PropSchema): PropField | null {
  return metricRefFields(schema)[0] ?? null
}

/**
 * True when a block can receive a metric bind (its schema declares ≥1 metric-ref
 * field). Drives the palette's affordance state (bindable vs. hint) and the
 * canvas drop-target eligibility.
 */
export function isMetricBindable(schema: PropSchema): boolean {
  return firstMetricField(schema) !== null
}

/**
 * Pure props write: bind `metricId` into a block's measure field at `fieldPath`.
 * Returns the next props (immutable — untouched branches keep their reference, so
 * Zustand change-detection + command-pattern undo/redo see only the touched path,
 * exactly like every other Inspector edit). Byte-identical to authoring the metric
 * in the Inspector's EnumRefField.
 */
export function bindMetricToProps(
  props: Record<string, unknown>,
  fieldPath: string,
  metricId: string,
): Record<string, unknown> {
  return setAtPath(props, fieldPath, metricId) as Record<string, unknown>
}
