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
//  falling back to the profile's first dimension. Defensive reads — `source` /
//  `sourceDim` are engine descriptor keys the panel's PropField type may not yet
//  expose on the narrow union.
//
import { useMemo } from 'react'
import type { FieldControlProps } from '../fieldControl.types'
import { readLocale } from '../localeString'
import { useConstructorStore } from '../../store/constructor.store'
import type { ConstructorStore } from '../../store/constructor.store'
import type { Locale } from '../../types/constructor'
import { useActiveProfile, profileOrNull } from '../../discovery/useActiveProfile'
import {
  measureOptions, dimensionOptions, memberOptions, isCubeSource,
  type CubeOption,
} from '../../discovery/cubeEnumOptions'

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
}

export function EnumRefField({ field, id, value, locale, siblingValues, onChange }: FieldControlProps) {
  // Subscribe to the whole store so store-backed options stay live.
  const store = useConstructorStore((s) => s)
  // The active dataset's profile — drives the cube.* sources (C3).
  const active = useActiveProfile()

  // Defensive reads of the engine descriptor keys (see header).
  const sourceKey = (field as { source?: string }).source
  const sourceDim = (field as { sourceDim?: string }).sourceDim

  // The dimension a 'cube.members' field is scoped to: the value at the sibling
  // prop named by `sourceDim`, when present. Falls back to the profile's first
  // dimension so members still resolve to something usable.
  const memberDim = useMemo<string | undefined>(() => {
    if (sourceKey !== 'cube.members') return undefined
    const fromSibling = sourceDim && siblingValues ? siblingValues[sourceDim] : undefined
    if (typeof fromSibling === 'string' && fromSibling) return fromSibling
    const profile = profileOrNull(active)
    return profile?.dimensions[0]?.code
  }, [sourceKey, sourceDim, siblingValues, active])

  const { options, hint } = useMemo<{ options: ResolvedOption[]; hint: string }>(() => {
    if (!sourceKey) return { options: [], hint: 'no source declared' }

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
  }, [sourceKey, store, locale, active, memberDim])

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
