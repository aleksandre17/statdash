// ── EnumRefField — data-driven enum control (C1 + C3 cube binding) ───────────
//
//  Renders a <select> whose options are resolved at RUNTIME from a discovery
//  source — the open registry — not hardcoded in the schema. This is the control
//  for the engine's PropFieldType 'enum-ref' + PropFieldSource discriminants.
//
//  Two families of source (OCP — a new source = a new resolver entry):
//
//    Session-store sources (Layer-1/3 authored artefacts):
//      'dataSpecs' | 'dataSources' | 'pages'  → resolved from the live store.
//
//    Cube-profile sources (C3 — REAL dataset capability discovery):
//      'cube.measures' | 'cube.dimensions' | 'cube.members'
//        → resolved from the ACTIVE dataset's cube profile (useActiveProfile),
//          so a data-bound field offers the dataset's real measures / dims /
//          members. The author PICKS, never types a raw code (Law 2).
//
//  Graceful degradation (verify-gate): when no dataset is bound, or the profile
//  is loading/errored, a cube field renders an empty option list with a hint and
//  NEVER crashes — the editor stays usable (the field is just un-resolvable yet).
//
//  'cube.members' is dimension-scoped: it reads which dimension via the field's
//  `sourceDim` descriptor (a sibling prop path naming the chosen dimension),
//  falling back to the profile's first dimension. Both `source` and `sourceDim`
//  are typed PropField descriptors (the engine names the ref; the panel binds it).
//
//  A THIRD family (AR-49 M0 item 8) — the GOVERNED semantic catalog:
//
//    Semantic-catalog sources (governed nouns, not raw SDMX codes):
//      'metrics' | 'dimensions'
//        → resolved from the semantic layer (useMetricCatalog → describeApp()),
//          so a governed field offers registered MetricDef/DimensionDef ids. The
//          author PICKS a governed noun; the picked id lowers through the unchanged
//          resolveMeasureRef seam (byte-identical to hand-authoring the id). Same
//          CubeOption shape → the SAME <select> renders it unchanged. Gated on the
//          catalog being 'ready' (idle/error render the empty/hint path, never a
//          crash), structurally identical to the cube-profile branch.
//
import { useMemo } from 'react'
import { perspectiveRegistry } from '@statdash/engine'
import type { FilterSchemaInput } from '@statdash/engine'
import type { FieldControlProps } from '../fieldControl.types'
import { readLocale, type LocaleStringValue } from '../localeString'
import { useConstructorStore } from '../../store/constructor.store'
import type { ConstructorStore } from '../../store/constructor.store'
import type { Locale } from '../../types/constructor'
import { useActiveProfile, profileOrNull } from '../../discovery/useActiveProfile'
import {
  measureOptions, dimensionOptions, memberOptions, isCubeSource,
  type CubeOption,
} from '../../discovery/cubeEnumOptions'
import { useMetricCatalog } from '../../discovery/useMetricCatalog'
import {
  metricOptions,
  dimensionOptions as dimensionCatalogOptions,
  isSemanticSource,
} from '../../discovery/semanticCatalogOptions'
import { tokenOptions, isTokenSource } from '../../discovery/tokenCatalogOptions'

/** One resolved option. label is already resolved to the active locale. */
interface ResolvedOption { value: string; label: string }

/**
 * Open registry of SESSION-STORE option sources. Each resolver reads the live
 * store snapshot. Cube-profile sources are resolved separately (they need the
 * async profile, not the store) — see the component body.
 */
const STORE_SOURCES: Record<
  string,
  (store: ConstructorStore, locale: Locale) => ResolvedOption[]
> = {
  dataSpecs:   (s) => s.dataSpecs.map((d) => ({ value: d.id, label: d.name })),
  dataSources: (s) => s.dataSources.map((d) => ({ value: d.id, label: d.name })),
  pages:       (s, locale) =>
    s.pages.map((p) => ({ value: p.id, label: readLocale(p.title, locale) || p.slug })),
  // V4 — the active page's authored ParamDef keys: the `param` a VisibilityExpr
  // leaf binds to. The author PICKS an authored filter control, never types a raw
  // param name (Law 2). Flat-mapped across the page's bars; deduped, order-stable.
  filterParams: (s, locale) => activeFilterParamOptions(s, locale),
  // The registered perspective set: the `perspective` a perspective-* leaf binds to.
  // Picked from the live perspectiveRegistry (icon/label registered at boot).
  perspectives: (_s, locale) =>
    perspectiveRegistry.list().map((m) => ({ value: m.id, label: readLocale(m.label, locale) || m.id })),
}

/**
 * The authored ParamDef keys of the active page, as pickable options. Reads the
 * page's engine-canonical filterSchema (page.meta.filterSchema) and flat-maps the
 * control keys across all bars (deduped, first-seen order). Empty when the page
 * has no filters — fail-soft (the leaf's `param` is then simply un-resolvable yet,
 * exactly like a cube field with no dataset bound).
 */
function activeFilterParamOptions(s: ConstructorStore, _locale: Locale): ResolvedOption[] {
  const page   = s.pages.find((p) => p.id === s.activePageId)
  const schema = page?.meta?.filterSchema as FilterSchemaInput | undefined
  if (!schema?.bars) return []
  const seen = new Set<string>()
  const out: ResolvedOption[] = []
  for (const bar of Object.values(schema.bars)) {
    for (const key of Object.keys(bar.filters ?? {})) {
      if (seen.has(key)) continue
      seen.add(key)
      const def = bar.filters[key] as { label?: LocaleStringValue }
      const label = readLocale(def.label, _locale)
      out.push({ value: key, label: label ? `${key} · ${label}` : key })
    }
  }
  return out
}

