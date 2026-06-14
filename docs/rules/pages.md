---
description: Track A page config rules — JSON NodeDef tree, filterSchema, children[]
paths:
  - "src/pages/**"
---

# src/pages/ — Track A Rules

> **Enforcement layer** (path-scoped · auto-loads on `paths:` match) — ✅/❌ only, not a design home.
> Design → `docs/plan/SYSTEM-PIPELINE-TREE.md` (Layer 6) · `docs/architecture/examples/gdp-page-config.md` · Method → `.claude/generic/engineering/structure.md` · `development.md` · Orientation → `src/CLAUDE.md`

## Page config = pure JSON NodeDef tree

```ts
// ✅ CANONICAL: page IS the root. filterSchema = source of truth.
export const gdpPage: InnerPageNode & PageConfigBase = {
  id:       'gdp',
  type:     'inner-page',
  title:    { ka: 'მთლიანი შიდა პროდუქტი', en: 'Gross Domestic Product' },
  path:     '/gdp',
  storeKey: 'gdp',

  filterSchema: {
    bars: {
      main: { position: 'sticky', order: 1, filters: {
        time: { type: 'year-select', defaultValue: { from: 'options', pick: 'last' } },
        geo:  { type: 'cascade', ... },
      }},
    },
  },

  children: [
    { type: 'filter-bar', layout: { position: 'sticky-top', order: 1 } },
    { type: 'kpi-strip', ... },
    { type: 'section', children: [
      { type: 'chart', layout: { role: 'chart' } },
      { type: 'table', layout: { role: 'table' } },
    ]},
  ],
}
```

## Strict rules

```
❌  FilterBarNode.bars (schema inside display node) — BLOCKER 3
❌  SectionNode.chart?/table? named fields          — BLOCKER 4
❌  JSX, functions, imports inside config
❌  plain string titles/labels (use LocaleString)
❌  storeKey absent when page needs non-default store

✅  filterSchema on PageConfigBase
✅  FilterBarNode = { type: 'filter-bar', barIds?: string[] } only
✅  children: NodeDef[] everywhere
✅  title/label: { ka: '...', en: '...' }
✅  JSON.parse(JSON.stringify(config)) === config  ← Constructor test
```

Full pattern → `docs/architecture/examples/gdp-page-config.md` (canonical) · historical spec → `docs/archive/migration-specs-gen2/08-pages.md`
Migration status → `.claude/individual/context/phase-status.md`