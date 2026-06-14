# Defaults System — Architecture

> Three tiers. One resolution function. Runs before effects.
>
> URL wins always. Options invalidate stale cascade values. Effects reset to null.
> Defaults fill the gap.

---

## The problem

`ParamDef.defaultValue` today is `DimVal` — a static literal. Three cases it cannot cover:

```
Static literal     defaultValue: 2023                    ✅ works today
Computed default   defaultValue: year - 4                ❌ no ExprVal support
Data-driven        defaultValue: first item from options ❌ no options reference
```

Complex forms and cascade chains need all three. Every reference platform has all three.

---

## Platform comparison

| Platform | Tier 1 — literal | Tier 2 — expression | Tier 3 — from data | Cascade invalidation |
|----------|-----------------|---------------------|--------------------|----------------------|
| Grafana | `current.value` literal | Variable expression `${other}` | `useFirstResult: true` on query variable | Auto-reset when options refresh and current value absent |
| Retool | `defaultValue: 'x'` | `{{ query.data[0].id }}` — template expression | Same — template reference to query result | `onChange` → `setValue(options[0])` |
| React Hook Form | `defaultValues.field` | `async defaultValues()` — full expression | Fetch + set in `useEffect` after data loads | `resetField('b', { defaultValue: options[0] })` on parent change |
| Observable | cell literal | derived cell (`y = x - 4`) | `Inputs.select(opts, { value: opts[0] })` | Reactive — auto recomputes when upstream changes |

**Universal consensus:** cascade parent changes → child value validated against new options → invalid = reset to default (first valid option). No platform leaves a stale cascade value.

---

## DefaultSpec — three tiers

```ts
type DefaultSpec =
  | DimVal          // Tier 1: literal — 'year', 2023, true, null
  | ExprVal         // Tier 2: expression — evaluated after Tier 1 + URL params resolved
  | OptionsDefault  // Tier 3: from options data — first or last item

interface OptionsDefault {
  from:   'options'               // discriminant
  pick:   'first' | 'last'       // which item to take
  field?: string                  // which row field to use as value (default: paramDef.valueField ?? 'code')
}
```

**How to distinguish at runtime:**
- `null | string | number | boolean` → Tier 1 (primitive)
- object with `from: 'options'` → Tier 3
- any other object (`{ op }`, `{ $ctx }`, `{ $derived }`) → Tier 2 (ExprVal)

All three are plain JSON. No functions. Constructor stores all three in DB.

---

## ParamDef — updated defaultValue

```ts
// Before:
| { type: 'year-select'; defaultValue?: number }
| { type: 'cascade';     defaultValue?: string }
| { type: 'hidden';      defaultValue: DimVal  }   // required

// After:
| { type: 'year-select'; defaultValue?: DefaultSpec }
| { type: 'cascade';     defaultValue?: DefaultSpec }
| { type: 'hidden';      defaultValue: DefaultSpec  }   // required — hidden must always have a value
| { type: 'select';      defaultValue?: DefaultSpec }
| { type: 'multi-select'; defaultValue?: DefaultSpec }
| { type: 'range';       defaultValue?: DefaultSpec }
```

Backward compatible: all current `defaultValue: 2023` (Tier 1) stay valid unchanged.

---

## Resolution pipeline

```
URL params → raw dims (some keys absent)
     ↓
resolveDefaults(params, rawDims, getOptions)   ← NEW STEP
     ↓                                           Tier 1: literals
     ↓                                           Tier 2: ExprVal (topological order)
     ↓                                           Tier 3: options data (Suspense)
resolved dims (all keys present or pending)
     ↓
validateCascadeValues(params, dims, options)   ← NEW STEP
     ↓                                           cascade: current value ∈ options?
     ↓                                           invalid → cleared → back to resolveDefaults
validated dims
     ↓
evalComputed(computed, dims)
     ↓
applyEffects(effects, dims)
     ↓
crossValidate(crossValidate, dims)
     ↓
FiltersResult
```

**Why resolveDefaults runs before effects:**
Effects (`set: { region: null }`) clear values. Defaults fill gaps. If defaults ran after effects, clearing a value would leave it null instead of picking a new default. Wrong order = region stuck null after country change.

**Correct order:**
```
country changes → effects clear region → resolveDefaults picks first region for new country ✅
```

But effects run AFTER defaults in the pipeline above! Contradiction?

Resolution: **two default resolution passes:**

