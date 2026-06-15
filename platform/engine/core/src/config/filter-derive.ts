// ── FilterDerive — declarative derive expressions ─────────────────────────────
//
//  Replaces (values) => any function derives.
//  100% JSON-serializable (Phase 2: Constructor generates without code).
//
//  Phase 1: 'source' and 'tree' fields are JS object references.
//  Phase 2: replace with { $ref: 'registryKey' } + data registry.
//
//  Commercial equivalents:
//    Grafana   — variable transformations (calculate field, organize fields)
//    Retool    — computed value expressions: {{ source.find(r => r.id === sel).field }}
//    AppSmith  — JSX-free computed properties (data bindings)
//

import type { Classifier, DimRef, DisplayMap } from '../sdmx'
import type { WhenMap }                        from './filter-condition'
import type { CascadeNode }                    from './filter-params'
import { isDimRef, resolveDimRef }             from '../data/codelist'
import { evalWhen }                            from './filter-condition'
import type { ExprVal }                        from '@geostat/expr'

// ── Observability seam ────────────────────────────────────────────────
//
//  The engine never imports import.meta or couples to a console.
//  The app layer registers an optional observer (once, at startup) and
//  receives a warning when a FilterDerive is evaluated with a Phase-2-
//  incompatible inline-array source.  Engine ships pure.
//
//  Usage (app layer, dev-only):
//    import { setFilterDeriveObserver } from '@geostat/engine'
//    if (import.meta.env.DEV) {
//      setFilterDeriveObserver((key, op) => { … })
//    }
//

/** Observer called when a FilterDerive is evaluated with a Phase-2-incompatible inline source. */
export type FilterDeriveObserver = (key: string, opName: string) => void

let _observer: FilterDeriveObserver | undefined

/** Register a single dev-time observer for inline-array source warnings. Call once at app startup. */
export function setFilterDeriveObserver(fn: FilterDeriveObserver): void {
  _observer = fn
}

export type FilterDerive =
  /** Map a param string value to any via a lookup table. */
  | { op: 'lookup';     key: string; map: Record<string, unknown>; fallback?: unknown }
  /**
   * Find item in source where item[idField] === values[by]; optionally extract a field.
   * source  — inline array OR dim ref (`{ $cl }` for structural, `{ $d }` for UI).
   * idField — which property on each source item holds the id (default: 'id').
   *           Use 'code' when source is a classifier/display items view.
   */
  | { op: 'find';       source: DimRef | readonly Record<string, unknown>[]; by: string; idField?: string; field?: string; fallback?: unknown }
  /** Extract a field from the root cascade-tree item matching the first id in values[key]. */
  | { op: 'tree-field'; key: string; tree: readonly CascadeNode[]; field: string; fallback?: unknown }
  /** Conditional: if WhenMap passes → then; else → else (or { $ref: paramKey } for param value). */
  | { op: 'if-else';    when: WhenMap; then: unknown; else: { $ref: string } | unknown }
  /**
   * Build breadcrumbs: static prefix + dynamic label from source keyed by values[by].
   * source  — inline array OR dim ref (`{ $cl }` or `{ $d }`).
   * idField — see `find` (default: 'id').
   */
  | { op: 'breadcrumbs'; prefix: Array<{ label: string; href?: string }>; source: DimRef | readonly Record<string, unknown>[]; by: string; idField?: string; labelField: string }
  /** Test if raw[source] contains sub — returns match when true, fallback otherwise. */
  | { op: 'contains'; source: string; sub: string; match: string; fallback: string }
  /**
   * Split raw[by] on ',' → look up each id in source → join labels.
   * Handles both single and multi-select values uniformly.
   * separator defaults to ' · '; fallback used when no ids found.
   * maxItems: when id count exceeds this, return overflow instead of joining.
   */
  | { op: 'join-labels'; source: DimRef | readonly Record<string, unknown>[]; by: string; idField?: string; labelField?: string; separator?: string; fallback?: string; maxItems?: number; overflow?: string }

/**
 * DeriveContext — services injected into derive evaluation. Consulted when a
 * derive op's `source` is a `{ $cl: 'dim' }` reference.
 *
 *   classifiers — structural codelists (id → { code, parent? })
 *   display     — UI overlay merged onto entries at resolution
 */
export interface DeriveContext {
  classifiers?: Record<string, Classifier>
  display?:     Record<string, DisplayMap>
}

