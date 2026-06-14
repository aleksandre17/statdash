# Async Options Loading — Implementation Guide

> Production implementation. Read production code first:
> - `engine/core/src/config/filter.ts` — ParamCascade, ParamSelect types
> - `engine/core/src/data/source.ts` — OptionsSource, resolveOptions
> - `engine/react/src/engine/RenderEngine.ts` (lines 197–220) — sync option resolution
> - `engine/react/src/engine/renderers/param/ParamCascadeRenderer.tsx`

---

## Problem (confirmed in production)

`ParamCascade.tree` is static — embedded in config at definition time.
There is no protocol for cascade options loaded from a DataStore query at runtime.

`OptionsLoader` interface exists in `docs/architecture/types/all-types.md` (design).
`useAsyncOptions` hook — does not exist in production.

Current cascade (`ParamCascadeRenderer`) only reads `def.tree` — always static.

---

## Scope decision

**Phase 1 scope:** async options for `ParamSelect` (single dropdown).
The engine already has `OptionsSource = SelectOption[] | { $query: DataSpec } | { $api: string }`.
`resolveOptions()` in the engine resolves these — but synchronously with EMPTY_CTX.
If options depend on current filter state (parent selection), sync resolution is wrong.

**Phase 2 scope:** async multi-level cascade (each level fetches based on parent value).
This requires a different component from `CascadeSelect` — `DynamicCascade` or similar.
Do not mix with Phase 1. `tree`-based `CascadeSelect` stays for static data.

---

## Phase 1 — Async select options (state-dependent)

### Step 1 — New hook: `useAsyncOptions`

New file: `engine/react/src/filters/useAsyncOptions.ts`

```ts
import { useState, useEffect, useRef }    from 'react'
import type { DataSpec, DataStore,
              SectionContext, SelectOption } from '@geostat/engine'
import { interpretSpec }                   from '@geostat/engine'

export interface AsyncOptionsResult {
  options: SelectOption[]
  loading: boolean
  error:   string | null
}

// Loads SelectOption[] from a DataSpec query when options depend on filter state.
// Falls back to empty list while loading — never throws to caller.
//
// cacheKey: JSON.stringify({query, dims}) — reloads only when query or dims change.
// interpretSpec may return DataRow[] synchronously or via Promise<DataRow[]>.
//
export function useAsyncOptions(
  query:   DataSpec | undefined,
  ctx:     SectionContext,
  store:   DataStore | undefined,
): AsyncOptionsResult {
  const [options, setOptions] = useState<SelectOption[]>([])
  const [loading, setLoading] = useState(false)
  const [error,   setError  ] = useState<string | null>(null)

  const cacheKey = JSON.stringify({ query, dims: ctx.dims })
  const prevKey  = useRef<string>('')

  useEffect(() => {
    if (!query || !store)              return
    if (cacheKey === prevKey.current)  return
    prevKey.current = cacheKey

    setLoading(true)
    setError(null)

    const toOptions = (rows: { value?: unknown; code?: unknown; label?: unknown }[]): SelectOption[] =>
      rows.map(r => ({
        value: String(r.code ?? r.value ?? ''),
        label: String(r.label ?? r.value ?? ''),
      }))

    try {
      const result = interpretSpec(query, ctx, store)
      if (result instanceof Promise) {
        result
          .then(rows  => { setOptions(toOptions(rows)); setLoading(false) })
          .catch(e    => { setError(String(e));         setLoading(false) })
      } else {
        setOptions(toOptions(result))
        setLoading(false)
      }
    } catch (e) {
      setError(String(e))
      setLoading(false)
    }
  }, [cacheKey, store])  // eslint-disable-line react-hooks/exhaustive-deps

  return { options, loading, error }
}
```

### Step 2 — Add `optionsQuery` to `ParamSelect`

File: `engine/core/src/config/filter.ts`

```ts
export type ParamSelect = ParamMeta & {
  type:        'select'
  label?:      string
  // Static options OR dynamic query — one must be present.
  options?:    OptionsSource     // static: SelectOption[] | { $query } | { $api }
  optionsQuery?: DataSpec        // dynamic: re-runs when ctx.dims change (state-dependent)
  emptyLabel?: string
}
```

