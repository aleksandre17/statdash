// ── defaultStep — sensible empty TransformStep per op (never-broken canvas) ────
//
//  Every authorable op gets a valid, minimal starting step so adding a step from
//  the picker yields a config the engine can carry and the Inspector can edit
//  (Fitness #4: never-broken canvas). Mirrors getDefaults for nodes.
//
//  Keyed by the op string (the engine SSOT key). An op not listed here falls back
//  to a derive step — but every op offered by the PipelineBuilder picker IS listed
//  (joinByField is excluded from the picker: it carries resolved rows).
//
import type { TransformStep } from '@statdash/engine'

/** The placeholder name a field-PRODUCING op writes its new column under, so the
 *  inserted step is VALID immediately (SPEC §9 / ADR-046 pre-note #3): a derive/
 *  template/addField/concat with an EMPTY produced-field name throws or writes an
 *  empty key at runtime — a broken step the moment it is inserted. A non-empty
 *  placeholder (the author renames it) keeps the grid + canvas green through
 *  authoring; the placeholder is an identifier, not a user-facing label. */
const NEW_FIELD = 'newField'

/**
 * Every authorable op gets a VALID, minimal starting step (Fitness #4 / ADR-046
 * pre-note #3: never-broken canvas). "Valid" means the engine op can run it without
 * throwing the moment it is inserted — the field-producing ops carry a placeholder
 * produced-field name + a trivial expression, the rest are no-ops over the rows.
 */
export function defaultStep(op: string): TransformStep {
  switch (op) {
    // Field-producing ops — a non-empty produced name + trivial value keeps them valid.
    case 'derive':    return { op: 'derive', as: NEW_FIELD, expr: '0' }
    case 'template':  return { op: 'template', as: NEW_FIELD, tpl: '' }
    case 'addField':  return { op: 'addField', name: NEW_FIELD, value: '' }
    case 'concat':    return { op: 'concat', fields: [], as: NEW_FIELD }
    // No-op / harmless minimal shapes (run cleanly, shape nothing until authored).
    case 'lookup':    return { op: 'lookup', key: '', from: { $d: '' }, fields: [] }
    case 'sort':      return { op: 'sort', by: '', dir: 'asc' }
    case 'filter':    return { op: 'filter', where: {} }
    case 'melt':      return { op: 'melt', idFields: [], valueFields: [] }
    case 'rename':    return { op: 'rename', fields: {} }
    case 'cast':      return { op: 'cast', fields: {} }
    case 'select':    return { op: 'select', fields: [] }
    case 'aggregate': return { op: 'aggregate', groupBy: [], aggregations: [] }
    case 'rollup':    return { op: 'rollup', dim: '', as: NEW_FIELD, of: '*', agg: 'sum' }
    case 'group':     return { op: 'group', by: [] }
    case 'reduce':    return { op: 'reduce', fn: 'sum', field: '' }
    case 'window':    return { op: 'window', fn: 'movingAvg', over: '' }
    case 'join':      return { op: 'join', with: { $cl: '' }, on: '' }
    default:          return { op: 'derive', as: NEW_FIELD, expr: '0' }
  }
}
