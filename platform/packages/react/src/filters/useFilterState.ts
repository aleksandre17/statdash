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
import type { SectionContext, DimVal } from '@statdash/engine'
import type { FilterSchemaInput }                from '@statdash/engine'
import type { DataStore }                        from '@statdash/engine'
import { autoParse, resolveDefaults, LEGACY_MODE_PARAM } from '@statdash/engine'
import { resolveYears, resolveOptions }          from '@statdash/engine'
import type { ParamDef, ParamCascadeNode, CascadeNode } from '@statdash/engine'
import type { ParamYearSelect, ParamSelect, ParamMultiSelect, ParamHidden } from '@statdash/engine'
import type { EngineRow }                        from '@statdash/engine'
import type { BarNode, ParamNode }               from '@statdash/engine'
import type { PerspectiveOwnership }             from '@statdash/engine'

// ── FilterState — return type ─────────────────────────────────────────

export interface FilterState {
  ctx:            SectionContext
  raw:            Record<string, string>
  perspectiveKey: string
  bars:           BarNode[]
  /** True when one or more Tier 3 (OptionsDefault) defaults are still loading. */
  isLoading:      boolean
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
    showWhen:   barDef.showWhen,
    // Render order is authored `order` (default 0), NOT the config object's key
    // order — a published config round-trips through Postgres jsonb, which reorders
    // object keys (by length, then bytewise), so `Object.entries` cannot be trusted
    // for display order (e.g. the from→to span pair would render reversed). Sort is
    // stable (ES2019+ Array.prototype.sort): params with equal/absent `order` keep
    // their incoming relative position ⇒ zero regression for bars without `order`.
    // This is RENDER order only; the separate defaults-resolution path (flatParams /
    // resolveDefaults topoSort below) is untouched.
    items:      Object.entries(barDef.filters)
      .map(([key, paramDef]) => ({
        key,
        ...paramDef,
      } as ParamNode))
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
  }))
}

// ── Stable fallbacks ──────────────────────────────────────────────────

// Minimal SectionContext stub used when resolving Tier 3 option defaults.
// At this point the real context hasn't been computed yet (chicken-and-egg):
// options lists feed the context, not the other way around. Static/inline
// sources ignore ctx.dims entirely, so this stub is safe for Phase 1.
const STUB_CTX: SectionContext = { dims: {} }

// ── useFilterState ────────────────────────────────────────────────────

export function useFilterState(
  schema: FilterSchemaInput | null | undefined,
  store?:  DataStore | null,
  ownership?: PerspectiveOwnership,
): FilterState {
  const { state } = useFilter()

  // Flatten all [key, ParamDef] pairs from all bars — order within each bar preserved.
  const flatParamEntries: Array<{ key: string; def: ParamDef }> = useMemo(
    () =>
      Object.values(schema?.bars ?? {}).flatMap(bar =>
        Object.entries(bar.filters).map(([key, def]) => ({ key, def })),
      ),
    // schema is static config — deps empty intentional
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const flatParams: Array<{ key: string; def: ParamDef }> = flatParamEntries

  // Default-resolution gate — PERSPECTIVE OWNERSHIP is the sole SSOT (VISION #3 / P6).
  //
  // A param the ACTIVE perspective's `scope.timeBinding` OWNS MUST resolve its default;
  // a param owned ONLY by a NON-active perspective (in `all` but not `active`) is
  // SUPPRESSED — so a single collapsed bar in `range` leaves the year-owned `time`
  // unset ⇒ the dynamics timeseries renders the FULL span (the parity fix, expressed
  // by perspective ownership, not two bars). Any param NO perspective owns resolves
  // normally. `alwaysResolve` (a page-level span/cube extent like spanFrom/spanTo) is
  // a bar-independent state variable hoisted out of the gate so it resolves in EVERY
  // perspective, declared ONCE (the OCP-clean form). With no axis/binding, ownership
  // is empty ⇒ every non-`alwaysResolve` param resolves (the legacy single-bar page).
  const ownsActive = ownership?.active
  const ownsAny    = ownership?.all
  const defaultParams = useMemo(
    () =>
      flatParamEntries
        .filter(({ key, def }) =>
          isAlwaysResolve(def) ||
          ownsActive?.has(key) ||
          !ownsAny?.has(key),
        )
        .map(({ key, def }) => ({ key, def })),
    [flatParamEntries, ownsActive, ownsAny],
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

  // Resolve DefaultSpec for every param whose key is absent in URL state.
  //   Tier 1 (literal DimVal) and Tier 3 (OptionsDefault) are resolved here.
  //   Tier 2 (ExprVal) is resolved in topological order inside resolveDefaults.
  const { dims: resolvedDims, pendingKeys } = useMemo(
    () => resolveDefaults(defaultParams, state, getOptions),
    [defaultParams, state, getOptions],
  )

  // raw: Record<string, string> — callers depend on string values throughout.
  const raw       = resolvedDims
  const isLoading = pendingKeys.length > 0

  const context     = schema?.context
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

  const ctxKey = `${dimsKey}|${cascadeEntries.map(([k, v]) => `${k}:${v}`).join(',')}`

  // SectionContext — stable identity keyed on ctxKey. useMemo returns the same
  // reference until ctxKey changes, so downstream consumers don't re-render on
  // unrelated parent renders. (ctxKey is the exhaustive derived dependency; the
  // values it is built from — dims, cascade codes — all feed into it, so
  // re-deriving inside the memo is correct and ref-write-free.) The active
  // perspective id is added to ctx.perspectiveState by SiteRenderer (not here).
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
      dims: { ...regularDims, ...Object.fromEntries(cascadeEntries) },
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ctxKey is the exhaustive derived key (see comment above)
  }, [ctxKey])

  // The conventional perspective-axis URL param. Page-level `perspectives` may name
  // it; SiteRenderer overrides with the actual axis key. Defaults to the SSOT
  // conventional axis param (LEGACY_MODE_PARAM — never a raw 'mode' literal, Law 1)
  // so a no-axis page still has a stable key.
  const perspectiveKey = LEGACY_MODE_PARAM
  const bars           = useMemo(() => schemaToBarNodes(schema), [schema])

  return { ctx, raw, perspectiveKey, bars, isLoading }
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