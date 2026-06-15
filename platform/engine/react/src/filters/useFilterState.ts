// ── useFilterState — derives SectionContext + raw filter values from schema ──
//
//  Accepts FilterSchemaInput (page-level schema) — schema owns the state config,
//  FilterBarNode is display-only.
//
//  Grafana: template variable resolution — all variables processed at dashboard level.
//  Retool:  computed state — evaluated once at page level, all components see same values.
//

import { useRef, useMemo, useCallback } from 'react'
import { useFilter }                     from '../context/FilterContext'
import type { SectionContext, TimeMode, DimVal } from '@geostat/engine'
import type { Effect, FilterSchemaInput }        from '@geostat/engine'
import type { DataStore }                        from '@geostat/engine'
import { autoParse, resolveDefaults }            from '@geostat/engine'
import { resolveYears, resolveOptions }          from '@geostat/engine'
import type { ParamDef, ParamCascadeNode, CascadeNode } from '@geostat/engine'
import type { ParamYearSelect, ParamSelect, ParamMultiSelect } from '@geostat/engine'
import type { EngineRow }                        from '@geostat/engine'
import type { BarNode, ParamNode }               from '@geostat/engine'

// ── FilterState — return type ─────────────────────────────────────────

export interface FilterState {
  ctx:         SectionContext
  raw:         Record<string, string>
  timeModeKey: string
  effects:     Effect[]
  bars:        BarNode[]
  /** True when one or more Tier 3 (OptionsDefault) defaults are still loading. */
  isLoading:   boolean
}

// ── schemaToBarNodes — local helper, converts FilterSchemaInput to BarNode[] ──

function schemaToBarNodes(schema: FilterSchemaInput | null | undefined): BarNode[] {
  if (!schema) return []
  return Object.entries(schema.bars).map(([barId, barDef]): BarNode => ({
    type:       'bar',
    id:         barId,
    position:   barDef.position,
    order:      barDef.order,
    layout:     barDef.layout,
    timeToggle: barDef.timeToggle,
    timeModes:  barDef.timeModes,
    showWhen:   barDef.showWhen,
    items:      Object.entries(barDef.filters).map(([key, paramDef]) => ({
      key,
      ...paramDef,
    } as ParamNode)),
  }))
}

// ── Stable fallbacks ──────────────────────────────────────────────────

const NO_EFFECTS: Effect[] = []

// Minimal SectionContext stub used when resolving Tier 3 option defaults.
// At this point the real context hasn't been computed yet (chicken-and-egg):
// options lists feed the context, not the other way around. Static/inline
// sources ignore ctx.dims entirely, so this stub is safe for Phase 1.
const STUB_CTX: SectionContext = { timeMode: 'year', dims: {} }

// ── useFilterState ────────────────────────────────────────────────────

