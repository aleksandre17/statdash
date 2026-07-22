// ── filterCtxCore — the ONE filter-ctx derivation, as pure functions (0112 R1) ──
//
//  `useFilterState` is the provider-zoom of this derivation; `deriveDefaultFilterState`
//  is the provider-FREE zoom (the panel's workbench preview, or any host outside a
//  FilterProvider, evaluating under the page's canonical DEFAULT ctx). Both zooms call
//  the SAME core below — extracting it is what makes "preview ctx ≡ canvas ctx" a
//  structural guarantee instead of a copied rule (the R1 divergence class: the panel
//  had re-derived a PARTIAL default ctx without Tier-3, so an options-first `time`
//  default starved every `$ctx` query → 0 preview rows while the canvas rendered data).
//
//  Grafana: template-variable resolution is one dashboard-level derivation; Retool:
//  computed state evaluated once, every consumer sees the same values. Same law here:
//  ONE derivation, N zooms.
//
import type {
  SectionContext, DimVal, FilterSchemaInput, DataStore, EngineRow,
  ParamDef, ParamCascadeNode, CascadeNode,
  ParamYearSelect, ParamSelect, ParamMultiSelect, ParamHidden,
} from '@statdash/engine'
import {
  toCtxValue, resolveDefaults, resolveYears, resolveOptions,
} from '@statdash/engine'
import type { PerspectiveOwnership } from '@statdash/engine'

// Minimal SectionContext stub used when resolving Tier 3 option defaults.
// Chicken-and-egg: options lists FEED the context; static/inline sources ignore
// ctx.dims entirely, so the stub is safe (unchanged from the hook's original).
const STUB_CTX: SectionContext = { dims: {} }

/** Flatten every `{ key, def }` param across all bars — order within each bar preserved. */
export function flattenSchemaParams(
  schema: FilterSchemaInput | null | undefined,
): Array<{ key: string; def: ParamDef }> {
  return Object.values(schema?.bars ?? {}).flatMap(bar =>
    Object.entries(bar.filters).map(([key, def]) => ({ key, def })),
  )
}

/** True for a hidden param flagged `alwaysResolve` — a page-level state variable
 *  (span/cube-derived) whose default resolves regardless of its bar's visibility. */
export function isAlwaysResolve(def: ParamDef): boolean {
  return def.type === 'hidden' && (def as ParamHidden).alwaysResolve === true
}

/** The default-resolution gate — PERSPECTIVE OWNERSHIP is the sole SSOT (VISION #3 / P6).
 *  A param the active perspective owns resolves; one owned ONLY by a non-active
 *  perspective is suppressed; a param no perspective owns resolves normally;
 *  `alwaysResolve` params resolve in EVERY perspective. */
export function gateDefaultParams(
  flatParams: Array<{ key: string; def: ParamDef }>,
  ownership?: PerspectiveOwnership,
): Array<{ key: string; def: ParamDef }> {
  const ownsActive = ownership?.active
  const ownsAny    = ownership?.all
  return flatParams.filter(({ key, def }) =>
    isAlwaysResolve(def) ||
    ownsActive?.has(key) ||
    !ownsAny?.has(key),
  )
}

/** Tier 3 options getter — maps a param key to its EngineRow list for OptionsDefault
 *  `{ from:'options', pick:'first'|'last' }` resolution. Returns null when the store is
 *  unavailable or the param type doesn't use an options list (cascade, hidden-without-
 *  options, range — Tier 3 not applicable). */
