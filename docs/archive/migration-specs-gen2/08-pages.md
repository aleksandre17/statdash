# Migration — Track A: Page Configs + Verification

> Last step (📄). Platform must be ready first (steps ①–🗑 complete).

---

## Track A — Page Config Pattern

```ts
// pages/gdp.config.ts — JSON NodeDef tree. Zero logic. Zero React.
// ❌ DEPRECATED: PageConfigBase { root: NodeDef } — page was a wrapper
// ❌ DEPRECATED: FilterBarNode { bars: ... } — schema inside node
// ✅ CANONICAL: page IS the root. filterSchema = source of truth.

export const gdpPage: InnerPageNode & PageConfigBase = {
  id:       'gdp',
  type:     'inner-page',
  title:    { ka: 'მთლიანი შიდა პროდუქტი', en: 'Gross Domestic Product' },
  path:     '/gdp',
  storeKey: 'gdp',                  // NodeBase.storeKey — inherited by all children

  filterSchema: {
    bars: {
      main: { position: 'sticky', order: 1, filters: {
        time: { type: 'year-select', defaultValue: { from: 'options', pick: 'last' } },
        geo:  { type: 'cascade',
                options: { type: 'query', data: { type: 'query', indicator: 'GEO_LIST' },
                           valueField: 'code', labelField: 'label' },
                defaultValue: 'ka' },
      }},
    },
  },

  children: [
    { type: 'filter-bar', layout: { position: 'sticky-top', order: 1 } },
    // barIds absent → renders all bars from filterSchema

    { type: 'kpi-strip', layout: { position: 'flow', order: 2, span: 'full' },
      data: { type: 'row-list', indicators: ['B1G', 'P3', 'P51G'] },
    },

    { type: 'section', id: 'gdp-main',
      title: { ka: 'მშპ', en: 'GDP' },
      layout: { position: 'flow', order: 3, span: 'full' },
      data:   { type: 'timeseries', indicator: 'B1G',
                dims: { time: { $ctx: 'time' }, geo: { $ctx: 'geo' } } },
      children: [
        { type: 'chart', chartType: 'line', layout: { role: 'chart' } },
        { type: 'table', layout: { role: 'table' },
          columns: [
            { key: 'time', label: { ka: 'წელი',  en: 'Year' } },
            { key: 'B1G',  label: { ka: 'მშპ',   en: 'GDP'  } },
          ]
        },
      ],
    },
  ],
}
// JSON.parse(JSON.stringify(gdpPage)) === gdpPage ✅ — Constructor-serializable
// Phase 2: pages/ deleted → Constructor writes to DB → manifest fetches from API
```

---

## Migration Pattern: features/ → pages/

All page configs move from `src/features/*/` to `src/pages/`:
- `src/features/accounts/accounts.page.ts` → `src/pages/accounts.config.ts`
- `src/features/gdp/gdp.page.ts`           → `src/pages/gdp.config.ts`
- `src/features/regional/regional.page.ts` → `src/pages/regional.config.ts`
- `src/features/landing/landing.page.ts`   → `src/pages/landing.config.ts`

Each config:
1. Page type: `InnerPageNode & PageConfigBase` or `TabPageNode & PageConfigBase`
2. `filterBar: {...}` → split into `filterSchema` + `filterBar: { type: 'filter-bar' }`
3. Named fields (`chart/table`) → `children: [...]` (BLOCKER 4)
4. String titles/labels → `LocaleString` (`{ ka: '...', en: '...' }`)
5. `storeKey` inherited from NodeBase (not `defaultStore`)

---

## Final Verification Checklist

```
□ npx tsc --noEmit → 0 errors
□ Landing page renders
□ GDP: filter bar sticky · chart/table toggle · KPI strip
□ Accounts: tab navigation · section content · filter cascade
□ Regional: map/chart · filter bar
□ Chrome: header · sidebar · footer visible · nav links correct
□ URL state: filter change → URL updates → reload → same state
□ Constructor test: JSON.parse(JSON.stringify(pageConfig)) === pageConfig ✅
□ New chrome variant: manifest.chrome.AppHeader = 'minimal' → MinimalHeader renders
□ New node type: register 1 slice → appears in palette → Constructor adds to page ✅

i18n:
□ /ka/gdp → Georgian labels · /en/gdp → English labels · /unknown → redirect /ka/gdp
□ page title { ka:'მშპ', en:'GDP' } → resolves per URL locale
□ table column classifier codes → resolveLabel → locale-aware label
□ numbers → fmt.number() → Georgian format (45 234,5) vs English (45,234.5)
□ locale switcher → URL prefix changes → content re-renders
□ new locale in manifest.i18n.locales → switcher auto-shows → 0 code change ✅
□ JSON.parse(JSON.stringify({ka:'მშპ',en:'GDP'})) === same ✅
```