export function useFilterState(
  schema: FilterSchemaInput | null | undefined,
  store?:  DataStore | null,
): FilterState {
  const { state } = useFilter()

  // Flatten all [key, ParamDef] pairs from all bars — order within each bar preserved.
  const flatParams: Array<{ key: string; def: ParamDef }> = useMemo(
    () =>
      Object.values(schema?.bars ?? {}).flatMap(bar =>
        Object.entries(bar.filters).map(([key, def]) => ({ key, def })),
      ),
    // schema is static config — deps empty intentional
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  // Tier 3 options getter — maps a param key to its EngineRow list for
  // OptionsDefault { from: 'options', pick: 'first' | 'last' } resolution.
  // Returns null when the store is unavailable or the param type doesn't
  // use an options list (cascade, hidden, range — skip Tier 3).
  const getOptions = useCallback(
    (key: string): EngineRow[] | null => {
      if (!store) return null
      const found = flatParams.find(p => p.key === key)
      if (!found) return null
      const { def } = found
      if (def.type === 'year-select') {
        const years = resolveYears((def as ParamYearSelect).years, store, STUB_CTX)
        return years.map(y => ({ code: String(y) }) as EngineRow)
      }
      if (def.type === 'select' || def.type === 'multi-select') {
        const opts = resolveOptions(
          (def as ParamSelect | ParamMultiSelect).options,
          store,
          STUB_CTX,
        )
        return opts.map(o => ({ code: o.value }) as EngineRow)
      }
      // cascade, hidden, range, chip-select: Tier 3 not applicable
      return null
    },
    [flatParams, store],
  )

  // Pass 1 — resolve DefaultSpec for every param whose key is absent in URL state.
  //   Tier 1 (literal DimVal) and Tier 3 (OptionsDefault) are resolved here.
  //   Tier 2 (ExprVal) is resolved in topological order inside resolveDefaults.
  //   Pass 2 (re-resolving after effects null a key) is a follow-up task: effects
  //   are applied by the caller (SiteRenderer) after this hook returns, so any
  //   key they set to null would need a second resolveDefaults call on the next
  //   render — tracked as Step 3.2d.
  const { dims: resolvedDims, pendingKeys } = useMemo(
    () => resolveDefaults(flatParams, state, getOptions),
    [flatParams, state, getOptions],
  )

  // raw: Record<string, string> — callers depend on string values throughout.
  const raw       = resolvedDims
  const isLoading = pendingKeys.length > 0

  // SectionContext — computed-ref pattern (stable identity when unchanged)
  const ctxKeyRef   = useRef('')
  const ctxRef      = useRef<SectionContext>({ timeMode: 'year', dims: {} })

  const context     = schema?.context
  const ctxTimeMode = context
    ? ((raw[context.timeMode] as TimeMode) || 'year')
    : 'year'

  const dimsKey = context?.dims
    ? Object.entries(context.dims)
        .map(([dk, pk]) => `${dk}:${raw[pk] ?? ''}`)
        .join(',')
    : ''

  // cascade dim contributions: deepest selected node code → ctx.dims[dim]
  const cascadeEntries = flatParams
    .filter((p): p is { key: string; def: ParamCascadeNode } =>
      p.def.type === 'cascade' && !!(p.def as ParamCascadeNode).dim,
    )
    .map(({ key, def }) => {
      const cascDef = def as ParamCascadeNode
      return [
        cascDef.dim!,
        cascadeDeepestCode(cascDef.tree, raw[key], cascDef.dimField ?? 'code'),
      ] as const
    })
    .filter(([, code]) => code !== '')

  const ctxKey = `${ctxTimeMode}|${dimsKey}|${cascadeEntries.map(([k, v]) => `${k}:${v}`).join(',')}`

  if (ctxKey !== ctxKeyRef.current) {
    ctxKeyRef.current = ctxKey
    const regularDims = context?.dims
      ? Object.fromEntries(
          Object.entries(context.dims)
            .map(([dk, pk]) => {
              const paramDef = flatParams.find(p => p.key === pk)?.def
              const parsed   = paramDef ? autoParse(paramDef, raw[pk]) : raw[pk]
              return [dk, parsed as DimVal]
            })
            .filter(([, v]) => v !== ''),
        )
      : {}
    ctxRef.current = {
      timeMode: ctxTimeMode,
      dims:     { ...regularDims, ...Object.fromEntries(cascadeEntries) },
    }
  }

  const timeModeKey = context?.timeMode ?? 'mode'
  const effects     = schema?.effects ?? NO_EFFECTS
  const bars        = useMemo(() => schemaToBarNodes(schema), [schema])

  return { ctx: ctxRef.current, raw, timeModeKey, effects, bars, isLoading }
}

// ── cascadeDeepestCode — traverse cascade path to deepest selected node ──

function cascadeDeepestCode(
  tree:     CascadeNode[],
  rawValue: string,
  field:    string,
): string {
  if (!rawValue) return ''
  const ids = rawValue.split(',').map(Number)
  let nodes: CascadeNode[] = tree
  let code = ''
  for (const id of ids) {
    const node = nodes.find(n => n.id === id)
    if (!node) break
    code  = (node as unknown as Record<string, unknown>)[field] as string ?? ''
    nodes = node.children ?? []
  }
  return code
}