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

export function defaultStep(op: string): TransformStep {
  switch (op) {
    case 'derive':    return { op: 'derive', as: '', expr: '' }
    case 'lookup':    return { op: 'lookup', key: '', from: { $d: '' }, fields: [] }
    case 'sort':      return { op: 'sort', by: '', dir: 'asc' }
    case 'filter':    return { op: 'filter', where: {} }
    case 'melt':      return { op: 'melt', idFields: [], valueFields: [] }
    case 'rename':    return { op: 'rename', fields: {} }
    case 'cast':      return { op: 'cast', fields: {} }
    case 'concat':    return { op: 'concat', fields: [], as: '' }
    case 'template':  return { op: 'template', as: '', tpl: '' }
    case 'addField':  return { op: 'addField', name: '', value: '' }
    case 'select':    return { op: 'select', fields: [] }
    case 'aggregate': return { op: 'aggregate', groupBy: [], aggregations: [] }
    case 'rollup':    return { op: 'rollup', dim: '', as: '', of: '*', agg: 'sum' }
    case 'group':     return { op: 'group', by: [] }
    case 'reduce':    return { op: 'reduce', fn: 'sum', field: '' }
    case 'window':    return { op: 'window', fn: 'movingAvg', over: '' }
    case 'join':      return { op: 'join', with: { $cl: '' }, on: '' }
    default:          return { op: 'derive', as: '', expr: '' }
  }
}
