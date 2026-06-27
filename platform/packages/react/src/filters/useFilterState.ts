// ── useFilterState — derives SectionContext + raw filter values from schema ──
//
//  Accepts FilterSchemaInput (page-level schema) — schema owns the state config,
//  FilterBarNode is display-only.
//
//  Grafana: template variable resolution — all variables processed at dashboard level.
//  Retool:  computed state — evaluated once at page level, all components see same values.
//

import { useMemo, useCallback } from 'react'
import { useFilter }                     from '../context/FilterContext'
import type { SectionContext, TimeMode, DimVal } from '@statdash/engine'
import type { Effect, FilterSchemaInput }        from '@statdash/engine'
import type { DataStore }                        from '@statdash/engine'
import { autoParse, resolveDefaults, evalWhen }  from '@statdash/engine'
import { resolveYears, resolveOptions }          from '@statdash/engine'
import type { WhenMap }                          from '@statdash/engine'
import type { ParamDef, ParamCascadeNode, CascadeNode } from '@statdash/engine'
import type { ParamYearSelect, ParamSelect, ParamMultiSelect, ParamHidden } from '@statdash/engine'
import type { EngineRow }                        from '@statdash/engine'
import type { BarNode, ParamNode }               from '@statdash/engine'

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

  // Flatten all [key, ParamDef] pairs from all bars — order within each bar
  // preserved. Each entry keeps its owning bar's `showWhen` so default
  // resolution can be gated by the bar's current visibility (below).
  const flatParamEntries: Array<{ key: string; def: ParamDef; barShowWhen?: WhenMap }> = useMemo(
    () =>
      Object.values(schema?.bars ?? {}).flatMap(bar =>
        Object.entries(bar.filters).map(([key, def]) => ({ key, def, barShowWhen: bar.showWhen })),
      ),
    // schema is static config — deps empty intentional
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const flatParams: Array<{ key: string; def: ParamDef }> = flatParamEntries

  // Defaults must NOT be resolved for a param whose bar is hidden in the current
  // mode (its bar's `showWhen` fails for `state`). A time-mode toggle hides one
  // bar and shows another (e.g. year-bar `mode≠range` vs range-bar `mode=range`);
  // an effect clears the hidden bar's keys, but resolveDefaults would otherwise
  // immediately RE-FILL them from their DefaultSpec — re-pinning a single `year`
  // in range/dynamics mode. That spurious `time` pin makes the query resolver's
  // range-mode read (unbounded → client-clamp) collapse to one warmed year on the
  // async store (the timeseries shows a single bar). Gating by bar visibility
  // keeps the inactive bar's params unset, so range mode stays time-unbounded and
  // year mode stays range-unbounded — the modes do not cross-pin each other.
  //
  // EXCEPTION — `alwaysResolve` (bar-independent default): a SPAN/CUBE-derived
  // hidden param (e.g. spanFrom/spanTo, the full data extent) is a PAGE-level state
  // variable, not a property of one bar's visibility. It must resolve in EVERY mode,
  // so it is hoisted OUT of the visibility gate — letting it be declared ONCE rather
  // than copy-pasted into each time-mode bar (the OCP-clean, Constructor-ready form).
  const defaultParams = useMemo(
    () =>
      flatParamEntries
        .filter(({ def, barShowWhen }) =>
          isAlwaysResolve(def) || !barShowWhen || evalWhen(barShowWhen, state),
        )
        .map(({ key, def }) => ({ key, def })),
    [flatParamEntries, state],
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
      // hidden WITH an options source: a derived state variable whose default
      // follows the cube (e.g. span min/max). Resolve identically to select so
      // its Tier 3 OptionsDefault pick:first/last lands on a real member. A
      // plain hidden (no options) carries only a literal default → null here.
      if (def.type === 'hidden' && (def as ParamHidden).options) {
        const opts = resolveOptions((def as ParamHidden).options!, store, STUB_CTX)
        return opts.map(o => ({ code: o.value }) as EngineRow)
      }
      // cascade, plain hidden, range, chip-select: Tier 3 not applicable
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
    () => resolveDefaults(defaultParams, state, getOptions),
    [defaultParams, state, getOptions],
  )

  // raw: Record<string, string> — callers depend on string values throughout.
  const raw       = resolvedDims
  const isLoading = pendingKeys.length > 0

  const context     = schema?.context
  // context.timeMode is now OPTIONAL (P1 expand-contract): a page that declares a
  // PerspectiveAxis carries no legacy timeMode binding. Absent ⇒ default 'year'.
  const ctxTimeMode = context?.timeMode
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

  // SectionContext — stable identity keyed on ctxKey. useMemo returns the same
  // reference until ctxKey changes, so downstream consumers don't re-render on
  // unrelated parent renders. (ctxKey is the exhaustive derived dependency; the
  // values it is built from — ctxTimeMode, dims, cascade codes — all feed into
  // it, so re-deriving inside the memo is correct and ref-write-free.)
  const ctx = useMemo<SectionContext>(() => {
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
    return {
      timeMode: ctxTimeMode,
      dims:     { ...regularDims, ...Object.fromEntries(cascadeEntries) },
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ctxKey is the exhaustive derived key (see comment above)
  }, [ctxKey])

  const timeModeKey = context?.timeMode ?? 'mode'
  const effects     = schema?.effects ?? NO_EFFECTS
  const bars        = useMemo(() => schemaToBarNodes(schema), [schema])

  return { ctx, raw, timeModeKey, effects, bars, isLoading }
}

// ── isAlwaysResolve — bar-independent default predicate ──────────────────
//
//  True for a hidden param flagged `alwaysResolve` — a page-level state variable
//  (span/cube-derived) whose default resolves regardless of its bar's visibility.
//  Only `hidden` params carry the flag (the type union gates it); any other param
//  type is bar-gated as before.
function isAlwaysResolve(def: ParamDef): boolean {
  return def.type === 'hidden' && (def as ParamHidden).alwaysResolve === true
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