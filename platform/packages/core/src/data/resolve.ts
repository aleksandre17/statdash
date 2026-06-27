// ── DataSource Resolvers — sync resolution of OptionsSource / ChipSource / YearsSource ──
//
//  Pure functions — no React, no side effects, fully testable.
//  Sources are STATIC (literal items), INLINE (literal/dim-ref), or QUERY
//  (store.observe). There is no async/remote selector source: HREF (url+format)
//  is deferred behind door D-HREF — see adr_data_source_reference_spectrum;
//  trigger: first author-supplied external source. When it lands, HREF re-enters
//  as a STORE kind (a DataStore behind buildStoreManifest), NOT a selector type.
//

import type { DataStore }                                    from './store'
import { storeObs }                                          from './store'
import type { SectionContext }                               from '../core/context'
import type { SelectOption, ChipOption }                     from './source'
import type { OptionsSource, ChipSource, YearsSource }       from './source'
import type { DimRef, DimVal }                               from '../sdmx'
import { isDimRef }                                           from './codelist'
import { resolveRef }                                         from '../ref/ref'
import { applyPipeline }                                     from './transform'
import type { TransformStep }                                from './transform/types'
import type { LocaleString }                                 from '../i18n/types'
import { isTaggedLocaleString }                              from '../i18n/types'

// optionLabel — carry the label field as a LocaleString. A tagged LocaleString
// (bilingual classifier label from a $cl/$d ref) passes through INTACT so the React
// control shell resolves it to the active locale; a scalar coerces to its string.
// NEVER String()-flatten a LocaleString here (locale-agnostic layer → "[object Object]").
function optionLabel(v: DimVal | LocaleString | undefined): LocaleString {
  if (isTaggedLocaleString(v)) return v
  return v == null ? '' : String(v)
}

// Resolves the pre-pipeline row array for a non-static source.
function resolveRaw(
  src:   { type: 'query'; query: import('../sdmx').ObsQuery }
       | { type: 'inline'; items: DimRef | readonly Record<string, unknown>[] },
  store: DataStore,
  ctx:   SectionContext,
): readonly Record<string, DimVal>[] | null {
  if (src.type === 'inline') {
    // An inline source is a dim-scope ref (`$cl`/`$d`) OR a literal array; the
    // ref resolves through the ONE dispatcher (../ref).
    const items = isDimRef(src.items)
      ? resolveRef(src.items, { classifiers: store.classifiers, display: store.display, defaultView: 'items' })
      : src.items
    return Array.isArray(items)
      ? (items as readonly Record<string, DimVal>[])
      : []
  }
  return storeObs(store, src.query, ctx)
}

// Resolve raw rows then apply the source's optional pipe (shared by all three
// resolvers — identical pipe-application step, single PipelineContext shape).
function resolvePiped(
  src:   { pipe?: TransformStep[] },
  raw:   readonly Record<string, DimVal>[],
  store: DataStore,
  ctx:   SectionContext,
): readonly Record<string, DimVal>[] {
  return src.pipe && src.pipe.length > 0
    ? applyPipeline(raw as Record<string, DimVal>[], src.pipe, { classifiers: store.classifiers, display: store.display, section: ctx })
    : raw
}

// ── resolveYears ─────────────────────────────────────────────────────────────

export function resolveYears(
  years: YearsSource | undefined,
  store: DataStore,
  ctx:   SectionContext,
): number[] {
  if (!years)                   return []
  if (years.type === 'static')  return years.items
  const raw = resolveRaw(years, store, ctx)
  if (!raw) return []
  const rows = resolvePiped(years, raw, store, ctx)
  const seen = new Set<number>()
  return rows
    .map((o) => Number(o[years.field]))
    .filter((n) => !isNaN(n) && !seen.has(n) && !!seen.add(n))
    .sort((a, b) => a - b)
}

// ── resolveOptions ───────────────────────────────────────────────────────────

export function resolveOptions(
  src:   OptionsSource,
  store: DataStore,
  ctx:   SectionContext,
): SelectOption[] {
  if (src.type === 'static') return src.items
  const raw = resolveRaw(src, store, ctx)
  if (!raw) return []
  const rows = resolvePiped(src, raw, store, ctx)
  const seen = new Set<string>()
  return rows
    .map((o) => ({
      value: String(o[src.valueField]                    ?? ''),
      label: optionLabel(o[src.labelField ?? src.valueField]),
    }))
    .filter((o) => o.value && !seen.has(o.value) && !!seen.add(o.value))
}

// ── resolveChips ─────────────────────────────────────────────────────────────

export function resolveChips(
  src:   ChipSource,
  store: DataStore,
  ctx:   SectionContext,
): ChipOption[] {
  if (src.type === 'static') return src.items
  const raw = resolveRaw(src, store, ctx)
  if (!raw) return []
  const rows = resolvePiped(src, raw, store, ctx)
  const seen = new Set<string>()
  return rows
    .map((o) => ({
      value: String(o[src.valueField]                    ?? ''),
      label: optionLabel(o[src.labelField ?? src.valueField]),
      color: src.colorField ? String(o[src.colorField]   ?? '') : undefined,
    }))
    .filter((o) => o.value && !seen.has(o.value) && !!seen.add(o.value))
}