export function optionsGetterFor(
  flatParams: Array<{ key: string; def: ParamDef }>,
  store?: DataStore | null,
): (key: string) => EngineRow[] | null {
  return (key: string): EngineRow[] | null => {
    if (!store) return null
    const found = flatParams.find(p => p.key === key)
    if (!found) return null
    const { def } = found
    if (def.type === 'year-select') {
      const years = resolveYears((def as ParamYearSelect).years, store, STUB_CTX)
      return years.map(y => ({ code: String(y) }) as EngineRow)
    }
    if (def.type === 'select' || def.type === 'multi-select') {
      const opts = resolveOptions((def as ParamSelect | ParamMultiSelect).options, store, STUB_CTX)
      return opts.map(o => ({ code: o.value }) as EngineRow)
    }
    // hidden WITH an options source: a derived state variable whose default follows the
    // cube (e.g. span min/max) — resolve identically to select so pick:first/last lands
    // on a real member. A plain hidden (no options) carries only a literal default.
    if (def.type === 'hidden' && (def as ParamHidden).options) {
      const opts = resolveOptions((def as ParamHidden).options!, store, STUB_CTX)
      return opts.map(o => ({ code: o.value }) as EngineRow)
    }
    return null
  }
}

/** Traverse a cascade path to its deepest selected node's dim code. */
export function cascadeDeepestCode(
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

/** The cascade dim contributions: deepest selected node code → [dim, code] entries. */
export function cascadeCtxEntries(
  flatParams: Array<{ key: string; def: ParamDef }>,
  raw: Record<string, string>,
): Array<readonly [string, string]> {
  return flatParams
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
}

/** The ctx identity key — dims + cascade contributions; the hook memos on it. */
export function ctxIdentityKey(
  schema: FilterSchemaInput | null | undefined,
  flatParams: Array<{ key: string; def: ParamDef }>,
  raw: Record<string, string>,
): string {
  const context = schema?.context
  const dimsKey = context?.dims
    ? Object.entries(context.dims).map(([dk, pk]) => `${dk}:${raw[pk] ?? ''}`).join(',')
    : ''
  return `${dimsKey}|${cascadeCtxEntries(flatParams, raw).map(([k, v]) => `${k}:${v}`).join(',')}`
}

/** Assemble the SectionContext from resolved raw values — `context.dims` mapping folded
 *  per-param through `toCtxValue` (the engine's ONE per-type wire-fold seam, ADR-038),
 *  empties dropped (an unset dim is ABSENT — no filtering — never a match-nothing value),
 *  cascade contributions merged on top. */
export function buildSectionContext(
  schema: FilterSchemaInput | null | undefined,
  flatParams: Array<{ key: string; def: ParamDef }>,
  raw: Record<string, string>,
): SectionContext {
  const context = schema?.context
  const regularDims = context?.dims
    ? Object.fromEntries(
        Object.entries(context.dims)
          .map(([dk, pk]) => {
            const paramDef = flatParams.find(p => p.key === pk)?.def
            const parsed = paramDef ? toCtxValue(paramDef, raw[pk]) : raw[pk]
            return [dk, parsed as DimVal]
          })
          .filter(([, v]) => v !== '' && v !== undefined),
      )
    : {}
  return { dims: { ...regularDims, ...Object.fromEntries(cascadeCtxEntries(flatParams, raw)) } }
}

// ── deriveDefaultFilterState — the provider-free zoom ───────────────────────────

export interface DefaultFilterState {
  ctx:       SectionContext
  raw:       Record<string, string>
  /** True when one or more Tier 3 (options-first) defaults could not resolve yet
   *  (no/loading store) — the honest declared state, never a fake ''-match. */
  isLoading: boolean
}

/**
 * Derive the page's DEFAULT filter state — the ctx the renderer computes before any
 * user interaction — WITHOUT a FilterProvider. Same core as `useFilterState` with
 * empty URL state: Tier 1 (literal) + Tier 2 (ExprVal, topo-ordered) + Tier 3
 * (options-first, resolved off the given warm/sync store) + cascade contributions.
 */
export function deriveDefaultFilterState(
  schema: FilterSchemaInput | null | undefined,
  store?: DataStore | null,
  ownership?: PerspectiveOwnership,
): DefaultFilterState {
  const flat  = flattenSchemaParams(schema)
  const gated = gateDefaultParams(flat, ownership)
  const { dims: raw, pendingKeys } = resolveDefaults(gated, {}, optionsGetterFor(flat, store))
  return {
    ctx: buildSectionContext(schema, flat, raw),
    raw,
    isLoading: pendingKeys.length > 0,
  }
}