```
Pass 1 (pre-effects): URL → literals + ExprVal + options data → initial dims
     ↓
effects — run on initial dims
     ↓
Pass 2 (post-effects): for any key that effects set to null → resolveDefaults again for that key
     ↓
evalComputed → crossValidate → FiltersResult
```

Grafana does exactly this: variable refresh → effect clears child → child re-queries and picks first result. Two passes, not one.

---

## Topological sort for Tier 2 defaults

ExprVal defaults may reference other params (including params that themselves have defaults):

```ts
// year: defaultValue 2023 (Tier 1)
// fromYear: defaultValue { op: 'subtract', left: { $ctx: 'year' }, right: 4 }
//                                                   ↑ references year — must resolve year first
```

`resolveDefaults` auto-detects `{ $ctx: 'key' }` references in ExprVal defaults and topologically sorts. Same `buildDependencyGraph` algorithm as `evalComputed` and `evalDerived`.

**Scope of ExprVal defaults:**
- `{ $ctx: 'key' }` — any param value (URL params + already-resolved Tier 1/2 defaults)
- `{ $derived: 'key' }` — ❌ NOT available (derived = render time, not filter time)

Cycle detection: `{ key: 'a', defaultValue: { $ctx: 'b' } }` + `{ key: 'b', defaultValue: { $ctx: 'a' } }` → throw at filter init time. Clear error.

---

## Cascade invalidation

When a cascade param's parent changes, its options list changes. The current value may no longer be valid:

```
country = 'GE' → region options: ['GE-TB', 'GE-AJ', 'GE-GU', ...]
user had: region = 'GE-TB'

country changes to 'US' → region options: ['US-NY', 'US-CA', ...]
region = 'GE-TB' is no longer valid → must reset
```

**Validation step after options load:**

```ts
validateCascadeValues(params, dims, getOptions):
  For each cascade param where options are loaded:
    If dims[key] not in options[key] → dims[key] = null
    → resolveDefaults pass 2 fills it from { from: 'options', pick: 'first' }
```

This handles parent-change cascade reset **without** an explicit `effects` rule and **without** `{ op: 'changed' }`. The invalidation is structural, not event-based.

No `{ op: 'changed' }` operator needed. The pattern is:
```
Parent changes → options refetch → validateCascadeValues → stale value cleared
             → resolveDefaults pass 2 → picks first valid option ✅
```

---

## Effects — set null → default picks up

Effects that clear values trigger Pass 2 default resolution:

```ts
effects: [
  { when: { op: 'eq', left: { $ctx: 'country' }, right: 'GE' },
    set:  { region: null } }   // null → resolveDefaults pass 2 → { from: 'options', pick: 'first' }
]
```

This is intentional: `set: { key: null }` = "reset to default," not "force null forever."
If you want to force null (no selection), set `contracts: { key: 'required' }` and show empty state — that's a data contract, not an effect.

---

## Tier 3 — loading state

Tier 3 defaults depend on options data. Options may not be loaded yet:

```
resolveDefaults → { from: 'options', pick: 'first' } → getOptions('region') → undefined (loading)
→ dim not yet resolved → pendingKeys: ['region']
```

`useFilters` aggregates `pendingKeys`:
- `pendingKeys.length > 0` → `FiltersResult.isLoading = true`
- Shell shows spinner in filter bar header
- When options arrive → re-render → `resolveDefaults` runs again → picks first → `isLoading: false`

Independent of cascade `isLoading` (options in-flight for interactive display). This is specifically for Tier 3 default resolution, not general cascade loading.

---

## Form patterns

### Simple form — all static defaults

```ts
defineFilters({
  bars: { main: { filters: {
    sector: { type: 'select', options: SECTORS, defaultValue: '_T' },
    prices: { type: 'select', options: PRICES,  defaultValue: 'current' },
    year:   { type: 'year-select', defaultValue: 2023 },
  }}},
})
// All Tier 1. resolveDefaults is trivial. ✅
```

### Form with computed default

```ts
defineFilters({
  params: {
    currentYear: { type: 'hidden', defaultValue: 2025 },
  },
  bars: { main: { filters: {
    year:     { type: 'year-select', defaultValue: { $ctx: 'currentYear' } },
    fromYear: { type: 'year-select',
                defaultValue: { op: 'subtract', left: { $ctx: 'year' }, right: 4 } },
    //                                                    ↑ year resolved first (topo sort)
  }}},
})
// Topo order: currentYear (Tier 1) → year (Tier 2, refs currentYear) → fromYear (Tier 2, refs year) ✅
```

