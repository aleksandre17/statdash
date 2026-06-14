# Mode System — Architecture

> Full isolation of rendering mode (year / range / compare) from filter params.
> Grafana time range pattern: mode = first-class concern, not a variable.

---

## Problem — current state

```
TimeMode = 'year' | 'range' | 'compare'   ← closed union (constraint #1)
SectionContext.timeMode: TimeMode           ← lives inside filter context
visibleWhen: { op: 'eq', param: 'mode', is: 'year' }  ← hardcoded param name
BarNode.timeToggle: boolean                ← mode toggle coupled to filter bar
PageConfig.modeOrder?: string[]            ← ordering hint only, no semantic
```

Mode is filter param-ის ნიღბის ქვეშ. ეს wrong layer-ია — mode changes HOW,
filter params change WHAT/WHERE. ერთი ცვლება ყველას ეხება: 'compare' mode
= new DataSpec branch + new visible sections + new UI tab. ახლა ეს ad-hoc.

---

## Platform precedent

**Grafana:** time range ≠ template variable. Separate state, separate UI
(`TimeRangePicker`), panels receive `timeRange` via context (not variable).
Variables (`$region`, `$sector`) = WHAT. Time range = WHEN. Grafana never
mixes them.

**Redux Toolkit:** slice pattern — isolated reducer + actions + selectors.
Others depend on mode slice via selectors. Mode slice depends on nothing.

**Our mapping:**
- mode = HOW (which DataSpec branch, which sections visible, which UI tab)
- filter params = WHAT/WHERE (geo, sector, indicator, time value)

---

## Architecture decisions

| Decision | Choice | Reason |
|---|---|---|
| `ModeId` type | `string` (open) | new mode = registration, not code change |
| URL state | via `FilterContext` (Phase 1) | backward compat, no race condition |
| `ModeContext` | view over `FilterContext[modeKey]` | clean seam, same URL |
| `RenderContext.mode` | parallel to `sectionCtx` | not inside it — different concern |
| `VisibilityExpr` | extend with `mode-is`/`mode-in`/`mode-not` ops | same discriminant, same evaluator |
| `ModeBarNode` | standalone node type | plugin-registered, Constructor-visible |
| Old `timeToggle` | keep working (Strangler Fig) | backward compat during migration |
| `SectionContext.timeMode` | widened to `ModeId = string` | non-breaking type widening |

---

## Layer breakdown

```
engine/core/src/mode/
  types.ts      ← ModeId · ModeDef · ModeContext · ModeRegistry interface
  registry.ts   ← modeRegistry singleton
  evaluator.ts  ← evalMode(expr, mode) — pure, zero React

engine/core/src/config/section.ts
  VisibilityExpr += { op: 'mode-is' } | { op: 'mode-in' } | { op: 'mode-not' }
  evalVisibility(expr, filterParams, mode?) — extended, backward compatible

engine/core/src/core/context.ts
  TimeMode   → ModeId (type alias, not closed union)
  SectionContext.timeMode: ModeId (widened — non-breaking)

engine/react/src/context/ModeContext.tsx
  useModeContext(modeKey, available) — hook: FilterContext → ModeContext
  ModeCtx React context

engine/react/src/engine/types.ts
  RenderContext += mode: ModeContext

engine/react/src/engine/SiteRenderer.tsx
  useModeContext() → inject into RenderContext
  evalVisibility receives ctx.mode.current

plugins/nodes/mode-bar/
  ModeBarShell.tsx    ← renders mode tabs, reads ctx.mode
  ModeBarSkeleton.tsx ← tab strip skeleton
  index.ts            ← NodeSlice export
  types.ts            ← ModeBarNode + NodeTypeMap augmentation
```

---

## Dependency graph — who depends on whom

```
modeRegistry         ← no deps (pure)
      ↓
ModeContext          ← depends on FilterContext (URL state)
      ↓
RenderContext.mode   ← injected by SiteRenderer
      ↓
┌─────────────────────────────────────────────┐
│  evalVisibility(expr, fp, mode.current)     │  ← sections visible/hidden
│  DataSpec.by-mode[mode.current]             │  ← data branch
│  ModeBarShell reads ctx.mode.available       │  ← UI tabs
│  ModeBarShell calls ctx.mode.set(id)         │  ← sets URL param via FilterContext
└─────────────────────────────────────────────┘
```

Mode is independent. Everything reads from it. Mode reads only from URL.

---

## VisibilityExpr extension

```ts
// New variants added to existing discriminated union:
| { op: 'mode-is';  mode:  ModeId   }   // current === mode
| { op: 'mode-in';  modes: ModeId[] }   // current ∈ modes
| { op: 'mode-not'; mode:  ModeId   }   // current !== mode
```

`evalVisibility(expr, filterParams, mode?)` — third param optional.
When absent (old callers): mode-* ops return false (conservative → hidden).
When present: evaluated correctly.

No `param: 'mode'` reference anywhere. Filter state and mode state are separate.

---

## JSON config — how sections depend on mode

```ts
// OLD (still works during migration):
view: { visibleWhen: { op: 'eq', param: 'mode', is: 'year' } }

// NEW (preferred):
view: { visibleWhen: { op: 'mode-is', mode: 'year' } }

// Compound (and/or — already supported by VisibilityExpr tree):
view: {
  visibleWhen: {
    op: 'and',
    exprs: [
      { op: 'mode-is', mode: 'range' },
      { op: 'isset', param: 'geo' },
    ]
  }
}
```

---

## ModeBarNode — JSON-serializable, Constructor-ready

```ts
interface ModeBarNode {
  type:  'mode-bar'
  key?:  string     // URL param key — default: 'mode'
  modes: ModeId[]  // available on this page: ['year', 'range'] | ['year', 'range', 'compare']
}
```

In page config (replaces `BarNode.timeToggle`):
```ts
// PageConfig (named slot) OR as child of FilterBarNode:
{ type: 'mode-bar', modes: ['year', 'range'] }
```

Constructor: `nodeRegistry.list()` returns `mode-bar` → palette shows it.
Schema: `{ fields: [{ name: 'modes', type: 'json', label: 'Available modes' }] }`.

---

## Built-in mode registration (setupRegistrations.ts)

```ts
modeRegistry.register({ id: 'year',    label: 'წელი',      icon: 'calendar',       dataKey: 'year' })
modeRegistry.register({ id: 'range',   label: 'დიაპაზონი', icon: 'calendar-range', dataKey: 'range' })
modeRegistry.register({ id: 'compare', label: 'შედარება',  icon: 'git-compare',    dataKey: 'compare' })
```

New mode: one `modeRegistry.register()` call. Zero other changes.
Constructor sees it via `modeRegistry.list()`. Page config uses it by id string.

---

## Strangler Fig migration

Phase 1 (both old and new work):
- Old `BarNode.timeToggle` → keeps working, writes 'mode' param via FilterContext
- Old `visibleWhen: { op: 'eq', param: 'mode', is: 'year' }` → works (mode is in filterParams)
- New `{ type: 'mode-bar' }` nodes → use ModeContext
- New `{ op: 'mode-is', mode: 'year' }` → use ModeContext.current

Phase 2 (when migration complete):
- Delete `SectionContext.timeMode` (or keep as alias)
- Delete `RenderContext.timeModeKey`
- Delete `BarNode.timeToggle`
- Migrate all configs to `{ op: 'mode-is' }`

---

## Code reference

```
docs/architecture/examples/mode-system.md  ← full framework-level code
```