`options` becomes optional. If `optionsQuery` set → hook loads async. If `options` set → existing sync path unchanged.

### Step 3 — Update `ParamSelectRenderer.tsx`

File: `engine/react/src/engine/renderers/param/ParamSelectRenderer.tsx`

```ts
import { useAsyncOptions } from '../../../filters/useAsyncOptions'
import type { RenderContext } from '../../types'

function SelectControl({ def, ctx }: { def: ParamSelectNode; ctx: RenderContext }) {
  const { state, setMany } = useFilter()
  if (!isVisible(def, state)) return null

  // Async path — optionsQuery re-runs when ctx.sectionCtx.dims change
  const async = useAsyncOptions(def.optionsQuery, ctx.sectionCtx, ctx.store)

  // Sync path — existing engine resolution (unchanged)
  const syncOptions = (ctx.paramOptions as SelectOption[] | undefined) ?? []

  const options = def.optionsQuery ? async.options : syncOptions
  const setFn   = (v: string) => applyEffects(def.key, v, state, ctx.effects, setMany)

  return (
    <FilterField label={def.label} suffix={def.suffix} paramKey={def.key}>
      {({ value }) => (
        <>
          {async.loading && <span className="filter-hint">იტვირთება…</span>}
          {async.error   && <span className="filter-error">{async.error}</span>}
          <select
            className="filter-select"
            value={value || def.default}
            onChange={(e) => setFn(e.target.value)}
            disabled={async.loading || !isEnabled(def, state)}
          >
            {def.emptyLabel && <option value="">{def.emptyLabel}</option>}
            {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </>
      )}
    </FilterField>
  )
}
```

**Note:** `useAsyncOptions` is always called (hooks rule — no conditional calls).
When `def.optionsQuery` is undefined, the hook returns `{ options: [], loading: false, error: null }` immediately.

### Step 4 — Usage in feature config

```ts
// accounts.filters.ts — sector dropdown loaded from store query
{
  type:         'select',
  key:          'sector',
  label:        'სექტორი',
  default:      'S1',
  optionsQuery: {
    type:     'query',
    query:    { measure: 'GVA', filter: { geo: { $ctx: 'geo' } } },
    pipe:     [{ op: 'aggregate', by: ['sector'], measure: 'value', agg: 'sum' }],
    encoding: { value: 'sector', label: 'sector' },
  },
}
```

---

## Phase 2 — Async multi-level cascade

**Do not mix with Phase 1.** Static `CascadeSelect` + `def.tree` stays unchanged.
Async cascade = a new component: `DynamicCascadeSelect`.

### What's needed (not implemented yet)

1. `optionsQuery` on `ParamCascade` — loads level-1 options
2. `childQuery?: DataSpec` — loads level-N options given parent selection in `$ctx`
3. New component `DynamicCascadeSelect` — level-by-level async loading
4. `ParamCascadeRenderer` dispatch: `def.optionsQuery ? <DynamicCascadeSelect> : <CascadeSelect>`

### Design decision pending

`childQuery` needs to read parent selection via `$ctx`. This means the `SectionContext.dims`
must include the parent level's selected value before the child level queries.
This is the same dependency problem as `dep-graph-impl.md` — both must be implemented together.
Order: dep-graph (Phase 1) → async cascade (Phase 2).

---

## `interpretSpec` async contract (verify before implementing)

File: `engine/core/src/registry/interpreters.ts` (or `data/spec.ts`)

Check whether `interpretSpec` currently returns `DataRow[] | Promise<DataRow[]>`.
If it only returns `DataRow[]` synchronously:
- Either add async path to `interpretSpec` before implementing `useAsyncOptions`
- Or add a separate `interpretSpecAsync(spec, ctx, store): Promise<DataRow[]>` entry point

Do not add async to `interpretSpec` without checking existing callers — it would break all of them.

---

## Verification

```
tsc --noEmit → 0 errors
```

Test: set `optionsQuery` on a select. Confirm:
- Shows loading spinner while fetching ✅
- Shows options after load ✅
- Re-fetches when ctx.dims change (parent filter changes) ✅
- Static `options` path unchanged — no regression ✅