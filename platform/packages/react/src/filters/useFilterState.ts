// ── useFilterState — derives SectionContext + raw filter values from schema ──
//
//  Accepts FilterSchemaInput (page-level schema) — schema owns the state config,
//  FilterBarNode is display-only.
//
//  Grafana: template variable resolution — all variables processed at dashboard level.
//  Retool:  computed state — evaluated once at page level, all components see same values.
//
//  The derivation CORE is `filterCtxCore.ts` (0112 R1) — pure functions this hook
//  composes under React memoization. `deriveDefaultFilterState` (same module) is the
//  provider-FREE zoom of the same core: one derivation, two zooms, no copied rule.
//

import { useMemo } from 'react'
import { useFilter }                     from '../context/FilterContext'
import type { SectionContext } from '@statdash/engine'
import type { FilterSchemaInput }                from '@statdash/engine'
import type { DataStore }                        from '@statdash/engine'
import { resolveDefaults, LEGACY_MODE_PARAM }    from '@statdash/engine'
import type { ParamDef }                         from '@statdash/engine'
import type { ParamNode, BarNode }               from '@statdash/engine'
import type { PerspectiveOwnership }             from '@statdash/engine'
import {
  flattenSchemaParams, gateDefaultParams, optionsGetterFor,
  ctxIdentityKey, buildSectionContext,
} from './filterCtxCore'

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

// ── useFilterState ────────────────────────────────────────────────────

export function useFilterState(
  schema: FilterSchemaInput | null | undefined,
  store?:  DataStore | null,
  ownership?: PerspectiveOwnership,
): FilterState {
  const { state } = useFilter()

  // Flatten all [key, ParamDef] pairs from all bars — order within each bar preserved.
  const flatParamEntries: Array<{ key: string; def: ParamDef }> = useMemo(
    () => flattenSchemaParams(schema),
    // schema is static config — deps empty intentional
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const flatParams: Array<{ key: string; def: ParamDef }> = flatParamEntries

  // Default-resolution gate — PERSPECTIVE OWNERSHIP is the sole SSOT (VISION #3 / P6).
  // (Rationale lives on `gateDefaultParams` — the core owns the rule, both zooms obey it.)
  const defaultParams = useMemo(
    () => gateDefaultParams(flatParamEntries, ownership),
    [flatParamEntries, ownership?.active, ownership?.all],  // eslint-disable-line react-hooks/exhaustive-deps
  )

  // Tier 3 options getter — the core's one getter, memoized per (params, store).
  const getOptions = useMemo(
    () => optionsGetterFor(flatParams, store),
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

  const ctxKey = ctxIdentityKey(schema, flatParams, raw)

  // SectionContext — stable identity keyed on ctxKey. useMemo returns the same
  // reference until ctxKey changes, so downstream consumers don't re-render on
  // unrelated parent renders. (ctxKey is the exhaustive derived dependency; the
  // values it is built from — dims, cascade codes — all feed into it, so
  // re-deriving inside the memo is correct and ref-write-free.) The active
  // perspective id is added to ctx.perspectiveState by SiteRenderer (not here).
  const ctx = useMemo<SectionContext>(
    () => buildSectionContext(schema, flatParams, raw),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ctxKey is the exhaustive derived key (see comment above)
    [ctxKey],
  )

  // The conventional perspective-axis URL param. Page-level `perspectives` may name
  // it; SiteRenderer overrides with the actual axis key. Defaults to the SSOT
  // conventional axis param (LEGACY_MODE_PARAM — never a raw 'mode' literal, Law 1)
  // so a no-axis page still has a stable key.
  const perspectiveKey = LEGACY_MODE_PARAM
  const bars           = useMemo(() => schemaToBarNodes(schema), [schema])

  return { ctx, raw, perspectiveKey, bars, isLoading }
}