function resolveSource(
  source: DimRef | readonly Record<string, unknown>[],
  classifiers?: Record<string, Classifier>,
  display?:     Record<string, DisplayMap>,
): readonly Record<string, unknown>[] {
  if (!isDimRef(source)) return source
  const resolved = resolveDimRef(source, classifiers, display, 'items')
  return Array.isArray(resolved) ? resolved as readonly Record<string, unknown>[] : []
}

/** Pure evaluator for FilterDerive — no side effects, no React, no async. */
export function evalFilterDerive(
  expr:   FilterDerive,
  values: Record<string, unknown>,
  raw:    Record<string, string>,
  ctx?:   DeriveContext,
): unknown {
  switch (expr.op) {
    case 'lookup': {
      return expr.map[values[expr.key] as string] ?? expr.fallback ?? ''
    }
    case 'find': {
      if (Array.isArray(expr.source)) _observer?.('source', expr.op)
      const src    = resolveSource(expr.source, ctx?.classifiers, ctx?.display)
      const id     = values[expr.by]
      const idKey  = expr.idField ?? 'id'
      const found  = src.find((r) => r[idKey] === id) ?? src[0] ?? null
      if (!found) return expr.fallback ?? null
      return expr.field ? (found[expr.field] ?? expr.fallback ?? null) : found
    }
    case 'tree-field': {
      const ids     = values[expr.key] as number[] | undefined
      const firstId = Array.isArray(ids) ? ids[0] : undefined
      const found   = firstId != null ? expr.tree.find((n) => n.id === firstId) : undefined
      return found
        ? ((found as unknown as Record<string, unknown>)[expr.field] ?? expr.fallback ?? null)
        : (expr.fallback ?? null)
    }
    case 'if-else': {
      const matches = evalWhen(expr.when, raw)
      const result  = matches ? expr.then : expr.else
      if (result != null && typeof result === 'object' && '$ref' in (result as object)) {
        return values[(result as { $ref: string }).$ref]
      }
      return result
    }
    case 'breadcrumbs': {
      if (Array.isArray(expr.source)) _observer?.('source', expr.op)
      const src   = resolveSource(expr.source, ctx?.classifiers, ctx?.display)
      const id    = values[expr.by] as string
      const idKey = expr.idField ?? 'id'
      const found = src.find((r) => r[idKey] === id)
      return [
        ...expr.prefix,
        { label: (found ? found[expr.labelField] : '') as string },
      ]
    }
    case 'contains': {
      return (raw[expr.source] ?? '').includes(expr.sub) ? expr.match : expr.fallback
    }
    case 'join-labels': {
      if (Array.isArray(expr.source)) _observer?.('source', expr.op)
      const src    = resolveSource(expr.source, ctx?.classifiers, ctx?.display)
      const ids    = (raw[expr.by] ?? '').split(',').filter(Boolean)
      if (!ids.length) return expr.fallback ?? ''
      if (expr.maxItems !== undefined && ids.length > expr.maxItems) return expr.overflow ?? String(ids.length)
      const idKey  = expr.idField    ?? 'id'
      const lblKey = expr.labelField ?? 'label'
      const sep    = expr.separator  ?? ' · '
      return ids
        .map((id) => { const r = src.find((x) => x[idKey] === id); return r ? String(r[lblKey] ?? id) : id })
        .join(sep)
    }
  }
}

// ── VarMap — page-level derived variable declarations ────────────────────────
//
//  First-class page-level concept. Isolated from filter controls.
//  Lives on PageConfig.vars — evaluated after filter resolution, before render.
//  Accessible in every renderer via ctx.vars.
//
//  Grafana: Template Variables — page-level, independent of panels.
//  Retool:  Computed State — page-level, components bind to it.
//  Power BI: DAX Measures — defined once, used by any visual.
//

/**
 * Page-level derived variable map.
 * Values are either FilterDerive (data-aware ops: find/breadcrumbs/join-labels/…)
 * or ExprVal from @geostat/expr (pure expressions: if/includes/eq/…).
 * SiteRenderer routes each entry to the correct evaluator.
 */
export type VarMap = Record<string, FilterDerive | ExprVal>

// ── FilterBarNode — filter bar display node (display-only) ───────────────────
//
//  Display placeholder only. Schema lives in PageConfig.filterSchema.
//  FilterBarShell reads from FilterProvider (set up by SiteRenderer from filterSchema).
//
//  Grafana: the panel that renders variable controls is separate from the variable list.
//  barIds: when absent → render all bars; when present → render only named bars.
//

export interface FilterBarNode {
  type:    'filter-bar'
  barIds?: string[]
}
