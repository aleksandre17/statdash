---
description: Shell anatomy, component wrapper pattern, META structure for plugins/
paths:
  - "plugins/**"
---

# plugins/ — Shell Rules

> **Enforcement layer** (path-scoped · auto-loads on `paths:` match) — ✅/❌ only, not a design home.
> Design → `docs/architecture/subsystems/02-node-system.md` · `30-plugin-taxonomy.md` · Method → `.claude/generic/engineering/structure.md` · `refactoring.md` · Orientation → `plugins/CLAUDE.md`

## NodeSlice anatomy

```ts
// Shell = plain function (NOT React.FC — engine calls it directly)
export const Shell: NodeRenderer<MyNode> =
  (def, ctx, children) => <MyControl def={def} ctx={ctx} children={children} />

// Hooks ONLY in inner component:
function MyControl({ def, ctx, children }) {
  const t   = useResolveLocale()   // content strings ✅
  const fmt = useFmt()             // numbers/dates ✅
  // useState, useEffect etc. here ✅
}

export const META: NodeSliceMeta = {
  sliceType: 'node',
  type:      'my-type',
  variant:   'default',
  label:     { ka: '...', en: '...' },
  i18n:      { ka: { export: 'ექსპორტი' }, en: { export: 'Export' } },
}
```

## Chrome shells — ZERO PROPS

```ts
// chromeRegistry.get(slot, key)() — called with NO arguments
export function FullHeader(): ReactNode { ... }  // ✅
// Props on chrome shell = crash at runtime ❌
```

## ISP — no cross-imports between shells

```
❌  FilterBarShell imports YearSelectShell
❌  SectionShell imports ChartShell
✅  filterControlRegistry.get(type) → Shell  (registry dispatch)
✅  nodeRegistry.get(type, variant) → Shell  (registry dispatch)
```

## i18n in shells

```ts
const t    = useResolveLocale()              // LocaleString → string
const fmt  = useFmt()                        // number/date formatting
const tSys = useT('my-type')                 // system UI strings (from META.i18n)

// classifiers from ctx — never call store directly:
resolveLabel(code, ctx.classifiers[col.key], ctx.locale, ctx.fallbackLocale)
```

## OCP check — new shell must NOT change:

```
❌  packages/react/ changed  → OCP violation
❌  AppChrome.tsx changed     → OCP violation
❌  FilterBarShell changed    → OCP violation
✅  registerSlice(mySlice)   → done. Zero other changes.
```