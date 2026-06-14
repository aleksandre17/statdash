// ── useFilterState — derives SectionContext + raw filter values from schema ──
//
//  Accepts FilterSchemaInput (page-level schema) — schema owns the state config,
//  FilterBarNode is display-only.
//
//  Grafana: template variable resolution — all variables processed at dashboard level.
//  Retool:  computed state — evaluated once at page level, all components see same values.
//

import { useRef, useMemo }   from 'react'
import { useFilter }          from '../context/FilterContext'
import type { SectionContext, TimeMode, DimVal } from '@geostat/engine'
import type { Effect, FilterSchemaInput }        from '@geostat/engine'
import { autoParse }                              from '@geostat/engine'
import type { ParamDef, ParamCascadeNode, CascadeNode } from '@geostat/engine'

// ── FilterState — return type ─────────────────────────────────────────

export interface FilterState {
  ctx:         SectionContext
  raw:         Record<string, string>
  timeModeKey: string
  effects:     Effect[]
}

// ── Stable fallbacks ──────────────────────────────────────────────────

const NO_EFFECTS: Effect[] = []

// ── useFilterState ────────────────────────────────────────────────────

export function useFilterState(schema: FilterSchemaInput | null | undefined): FilterState {
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

  // Raw values: URL state || param default
  const raw = useMemo(
    () => Object.fromEntries(flatParams.map(({ key, def }) => [key, state[key] ?? def.default])),
    [state, flatParams],
  )

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

  return { ctx: ctxRef.current, raw, timeModeKey, effects }
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