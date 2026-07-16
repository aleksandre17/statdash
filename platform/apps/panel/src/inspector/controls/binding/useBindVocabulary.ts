// ── useBindVocabulary — the live suggestion vocabulary for the expr editor ──────
//
//  Assembles the PURE bindSuggestions families against the live editor context:
//    • governed nouns  — useMetricCatalog() (describeApp().metrics / .dimensions)
//    • in-scope refs   — the ACTIVE page's filter params + vars (the real render scope)
//    • operators       — the formula grammar's infix set
//
//  The pure ranking/insertion lives in bindSuggestions.ts (fitness-tested); this hook
//  only wires the live sources into the vocabulary the combobox consumes. Fail-soft:
//  a loading/empty catalog yields the in-scope refs + ops, never a crash (the honest
//  live-preview still resolves whatever the author types).
//
//  Dedupe by insert token with a resolvability priority: an in-scope PARAM/VAR wins
//  over a governed dimension whose `code` collides (the param is the guaranteed
//  scope.dims key), so the author never sees the same identifier twice.
//
import { useMemo } from 'react'
import type { FilterSchemaInput } from '@statdash/engine'
import { useConstructorStore } from '../../../store/constructor.store'
import type { ConstructorStore } from '../../../store/constructor.store'
import { useMetricCatalog } from '../../../discovery/useMetricCatalog'
import { readLocale, type LocaleStringValue } from '../../localeString'
import type { Locale } from '../../../types/constructor'
import {
  governedSuggestions,
  scopeRefSuggestions,
  operatorSuggestions,
  type BindSuggestion,
} from './bindSuggestions'

/** The active page's filter-param keys (→ scope.dims), with any authored label. */
function activeParams(store: ConstructorStore, locale: Locale): Array<{ key: string; label?: string }> {
  const page   = store.pages.find((p) => p.id === store.activePageId)
  const schema = page?.meta?.filterSchema as FilterSchemaInput | undefined
  if (!schema?.bars) return []
  const seen = new Set<string>()
  const out: Array<{ key: string; label?: string }> = []
  for (const bar of Object.values(schema.bars)) {
    for (const key of Object.keys(bar.filters ?? {})) {
      if (seen.has(key)) continue
      seen.add(key)
      const def   = bar.filters[key] as { label?: LocaleStringValue }
      const label = readLocale(def.label, locale)
      out.push({ key, label: label || undefined })
    }
  }
  return out
}

/** The active page's var keys (→ scope.derived). */
function activeVars(store: ConstructorStore): string[] {
  const page = store.pages.find((p) => p.id === store.activePageId)
  const vars = page?.meta?.vars as Record<string, unknown> | undefined
  return vars ? Object.keys(vars) : []
}

export interface BindVocabulary {
  /** The ranked-ready suggestion list (refs first, operators last). */
  vocabulary: BindSuggestion[]
  /** Every resolvable ref token (params · vars · dimension codes · metric ids). */
  knownRefs:  ReadonlySet<string>
}

/**
 * The live vocabulary for the expr autocomplete at the current editor context.
 * Ordered refs-first (params → vars → governed nouns) then operators, so the
 * empty-token discovery list surfaces the most useful nouns at the top.
 */
export function useBindVocabulary(locale: Locale): BindVocabulary {
  const store   = useConstructorStore((s) => s)
  const catalog = useMetricCatalog()

  return useMemo(() => {
    const params = activeParams(store, locale)
    const vars   = activeVars(store)
    const refs   = scopeRefSuggestions(params, vars, locale)

    const governed = catalog.status === 'ready'
      ? governedSuggestions(catalog.metrics, catalog.dimensions, locale)
      : []

    // Dedupe by insert token — an in-scope param/var wins over a colliding governed
    // dimension code (it is the guaranteed-resolvable scope.dims key).
    const seen = new Set<string>()
    const merged: BindSuggestion[] = []
    for (const s of [...refs, ...governed]) {
      if (seen.has(s.insert)) continue
      seen.add(s.insert)
      merged.push(s)
    }

    const vocabulary = [...merged, ...operatorSuggestions(locale)]
    const knownRefs  = new Set(merged.map((s) => s.insert))
    return { vocabulary, knownRefs }
  }, [store, catalog, locale])
}