### Cascade chain — three levels

```ts
defineFilters({
  bars: { main: { filters: {
    country: {
      type:         'select',
      options:      COUNTRY_OPTIONS,
      defaultValue: 'GE',            // Tier 1 — known good default
    },
    region: {
      type:         'cascade',
      optionsQuery: { type: 'query', storeId: 'geo', indicator: 'REGIONS',
                      dims: { country: { $ctx: 'country' } } },
      dependsOn:    ['country'],
      defaultValue: { from: 'options', pick: 'first' },   // Tier 3 — first region for selected country
    },
    city: {
      type:         'cascade',
      optionsQuery: { type: 'query', storeId: 'geo', indicator: 'CITIES',
                      dims: { region: { $ctx: 'region' } } },
      dependsOn:    ['region'],
      defaultValue: { from: 'options', pick: 'first' },   // Tier 3 — first city for selected region
    },
  }}},
})

// Flow on first load:
//   country = 'GE' (Tier 1)
//   options for 'GE' load → first region = 'GE-TB' → region dim set
//   options for 'GE-TB' load → first city = 'tbilisi' → city dim set
//   isLoading: false → all dims resolved ✅

// Flow when user changes country to 'US':
//   validateCascadeValues: region='GE-TB' not in US regions → region = null, city = null
//   Pass 2: options for 'US' load → first region = 'US-NY' → region dim set
//   options for 'US-NY' load → first city = 'new-york' → city dim set ✅
```

### Form reset — effects + defaults

```ts
defineFilters({
  bars: { main: { filters: {
    reportType: { type: 'select', options: REPORT_TYPES, defaultValue: 'annual' },
    quarter:    { type: 'select', options: QUARTERS,     defaultValue: 'Q1', dependsOn: ['reportType'] },
    month:      { type: 'select', options: MONTHS,       defaultValue: 'Jan', dependsOn: ['reportType'] },
  }}},

  effects: [
    // annual → clear quarterly and monthly fields
    { when: { op: 'eq', left: { $ctx: 'reportType' }, right: 'annual' },
      set:  { quarter: null, month: null } },
    // quarterly → clear month (not relevant)
    { when: { op: 'eq', left: { $ctx: 'reportType' }, right: 'quarterly' },
      set:  { month: null } },
  ],
})

// Effect sets quarter=null → Pass 2 → resolveDefaults → quarter gets 'Q1' (Tier 1)
// But quarter.dependsOn=['reportType'] and reportType='annual' → quarter disabled in UI
// The dim is set (for data queries) but the control is disabled (for UX) ✅
```

---

## Anti-patterns

```ts
// ❌ ExprVal default referencing $derived — not available at filter time:
{ type: 'year-select', defaultValue: { $derived: 'latestYear' } }
// latestYear is render-time (engine.evalDerived). Defaults resolve at filter time.
// ✅ Use { from: 'options', pick: 'last' } on a DataSpec that returns year options.

// ❌ Manual "reset" effect without default:
effects: [{ when: ..., set: { region: null } }]  // but region has no defaultValue
// region stays null → data blocked → bad UX
// ✅ Always pair reset effects with defaultValue on the cleared param.

// ❌ effects to prevent parent change from cascading:
effects: [{ when: { op: 'neq', ... }, set: { region: 'GE-TB' } }]  // hardcoded
// ✅ validateCascadeValues + { from: 'options', pick: 'first' } — dynamic and correct.

// ❌ Using defaultValue for mandatory values (user must choose):
{ type: 'cascade', defaultValue: 'GE-TB' }  // forces 'GE-TB', user doesn't see they need to pick
// ✅ No defaultValue → dim = null → contracts: { region: 'required' } → empty state
//    "Please select a region" is better than a silently wrong default.

// ❌ Tier 2 default referencing $ctx of another Tier 2 param without topo sort:
// { key: 'a', defaultValue: { $ctx: 'b' } }  declared BEFORE 'b' — still works
// evaluator auto-detects → sorts b before a ✅
// ❌ But: circular reference in defaults — a → b → a → throws at init. Same as computed.
```

---

## Code reference

```
docs/architecture/examples/defaults.md
  — DefaultSpec, OptionsDefault types
  — Updated ParamDef (DefaultSpec instead of DimVal)
  — resolveDefaults() — two-pass resolution + topological sort
  — resolveDefaultValue() — per-param resolution (Tier 1/2/3)
  — validateCascadeValues() — stale value invalidation
  — Simple form, computed default, cascade chain, form reset examples
```