/**
 * The underlying cube dimension of an authored ParamDef, by its filter key. Most
 * ParamDef types carry a `key` field naming the dimension they write into; this
 * returns it so a VisibilityExpr leaf's `is`/`values` can scope to the param's
 * members. undefined when the key is unknown or the param has no dimension (e.g.
 * a `hidden` URL-state param) — caller falls back gracefully.
 */
function paramDimension(s: ConstructorStore, paramKey: string): string | undefined {
  const page   = s.pages.find((p) => p.id === s.activePageId)
  const schema = page?.meta?.filterSchema as FilterSchemaInput | undefined
  if (!schema?.bars) return undefined
  for (const bar of Object.values(schema.bars)) {
    const def = bar.filters?.[paramKey] as { key?: unknown } | undefined
    if (def && typeof def.key === 'string') return def.key
  }
  return undefined
}

export function EnumRefField({ field, id, value, locale, siblingValues, onChange }: FieldControlProps) {
  // Subscribe to the whole store so store-backed options stay live.
  const store = useConstructorStore((s) => s)
  // The active dataset's profile — drives the cube.* sources (C3).
  const active = useActiveProfile()
  // The governed semantic catalog — drives the 'metrics'/'dimensions' sources
  // (AR-49 M0). Mirrors useActiveProfile: gate on `status !== 'ready'`.
  const catalog = useMetricCatalog()

  // `source` selects the catalog; `sourceDim` scopes a 'cube.members' field to a
  // sibling-chosen dimension (both are typed PropField descriptors).
  const sourceKey = field.source
  const sourceDim = field.sourceDim

  // The dimension a 'cube.members' field is scoped to: the value at the sibling
  // prop named by `sourceDim`, when present. Falls back to the profile's first
  // dimension so members still resolve to something usable.
  //
  // V4 special case: when `sourceDim` is 'param' (a VisibilityExpr leaf's `is`
  // scoped to a sibling-picked filter param), the sibling value is a ParamDef KEY,
  // not a dimension code — so we resolve it through the active page's filterSchema
  // to the param's underlying dimension (its `key`). Postel's Law: if the value is
  // not an authored param key, we treat it as a dimension code directly.
  const memberDim = useMemo<string | undefined>(() => {
    if (sourceKey !== 'cube.members') return undefined
    const fromSibling = sourceDim && siblingValues ? siblingValues[sourceDim] : undefined
    if (typeof fromSibling === 'string' && fromSibling) {
      return sourceDim === 'param'
        ? (paramDimension(store, fromSibling) ?? fromSibling)
        : fromSibling
    }
    const profile = profileOrNull(active)
    return profile?.dimensions[0]?.code
  }, [sourceKey, sourceDim, siblingValues, active, store])

  const { options, hint } = useMemo<{ options: ResolvedOption[]; hint: string }>(() => {
    if (!sourceKey) return { options: [], hint: 'no source declared' }

    // ── Design-token source ('tokens') — the dormant seam, now activated ────────
    //  Resolved from the SELF-DESCRIBING TOKENS_CATALOG (static — no store/profile),
    //  optionally constrained to the field's `tokenGroup`. Option value = the token's
    //  cssVar (the serialized style value), so a picked token round-trips by identity.
    if (isTokenSource(sourceKey)) {
      const opts = tokenOptions(field.tokenGroup, locale)
      return { options: opts, hint: field.tokenGroup ? `no ${field.tokenGroup} tokens` : 'no tokens available' }
    }

    // ── Semantic-catalog sources (AR-49 M0 — governed metric/dimension ids) ──
    //  Structurally identical to the cube branch: gate on the catalog being
    //  'ready', then resolve through the SAME pure option resolvers the palette
    //  uses. The option `value` is the registry id (a metric-id/dimension-id),
    //  which lowers via the unchanged resolveMeasureRef seam — so a governed pick
    //  is byte-identical to hand-authoring the id (Law 2: pick, never type).
    if (isSemanticSource(sourceKey)) {
      if (catalog.status !== 'ready') return { options: [], hint: 'catalog loading…' }
      const semanticOpts: CubeOption[] = sourceKey === 'metrics'
        ? metricOptions(catalog.metrics, locale)
        : dimensionCatalogOptions(catalog.dimensions, locale)
      return { options: semanticOpts, hint: `no ${sourceKey} available` }
    }

    // ── Cube-profile sources (C3) ──────────────────────────────────────────
    if (isCubeSource(sourceKey)) {
      if (active.status === 'none')    return { options: [], hint: 'no dataset bound' }
      if (active.status === 'loading') return { options: [], hint: 'loading dataset…' }
      if (active.status === 'error')   return { options: [], hint: 'dataset unavailable' }

      const profile = active.profile
      let cubeOpts: CubeOption[] = []
      if (sourceKey === 'cube.measures')   cubeOpts = measureOptions(profile, locale)
      if (sourceKey === 'cube.dimensions') cubeOpts = dimensionOptions(profile)
      if (sourceKey === 'cube.members')    cubeOpts = memberDim ? memberOptions(profile, memberDim, locale) : []
      return { options: cubeOpts, hint: `no ${sourceKey} available` }
    }

    // ── Session-store sources ──────────────────────────────────────────────
    const resolver = STORE_SOURCES[sourceKey]
    return { options: resolver ? resolver(store, locale) : [], hint: `no "${sourceKey}" available` }
  }, [sourceKey, store, locale, active, catalog, memberDim, field.tokenGroup])

  return (
    <select
      id={id}
      className="insp-field__select"
      value={(value as string) ?? ''}
      onChange={(e) => onChange(e.target.value)}
    >
      {!field.required && <option value="">—</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
      {options.length === 0 && (
        <option value="" disabled>{hint}</option>
      )}
    </select>
  )
}
