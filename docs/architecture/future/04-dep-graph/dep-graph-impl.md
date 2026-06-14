# Filter Dependency Graph — Implementation Guide

> Production implementation. Read production code first:
> - `engine/core/src/config/filter.ts` — ParamMeta, ParamNode types
> - `engine/react/src/filters/useFilterState.ts` — filter state hook
> - `engine/react/src/engine/renderers/param/ParamCascadeRenderer.tsx`

---

## Problem (confirmed in production)

`ParamMeta` has no `dependsOn` field. Multi-level cascade (region → district → city)
has undefined behavior when parent is unset — child renders and may query with empty dims.

`buildDependencyGraph()` exists in `docs/architecture/examples/filter-control-registry.md`
but nothing in production reads `dependsOn`.

---

## Phase 1 — Minimal, implement now

**Two changes. No RenderContext changes. No useFilterState changes.**

### Step 1 — Add `dependsOn` to `ParamMeta`

File: `engine/core/src/config/filter.ts`

```ts
type ParamMeta = {
  label?:       string
  suffix?:      string
  default:      string
  hint?:        string
  description?: string
  showWhen?:    WhenMap
  enableWhen?:  WhenMap
  required?:    boolean | string
  validate?:    Validator[]
  // NEW — keys of params this control waits for before rendering
  dependsOn?:   string[]
}
```

That's it for the engine. No other type changes needed — `ParamNode` derives from `ParamMeta`,
so all node types (`ParamCascadeNode`, `ParamSelectNode`, etc.) get `dependsOn` automatically.

### Step 2 — Per-renderer blocking

Add the check to each renderer that participates in dependency chains.
In Phase 1 this is `ParamCascadeRenderer.tsx` only (that's the real use case).

File: `engine/react/src/engine/renderers/param/ParamCascadeRenderer.tsx`

```ts
function CascadeControl({ def, ctx }: { def: ParamCascadeNode; ctx: RenderContext }) {
  const { state, setMany } = useFilter()
  if (!isVisible(def, state)) return null

  // Block if any declared dependency has no value yet
  const blockingDep = def.dependsOn?.find(dep => !state[dep])
  if (blockingDep) {
    return (
      <FilterField label={def.label} paramKey={def.key} hint={`ჯერ აირჩიეთ: ${blockingDep}`} setFn={() => {}}>
        {() => <select className="filter-select" disabled><option>—</option></select>}
      </FilterField>
    )
  }

  const setFn = (v: string) => applyEffects(def.key, v, state, ctx.effects, setMany)

  return (
    <FilterField label={def.label} paramKey={def.key} onClear hint={def.hint} setFn={setFn}>
      {({ value }) => (
        <CascadeSelect
          tree={def.tree}
          path={value ? value.split(',').map(Number) : []}
          onChange={(p) => setFn(p.join(','))}
          placeholders={def.placeholders}
          disabled={!isEnabled(def, state)}
        />
      )}
    </FilterField>
  )
}
```

### Step 3 — Reset on parent change (use existing effects system)

No new code needed. Use the existing `Effect` system in the filter config:

```ts
// In feature filter config (e.g. regional.filters.ts):
effects: [
  {
    when: { region: { truthy: true } },  // when region changes
    set:  { district: '' },              // clear district
  },
]
```

`applyEffects()` already handles this atomically. No new mechanism needed.

### Usage in feature config

```ts
// regional.filters.ts — cascade chain: region → district
bars: [{
  type: 'bar', id: 'geo-bar', items: [
    { type: 'cascade', key: 'region',   label: 'რეგიონი',  tree: REGION_TREE,   dim: 'geo',      default: '' },
    { type: 'cascade', key: 'district', label: 'რაიონი',   tree: DISTRICT_TREE, dim: 'district',
      default: '', dependsOn: ['region'] },   // ← blocks until region has value
    { type: 'cascade', key: 'city',     label: 'ქალაქი',   tree: CITY_TREE,     dim: 'city',
      default: '', dependsOn: ['region', 'district'] },  // blocks until both set
  ]
}]
```

---

## Phase 2 — Centralized graph (when 3+ level cascades become common)

**Do this only when Phase 1 shows insufficient.** Signs: renderers duplicate
blocking logic, topological order matters for derived values, cycle detection needed.

### Changes needed

**New file:** `engine/react/src/filters/dependencyGraph.ts`

Copy `buildDependencyGraph()` from `docs/architecture/examples/filter-control-registry.md`.
It already has Kahn's algorithm + cycle detection. Add export.

**Update `useFilterState.ts`:**

```ts
import { buildDependencyGraph } from './dependencyGraph'

export interface FilterState {
  ctx:         SectionContext
  raw:         Record<string, string>
  derived:     Record<string, unknown>
  timeModeKey: string
  effects:     Effect[]
  waitingFor:  Record<string, string>   // NEW: paramKey → blocking dep key
}

export function useFilterState(node: FilterBarNode, store?: DataStore): FilterState {
  // ... existing code ...

  const graph = useMemo(() => buildDependencyGraph(flatParams), [flatParams])

  const waitingFor = useMemo(() => {
    const result: Record<string, string> = {}
    for (const key of graph.order) {
      const node = graph.nodes.find(n => n.key === key)!
      for (const dep of node.dependsOn) {
        if (!raw[dep]) { result[key] = dep; break }
      }
    }
    return result
  }, [graph, raw])

  return { ctx, raw, derived, timeModeKey, effects, waitingFor }
}
```

**Update `RenderContext` in `engine/react/src/engine/types.ts`:**

```ts
waitingFor?: Record<string, string>
```

**Update `SiteRenderer.tsx`:**

```ts
const baseRenderCtx = {
  ...
  waitingFor: filterState.waitingFor,
}
```

**Simplify renderers** — remove per-renderer `dependsOn` check, read from `ctx.waitingFor`:

```ts
const blockingDep = ctx.waitingFor?.[def.key]
if (blockingDep) return <...disabled...>
```

---

## Verification

```
tsc --noEmit → 0 errors
```

Test: set `dependsOn: ['region']` on a cascade. Confirm:
- district renders disabled when region empty ✅
- district renders active when region has value ✅
- changing region clears district (via effects) ✅