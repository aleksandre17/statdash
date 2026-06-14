# showcase.ts

> Reference example (TypeScript) — documentation, not compiled source.

```ts
/**
 * Framework Showcase — Full capability demonstration
 *
 * ერთი სრული JSON manifest. სამი გვერდი. ყველა feature ერთ ადგილზე.
 * პლატფორმის ყველა შესაძლებლობა გამოყენებულია — DataSpec, ExprVal,
 * FilterSchema, derive, visibleWhen, storeKey, layout, by-param, module augmentation.
 *
 * This is pure config — no functions, no JSX, no framework code.
 * JSON.parse(JSON.stringify(SHOWCASE_MANIFEST)) === SHOWCASE_MANIFEST  ✅
 */

// ═══════════════════════════════════════════════════════════════════════════
// LEGEND — architectural role of each JSON element
// ═══════════════════════════════════════════════════════════════════════════
//
//  [PAGE NODE]      InnerPageNode | TabPageNode | ContainerPageNode
//                   engine: renderNode → AppChrome wraps page shell
//                   shell: ThemeConfig.shells[page.type]
//
//  [NODE]           Built-in NodeDef: section · chart · table · filter-bar · kpi-strip
//                   engine traverses tree, resolves data, calls shell
//                   shell: ThemeConfig.shells[node.type]
//
//  [APP NODE]       NodeDef added via NodeTypeMap module augmentation in src/
//                   renderer: nodeRegistry.get(node.type)  (NOT ThemeConfig.shells)
//                   no cast needed — type is in NodeDef union after augmentation
//
//  [SHELL]          NOT in this JSON — lives in ThemeConfig.shells (theme-config.md)
//                   node's type: field selects shell at render time
//                   e.g. type:'section' → ThemeConfig.shells['section'] → GeostatSectionShell
//
//  [CHROME SLOT]    NOT in this JSON — lives in ThemeConfig.chrome (ChromeMap)
//                   AppChrome.tsx: const { chrome } = useTheme() → <chrome.AppHeader />
//                   SiteManifest.nav[] feeds SiteContext → chrome reads via useSiteNav()
//
//  [ROLE SLOT]      Child node with layout.role
//                   section shell groups children by distinct roles, renders toggle buttons
//                   renderChild(i) called only for active role — one role rendered at a time
//
//  [TAB SLOT]       Child section with layout.label
//                   tab-page shell renders label as tab header; renderChild(activeTab) only
//
//  [STORE SCOPE]    storeKey on PageConfigBase or NodeBase
//                   sets ctx.pageStoreKey for this node + all descendants (CSS cascade pattern)
//                   nearest ancestor wins; DataSpec.storeId overrides for one spec only
//
//  [DATA SPEC]      data: { type, ... } on any NodeBase
//                   interpretSpec(spec, ctx) → DataRow[] at render time (Suspense-aware)
//
//  [FILTER SCHEMA]  filterSchema: { bars, derive, effects, crossValidate } on PageConfigBase
//                   pure JSON → defineFilters(schema) → SectionContext + FilterBarSpec[]
//                   Constructor stores in DB; no code change needed to add/modify filters
//
//  [PARAM DEF]      Entry in bars[barId].filters — filter control config
//                   filterRegistry renders control by type:
//                     year-select | cascade | select | multi-select | hidden
//
//  [DERIVE filter]  derive: DeriveMap inside filterSchema
//                   evalDerived() at filter eval time — pure ExprVal only, no store access
//
//  [DERIVE node]    derive: NodeDeriveMap on NodeBase
//                   evalNodeDerive() at render time, before shell called
//                   superset: ExprVal entries + DataLookupOp (engine resolves DataSpec + reads field)
//
//  [EXPR VAL]       Any ExprVal field: { $ctx } | { $derived } | { $literal } | { $row } | { op:... }
//                   evalExpr(val, scope) → DimVal at runtime
//


// ═══════════════════════════════════════════════════════════════════════════
// Module augmentation — app extends NodeTypeMap              [APP NODE setup]
// (lives in src/features/landing/types.ts in real app)
// ═══════════════════════════════════════════════════════════════════════════

declare module '@geostat/react' {
  interface NodeTypeMap {
    'landing-hero':  { type: 'landing-hero';  layout?: import('@geostat/react').LayoutHints; view?: import('@geostat/react').ViewParams }
    'landing-stats': { type: 'landing-stats'; layout?: import('@geostat/react').LayoutHints; data?: import('@geostat/react').DataSpec }
    'geo-map':       { type: 'geo-map';       layout?: import('@geostat/react').LayoutHints; view?: import('@geostat/react').ViewParams }
  }
}

import type { SiteManifest } from '@geostat/react'
declare const gdpStore:      import('@geostat/react').DataStore
declare const accountsStore: import('@geostat/react').DataStore
declare const regionalStore: import('@geostat/react').DataStore


// ═══════════════════════════════════════════════════════════════════════════
// SHOWCASE MANIFEST                                              [MANIFEST]
// ═══════════════════════════════════════════════════════════════════════════

export const SHOWCASE_MANIFEST: SiteManifest = {

  // ── Store registry ─────────────────────────────────────────────────────
  // [STORE] DataStore instances — registered by key.
  // Referenced by: storeKey (scope cascade) or DataSpec.storeId (explicit override).
  stores: {
    gdp:      gdpStore,        // [STORE] GDP/national accounts
    accounts: accountsStore,   // [STORE] institutional sector accounts
    regional: regionalStore,   // [STORE] sub-national / geographic breakdown
  },

  // ── Navigation ──────────────────────────────────────────────────────────
  // NOT chrome itself — this feeds SiteContext. Chrome reads it via useSiteNav().
  // [CHROME SLOT] AppHeader / AppSidebar / AppFooter live in ThemeConfig.chrome,
  //   not here. GeostatAppHeader() calls useSiteNav() → reads this nav[] internally.
  nav: [
    { label: 'მთავარი',    path: '/',         pageId: 'landing',  icon: 'home'      },
    { label: 'მშპ',        path: '/gdp',      pageId: 'gdp',      icon: 'bar-chart', color: '#1a6b3c' },
    { label: 'ანგარიშები', path: '/accounts', pageId: 'accounts', icon: 'document',  color: '#2952a3' },
  ],

  // ── Pages ─────────────────────────────────────────────────────────────
  pages: {


// ╔═══════════════════════════════════════════════════════════════════════════
// ║  PAGE 1 — Landing                                          [PAGE NODE]
// ║  ContainerPageNode → SHELL: ThemeConfig.shells['container-page']
// ║  GeostatContainerPageShell reads variant:'landing' → GeostatLandingShell
// ╚═══════════════════════════════════════════════════════════════════════════

    landing: {
      type:     'container-page',         // [NODE type] → SHELL: 'container-page'
      variant:  'landing',                // SHELL ROUTING — GeostatContainerPageShell reads def.variant
                                          //   'landing' → GeostatLandingShell (hero CSS grid)
                                          //   (no entry) → DefaultContainerLayout
      id:       'landing',
      title:    'მთავარი',
      storeKey: 'gdp',                    // [STORE SCOPE] all children inherit 'gdp' as default store

      children: [

        // ───────────────────────────────────────────────────────────────────
        //  [APP NODE]  'landing-hero'
        //  declared via NodeTypeMap augmentation above → LandingHeroNode ∈ NodeDef (no cast)
        //  renderer: nodeRegistry.get('landing-hero') → LandingHeroRenderer (src/)
        //  NOT in ThemeConfig.shells — app node types use nodeRegistry, not shell map
        {
          type:   'landing-hero',
          layout: { position: 'flow', order: 1, span: 'full' },
          view: {
            subtitle: { $literal: 'საქართველოს სტატისტიკის ეროვნული სამსახური' }, // [EXPR VAL] literal string
            hero:     { $literal: true },                                            // [EXPR VAL] literal boolean
          },
        },

        // ───────────────────────────────────────────────────────────────────
        //  [NODE]  'kpi-strip'
        //  shell: ThemeConfig.shells['kpi-strip'] → GeostatKpiStripShell
        //  store: inherited [STORE SCOPE] 'gdp' from page
        {
          type:   'kpi-strip',
          layout: { position: 'flow', order: 2, span: 'full' },
          data: {                                                   // [DATA SPEC] row-list
            type:       'row-list',
            indicators: ['B1G', 'P3', 'P51G', 'D1'],
            dims:       { time: { $literal: 2024 } },              // [EXPR VAL] literal dim value
            filter:     { isCarryForward: 0 },                     // post-fetch row filter (SNA dedup)
          },
        },

        // ───────────────────────────────────────────────────────────────────
        //  [NODE]  'section' — GDP trend, by-param mode switch
        //  shell: ThemeConfig.shells['section'] → GeostatSectionShell
        //  data: [DATA SPEC] by-param — switches branch on ctx.dims['timeMode']
        //  children: two [ROLE SLOT]s — section shell renders chart↔table toggle
        {
          type:   'section',
          layout: { position: 'flow', order: 3, span: 'full' },
          view: {
            subtitle:   { op: 'template', tmpl: 'მშპ ტენდენცია · მლნ ₾' }, // [EXPR VAL] template
            exportable: { $literal: true },
          },
          data: {                                                   // [DATA SPEC] by-param
            type:  'by-param',
            param: 'timeMode',                                      // resolves ctx.dims['timeMode'] → branch key
            specs: {
              year:  { type: 'timeseries', indicator: 'B1G',
                       dims: { time: { $ctx: 'time' } }, filter: { isCarryForward: 0 } },
              range: { type: 'timeseries', indicator: 'B1G',
                       dims: { FREQ: { $literal: 'A' } }, filter: { isCarryForward: 0 } },
            },
          },
          children: [
            { type: 'chart', layout: { role: 'chart', label: 'გრაფიკი' },  // [ROLE SLOT] chart
              def: { type: 'line',
                     encoding: { x: { field: 'time',  title: 'წელი'  },
                                  y: { field: 'value', title: 'მლნ ₾' } } } },
            { type: 'table', layout: { role: 'table', label: 'ცხრილი' } }, // [ROLE SLOT] table
          ],
        },

        // ───────────────────────────────────────────────────────────────────
        //  [APP NODE]  'landing-stats'
        //  NodeTypeMap augmentation → LandingStatsNode ∈ NodeDef (no cast)
        //  renderer: nodeRegistry.get('landing-stats') → LandingStatsRenderer (src/)
        {
          type:   'landing-stats',
          layout: { position: 'flow', order: 4, span: 'full' },
          data: {                                                   // [DATA SPEC] row-list
            type:       'row-list',
            indicators: ['B1G_GROWTH', 'B1G_SHARE_EU'],
            dims:       { time: { $literal: 2024 } },
            filter:     { isCarryForward: 0 },
          },
        },

      ],
    },


// ╔═══════════════════════════════════════════════════════════════════════════
// ║  PAGE 2 — GDP                                              [PAGE NODE]
// ║  InnerPageNode → SHELL: ThemeConfig.shells['inner-page']
// ║  GeostatInnerPageShell renders AppChrome:
// ║    [CHROME SLOT] chrome.AppHeader   — GeostatAppHeader (reads useSiteNav())
// ║    [CHROME SLOT] chrome.AppSidebar  — GeostatAppSidebar
// ║    [CHROME SLOT] chrome.AppFooter   — GeostatAppFooter
// ║  Chrome slots live in ThemeConfig.chrome (theme-config.md) — NOT in this JSON.
// ╚═══════════════════════════════════════════════════════════════════════════

    gdp: {
      type:     'inner-page',             // [NODE type] → SHELL: 'inner-page'
      id:       'gdp',
      title:    'მშპ — ეროვნული ანგარიშები',
      storeKey: 'gdp',                    // [STORE SCOPE] page default — all children inherit
      color:    '#1a6b3c',

      // ─────────────────────────────────────────────────────────────────────
      //  [FILTER SCHEMA]
      //  pure JSON → defineFilters(filterSchema) → SectionContext + FilterBarSpec[]
      //  SiteRenderer calls defineFilters on mount. Constructor stores in DB as-is.
      //  Adding/modifying a filter = edit this JSON only, zero code change.
      filterSchema: {
        bars: {

          // [FILTER BAR] main — position:'sticky' → always visible at top
          main: {
            position: 'sticky',
            order:    0,
            filters: {
              time: {                                               // [PARAM DEF] year-select
                type:         'year-select',
                years:        { type: 'inline', items: { $cl: 'time' }, field: 'code' },
                defaultValue: { from: 'options', pick: 'last' },
              },
              mode: {                                               // [PARAM DEF] select — display mode
                type:         'select',
                defaultValue: 'year',
                options: [
                  { value: 'year',  label: 'წელი'    },
                  { value: 'range', label: 'პერიოდი' },
                ],
              },
              unit: {                                               // [PARAM DEF] select — price basis
                type:         'select',
                defaultValue: 'current',
                options: [
                  { value: 'current', label: 'მიმდინარე ფასებში' },
                  { value: 'const',   label: 'მუდმივ ფასებში'    },
                  { value: 'growth',  label: 'ზრდის ტემპი'       },
                ],
              },
            },
          },

          // [FILTER BAR] secondary — position:'float' → collapsible panel
          secondary: {
            position: 'float',
            order:    1,
            filters: {
              geo: {                                                // [PARAM DEF] cascade — from store
                type:         'cascade',
                options:      { type: 'query', data: { type: 'query', storeId: 'regional', indicator: 'GEO_LIST' }, valueField: 'code', labelField: 'label' },
                defaultValue: 'GE',
              },
              sector: {                                            // [PARAM DEF] cascade — options from store
                type:         'cascade',
                options:      { type: 'query', data: { type: 'query', indicator: 'SECTOR_LIST' }, valueField: 'code', labelField: 'label' },
              },
              aggregates: {                                        // [PARAM DEF] multi-select
                type:         'multi-select',
                defaultValue: ['B1G', 'P3'],
                options: { type: 'static', items: [
                  { value: 'B1G',     label: 'მშპ'              },
                  { value: 'P3',      label: 'საბოლოო მოხმარება' },
                  { value: 'P51G',    label: 'ინვესტიციები'      },
                  { value: 'D1',      label: 'ანაზღაურება'       },
                  { value: 'B2G_B3G', label: 'მოგება'            },
                ]},
              },
              vintage: {                                           // [PARAM DEF] hidden — never shown in UI
                type:         'hidden',
                defaultValue: { $literal: 'F' },                  // [EXPR VAL] literal — final obs only
              },
            },
          },

        },

        // [DERIVE filter] evalDerived() at filter eval time — pure ExprVal, no store access
        derive: [
          { key: 'displayYear',   expr: { $ctx: 'time' } },                            // [EXPR VAL] ctx ref
          { key: 'unitLabel',     expr: { op: 'if',                                    // [EXPR VAL] conditional
              cond: { op: 'eq', left: { $ctx: 'unit' }, right: 'growth' },
              then: { $literal: '%' },
              else: { $literal: 'მლნ ₾' } } },
          { key: 'isGrowthMode',  expr: { op: 'eq', left: { $ctx: 'unit' }, right: 'growth' } }, // [EXPR VAL] boolean flag
          { key: 'isRangeMode',   expr: { op: 'eq', left: { $ctx: 'mode' }, right: 'range'  } }, // [EXPR VAL] boolean flag
          { key: 'geoOrNational', expr: { op: 'coalesce',                              // [EXPR VAL] coalesce
              values: [{ $ctx: 'geo' }, { $literal: 'GE' }] } },
        ],

        // auto-reset side effects when filter values change
        effects: [
          { when: { op: 'eq', left: { $ctx: 'unit' }, right: 'growth' },
            set:  { sector: null } },
        ],

        // cross-field validation — shown as errors in filter bar UI
        crossValidate: [
          { fields:   ['geo', 'sector'],
            rule:     { op: 'or', exprs: [
              { op: 'null', value: { $ctx: 'geo'    } },
              { op: 'null', value: { $ctx: 'sector' } },
            ] },
            message: 'გეოგრაფია და სექტორი ერთდროულად ვერ გაიფილტრება' },
        ],

      },

      children: [

        // ───────────────────────────────────────────────────────────────────
        //  [NODE]  'filter-bar'
        //  shell: ThemeConfig.shells['filter-bar'] → GeostatFilterBarShell
        {
          type: 'filter-bar',                                       // [NODE type] → SHELL: 'filter-bar'
          bars: {
            main: {
              position: 'sticky', order: 0,
              filters: {
                time: { type: 'year-select', defaultValue: 2024 }, // [PARAM DEF]
                mode: { type: 'select', defaultValue: 'year',      // [PARAM DEF]
                        options: [{ value: 'year', label: 'წელი' }, { value: 'range', label: 'პერიოდი' }] },
                unit: { type: 'select', defaultValue: 'current',   // [PARAM DEF]
                        options: [{ value: 'current', label: 'მიმდინარე ფასებში' },
                                  { value: 'growth',  label: 'ზრდის ტემპი' }] },
              },
            },
            secondary: {
              position: 'float', order: 1,
              filters: {
                geo: { type: 'cascade',                            // [PARAM DEF]
                       options: { type: 'query', data: { type: 'query', storeId: 'regional', indicator: 'GEO_LIST' }, valueField: 'code', labelField: 'label' } },
              },
            },
          },
        },

        // ───────────────────────────────────────────────────────────────────
        //  [NODE]  'kpi-strip'
        //  shell: ThemeConfig.shells['kpi-strip'] → GeostatKpiStripShell
        {
          type:   'kpi-strip',
          layout: { span: 'full' },
          data: {                                                   // [DATA SPEC] row-list
            type:       'row-list',
            indicators: ['B1G', 'P3', 'P51G', 'D1', 'B2G_B3G'],
            dims: {
              time:       { $ctx: 'time'    },                     // [EXPR VAL] ctx ref → year-select param
              OBS_STATUS: { $ctx: 'vintage' },                     // [EXPR VAL] ctx ref → hidden param
            },
            filter: { isCarryForward: 0 },
          },
        },

        // ───────────────────────────────────────────────────────────────────
        //  [NODE]  'section' — main GDP timeseries
        //  shell: ThemeConfig.shells['section'] → GeostatSectionShell
        //  derive: [DERIVE node] NodeDeriveMap — includes DataLookupOp (map-field)
        //  data:   [DATA SPEC] by-param — branches on ctx.dims['mode']
        //  children: three [ROLE SLOT]s — chart / table / geo-map toggle
        {
          type:   'section',
          layout: { span: 'full' },
          derive: [                                                 // [DERIVE node] evalNodeDerive()
            {
              key:  'regionName',                                   //   DataLookupOp map-field entry
              expr: {
                op:       'map-field',                             //   engine fetches DataSpec, finds row, reads field
                data:     { type: 'query', indicator: 'GEO_LIST', storeId: 'regional' }, // [DATA SPEC] for lookup
                ref:      { $ctx: 'geo' },                        //   [EXPR VAL] ctx ref — match key in rows
                field:    'label',                                 //   return this field from matched row
                fallback: { $literal: 'საქართველო' },
              },
            },
          ],
          view: {
            subtitle: { op: 'template', tmpl: 'მშპ · {regionName} · {displayYear}' }, // [EXPR VAL] template using [DERIVE node] + [DERIVE filter]
            exportable: { $literal: true },
            noCollapse: { $literal: false },
          },
          data: {                                                   // [DATA SPEC] by-param
            type:  'by-param',
            param: 'mode',                                         // resolves ctx.dims['mode'] → branch key
            dims:  { geo: { $ctx: 'geoOrNational' } },            // [EXPR VAL] $derived from [DERIVE filter]
            filter: { isCarryForward: 0 },
            specs: {
              year:  { type: 'timeseries', indicator: 'B1G' },
              range: { type: 'timeseries', indicator: 'B1G', timeRange: [2015, 2024] },
            },
          },
          children: [
            { type: 'chart',   layout: { role: 'chart', label: 'გრაფიკი' },  // [ROLE SLOT] chart
              def: { type: 'line',
                     encoding: { x: { field: 'time',  title: 'წელი',  axis: { format: 'd' } },
                                  y: { field: 'value', title: { op: 'template', tmpl: 'მშპ ({unitLabel})' } } } } }, // [EXPR VAL] template in chart axis title
            { type: 'table',   layout: { role: 'table', label: 'ცხრილი' } }, // [ROLE SLOT] table
            { type: 'geo-map', layout: { role: 'map',   label: 'რუკა'   } }, // [ROLE SLOT] map + [APP NODE]
          ],
        },

        // ───────────────────────────────────────────────────────────────────
        //  [NODE]  'section' — growth rates
        //  shell: ThemeConfig.shells['section'] → GeostatSectionShell
        //  visibleWhen: [EXPR VAL] $derived — STRUCTURAL visibility (engine step 2)
        //    evaluates false → node removed from tree entirely (no DOM, not in ChildrenArg)
        {
          type:        'section',
          visibleWhen: { $derived: 'isGrowthMode' },               // [EXPR VAL] structural — removed from tree when false
          layout:      { span: 'full' },
          view: {
            subtitle: { $literal: 'ზრდის ტემპი, % (წინა წელთან)' },
          },
          data: {                                                   // [DATA SPEC] growth
            type:      'growth',
            indicator: 'B1G',
            base:      'yoy',
            dims: {
              geo:  { $ctx: 'geoOrNational' },                     // [EXPR VAL] $derived
              time: { $ctx: 'time'          },                     // [EXPR VAL] $ctx
            },
            filter: { isCarryForward: 0 },
          },
          children: [
            { type: 'chart', layout: { role: 'chart' },            // [ROLE SLOT] chart
              def: { type: 'bar',
                     encoding: { x: { field: 'time' }, y: { field: 'value' },
                                  color: { field: 'value',
                                           condition: [
                                             { test: { op: 'gt', left: { $row: 'value' }, right: 0 }, value: '#1a6b3c' }, // [EXPR VAL] $row conditional color
                                             { value: '#c0392b' },
                                           ] } } } },
            { type: 'table', layout: { role: 'table' } },          // [ROLE SLOT] table
          ],
        },

        // ───────────────────────────────────────────────────────────────────
        //  [NODE]  'section' — GDP by expenditure
        //  shell: ThemeConfig.shells['section'] → GeostatSectionShell
        //  defaultOpen: false → collapsed on load (progressive disclosure)
        {
          type:   'section',
          layout: { span: 'full' },
          view: {
            subtitle:    { $literal: 'მშპ ხარჯვის მეთოდით' },
            defaultOpen: { $literal: false },                      // progressive disclosure — collapsed on load
            exportable:  { $literal: true },
          },
          data: {                                                   // [DATA SPEC] pivot
            type:      'pivot',
            indicator: 'B1G',
            rows:      'INDICATOR',
            cols:      'time',
            dims:      { geo: { $ctx: 'geoOrNational' } },
            filter:    { isCarryForward: 0 },
          },
          children: [
            { type: 'table', layout: { role: 'table' } },          // [ROLE SLOT] table
            { type: 'chart', layout: { role: 'chart' },            // [ROLE SLOT] chart
              def: { type: 'stacked-bar',
                     encoding: { x: { field: 'time' }, y: { field: 'value' },
                                  color: { field: 'indicator' } } } },
          ],
        },

        // ───────────────────────────────────────────────────────────────────
        //  [NODE]  'section' — structural ratios
        //  shell: ThemeConfig.shells['section'] → GeostatSectionShell
        {
          type:   'section',
          layout: { span: 'half' },
          view: { subtitle: { $literal: 'სტრუქტურული პროპორციები' } },
          data: {                                                   // [DATA SPEC] ratio-list
            type: 'ratio-list',
            pairs: [
              { numerator: 'P3',   denominator: 'B1G', label: 'მოხმარება / მშპ'      },
              { numerator: 'P51G', denominator: 'B1G', label: 'ინვესტიციები / მშპ'   },
              { numerator: 'D1',   denominator: 'B1G', label: 'შრომის ხვედრითი წილი' },
            ],
            dims: {
              time: { $ctx: 'time'          },
              geo:  { $ctx: 'geoOrNational' },
            },
            filter: { isCarryForward: 0 },
          },
          children: [
            { type: 'chart', layout: { role: 'chart' },            // [ROLE SLOT] chart
              def: { type: 'bar', encoding: { x: { field: 'label' }, y: { field: 'value' } } } },
            { type: 'table', layout: { role: 'table' } },          // [ROLE SLOT] table
          ],
        },

        // ───────────────────────────────────────────────────────────────────
        //  [NODE]  'section' — sector breakdown
        //  shell: ThemeConfig.shells['section'] → GeostatSectionShell
        //  storeKey: [STORE SCOPE] OVERRIDE — this subtree uses 'accounts', not page 'gdp'
        //  visibleWhen: [EXPR VAL] op:exists — STRUCTURAL: absent until sector is selected
        {
          type:     'section',
          storeKey: 'accounts',                                    // [STORE SCOPE] subtree override — nearest ancestor wins
          layout:   { span: 'half' },
          visibleWhen: { op: 'exists', value: { $ctx: 'sector' } }, // [EXPR VAL] structural — absent until sector set
          view: { subtitle: { op: 'template', tmpl: 'სექტორი: {sector}' } },
          data: {                                                   // [DATA SPEC] row-list — uses [STORE SCOPE] 'accounts'
            type:       'row-list',
            indicators: ['D1', 'B2G_B3G', 'P51G', 'D62'],
            dims: {
              time:      { $ctx: 'time'   },
              BREAKDOWN: { $ctx: 'sector' },                       // [EXPR VAL] any SDMX dim key — not hardcoded
            },
            filter: { isCarryForward: 0 },
          },
          children: [
            { type: 'chart', layout: { role: 'chart' },            // [ROLE SLOT] chart
              def: { type: 'bar', encoding: { x: { field: 'indicator' }, y: { field: 'value' } } } },
            { type: 'table', layout: { role: 'table' } },          // [ROLE SLOT] table
          ],
        },

        // ───────────────────────────────────────────────────────────────────
        //  [NODE]  'section' — external Eurostat data
        //  shell: ThemeConfig.shells['section'] → GeostatSectionShell
        //  data: [DATA SPEC] type:'url' — direct URL fetch, no store registration needed
        {
          type:   'section',
          layout: { span: 'full' },
          view: {
            subtitle:    { $literal: 'ევროსტატის შედარებითი მონაცემები' },
            defaultOpen: { $literal: false },
          },
          data: {                                                   // [DATA SPEC] url — no ObsQuery, no store
            type:      'url',
            href:      '/api/eurostat/gdp-comparison.json',
            transform: 'fromSDMX',                                 // engine.registerTransform('fromSDMX', fn)
          },
          children: [
            { type: 'table', layout: { role: 'table' } },          // [ROLE SLOT] table
            { type: 'chart', layout: { role: 'chart' },            // [ROLE SLOT] chart
              def: { type: 'line',
                     encoding: { x: { field: 'time' }, y: { field: 'value' },
                                  color: { field: 'geo' } } } },
          ],
        },

      ],
    },


// ╔═══════════════════════════════════════════════════════════════════════════
// ║  PAGE 3 — Accounts                                         [PAGE NODE]
// ║  TabPageNode → SHELL: ThemeConfig.shells['tab-page']
// ║  GeostatTabPageShell: renders tab headers from layout.label
// ║    calls renderChild(activeTab) — only active tab rendered (lazy, memoized)
// ╚═══════════════════════════════════════════════════════════════════════════

    accounts: {
      type:       'tab-page',             // [NODE type] → SHELL: 'tab-page'
      id:         'accounts',
      title:      'ინსტიტუციური სექტორის ანგარიშები',
      storeKey:   'accounts',             // [STORE SCOPE] page default — children inherit 'accounts'
      defaultTab: 0,
      color:      '#2952a3',

      // [FILTER SCHEMA]
      filterSchema: {
        bars: {
          main: {
            position: 'sticky',
            order:    0,
            filters: {
              time:    { type: 'year-select', defaultValue: 2023 },       // [PARAM DEF]
              sector:  { type: 'cascade',                                 // [PARAM DEF]
                         options: { type: 'query', data: { type: 'query', indicator: 'SECTOR_LIST' }, valueField: 'code', labelField: 'label' },
                         defaultValue: 'S1' },
              account: { type: 'select', defaultValue: 'P&L',            // [PARAM DEF]
                         options: [
                           { value: 'P&L',    label: 'წარმოება'               },
                           { value: 'income', label: 'შემოსავლის განაწილება'  },
                           { value: 'capital',label: 'კაპიტალი'               },
                         ] },
            },
          },
        },
        derive: [                                                   // [DERIVE filter] evalDerived()
          { key: 'sectorLabel', expr: { op: 'if',                  // [EXPR VAL] conditional
              cond: { op: 'eq', left: { $ctx: 'sector' }, right: 'S1' },
              then: { $literal: 'ეროვნული ეკონომიკა' },
              else: { op: 'coalesce', values: [{ $ctx: 'sector' }, { $literal: 'ყველა სექტორი' }] } } },
        ],
      },

      children: [

        // ───────────────────────────────────────────────────────────────────
        //  [TAB SLOT]  Tab 0 — Overview
        //  layout.label → GeostatTabPageShell uses as tab header text
        //  renderChild(0) — only this tab rendered when tab 0 is active
        {
          type:   'section',
          layout: { label: 'მიმოხილვა' },                         // [TAB SLOT] layout.label = tab header
          children: [

            // [NODE] 'kpi-strip' — uses page [STORE SCOPE] 'accounts'
            {
              type:   'kpi-strip',
              layout: { span: 'full' },
              data: {                                               // [DATA SPEC] row-list
                type:       'row-list',
                indicators: ['B1G', 'D1', 'B8G', 'D62'],
                dims: { time: { $ctx: 'time' }, BREAKDOWN: { $ctx: 'sector' } },
                filter: { isCarryForward: 0 },
              },
            },

            // [NODE] 'section' — income distribution donut
            {
              type:   'section',
              layout: { span: 'full' },
              view: { subtitle: { op: 'template', tmpl: '{sectorLabel} · {time}' } }, // [EXPR VAL] template using [DERIVE filter]
              data: {                                               // [DATA SPEC] row-list
                type:       'row-list',
                indicators: ['D1', 'B2G_B3G', 'D4_PAY', 'D5_PAY'],
                dims: { time: { $ctx: 'time' }, BREAKDOWN: { $ctx: 'sector' } },
                filter: { isCarryForward: 0 },
              },
              children: [
                { type: 'chart', layout: { role: 'chart' },        // [ROLE SLOT] chart
                  def: { type: 'donut',
                         encoding: { theta: { field: 'value' }, color: { field: 'indicator' } } } },
                { type: 'table', layout: { role: 'table' } },      // [ROLE SLOT] table
              ],
            },

            // [NODE] 'section' — GDP context: storeId 'gdp' overrides page [STORE SCOPE] 'accounts'
            {
              type:   'section',
              layout: { span: 'half' },
              view: { subtitle: { $literal: 'GDP კონტექსტი (მშპ სტორი)' } },
              data: {                                               // [DATA SPEC] timeseries
                type:      'timeseries',
                storeId:   'gdp',                                  // explicit storeId — overrides page [STORE SCOPE]
                indicator: 'B1G',
                dims:      { time: { $ctx: 'time' } },
                filter:    { isCarryForward: 0 },
              },
              children: [
                { type: 'chart', layout: { role: 'chart' },        // [ROLE SLOT] chart
                  def: { type: 'line', encoding: { x: { field: 'time' }, y: { field: 'value' } } } },
              ],
            },

            // [NODE] 'section' — regional: storeId 'regional' (third store in same page)
            {
              type:   'section',
              layout: { span: 'half' },
              view: { subtitle: { $literal: 'რეგიონული განაწილება' } },
              data: {                                               // [DATA SPEC] row-list
                type:       'row-list',
                storeId:    'regional',                            // explicit storeId — third store in same page
                indicators: ['B1G'],
                dims:       { time: { $ctx: 'time' } },
                filter:     { isCarryForward: 0 },
              },
              children: [
                { type: 'geo-map', layout: { role: 'map',   label: 'რუკა'   } }, // [ROLE SLOT] map + [APP NODE]
                { type: 'table',   layout: { role: 'table', label: 'ცხრილი' } }, // [ROLE SLOT] table
              ],
            },

          ],
        },

        // ───────────────────────────────────────────────────────────────────
        //  [TAB SLOT]  Tab 1 — Institutional accounts detail
        {
          type:   'section',
          layout: { label: 'ინსტიტუციური ანგარიშები' },           // [TAB SLOT] layout.label = tab header
          children: [

            // [NODE] 'section' — by-param on account type
            {
              type:   'section',
              layout: { span: 'full' },
              view: { subtitle: { op: 'template', tmpl: 'ანგარიში: {account}' } },
              data: {                                               // [DATA SPEC] by-param
                type:  'by-param',
                param: 'account',                                  // resolves ctx.dims['account'] → branch key
                dims:  { time: { $ctx: 'time' }, BREAKDOWN: { $ctx: 'sector' } },
                filter: { isCarryForward: 0 },
                specs: {
                  'P&L':    { type: 'row-list', indicators: ['P1', 'P2', 'B1G', 'D1', 'B2G_B3G'] },
                  'income': { type: 'row-list', indicators: ['B2G_B3G', 'D4_REC', 'D4_PAY', 'B5G'] },
                  'capital':{ type: 'row-list', indicators: ['B8G', 'P51G', 'P52', 'B9'] },
                  'default':{ type: 'row-list', indicators: ['B1G', 'B8G', 'B9'] }, // fallback when account value unknown
                },
              },
              children: [
                { type: 'chart', layout: { role: 'chart' },        // [ROLE SLOT] chart
                  def: { type: 'bar', encoding: { x: { field: 'indicator' }, y: { field: 'value' } } } },
                { type: 'table', layout: { role: 'table' } },      // [ROLE SLOT] table
              ],
            },

            // [NODE] 'section' — compound visibleWhen: op:and
            // visibleWhen: [EXPR VAL] op:'and' — STRUCTURAL: node absent until BOTH conditions true
            {
              type:        'section',
              layout:      { span: 'full' },
              visibleWhen: {                                        // [EXPR VAL] structural — compound condition
                op: 'and',
                exprs: [
                  { op: 'exists', value: { $ctx: 'sector' } },     // sector is selected
                  { op: 'ne', left: { $ctx: 'sector' }, right: 'S1' }, // and not national economy
                ],
              },
              view: {
                subtitle: { op: 'template', tmpl: 'სექტორი {sectorLabel} — ვრცელი ანალიზი' },
              },
              data: {                                               // [DATA SPEC] row-list with post-fetch derive
                type:       'row-list',
                indicators: ['D1', 'D4_REC', 'D4_PAY', 'D5_REC', 'D5_PAY', 'B5G'],
                dims: {
                  time:       { $ctx: 'time'    },
                  BREAKDOWN:  { $ctx: 'sector'  },
                  OBS_STATUS: { $ctx: 'vintage' },                 // [EXPR VAL] hidden filter param
                },
                filter: { isCarryForward: 0 },
                derive: [
                  { key: 'netD4', expr: { op: 'sub',              // [EXPR VAL] $row arithmetic
                      left: { $row: 'D4_REC' }, right: { $row: 'D4_PAY' } } },
                ],
              },
              children: [
                { type: 'table', layout: { role: 'table' } },      // [ROLE SLOT] table
                { type: 'chart', layout: { role: 'chart' },        // [ROLE SLOT] chart
                  def: { type: 'bar', encoding: { x: { field: 'indicator' }, y: { field: 'value' } } } },
              ],
            },

          ],
        },

        // ───────────────────────────────────────────────────────────────────
        //  [TAB SLOT]  Tab 2 — Comparison
        {
          type:   'section',
          layout: { label: 'შედარება' },                           // [TAB SLOT] layout.label = tab header
          children: [

            // [NODE] 'section' — pivot: indicators × sectors
            {
              type:   'section',
              layout: { span: 'full' },
              view: {
                subtitle:   { op: 'template', tmpl: 'სექტორული შედარება · {time}' },
                exportable: { $literal: true },
                noCollapse: { $literal: true },
              },
              data: {                                               // [DATA SPEC] pivot
                type:      'pivot',
                indicator: 'B1G',
                rows:      'INDICATOR',
                cols:      'BREAKDOWN',
                dims:      { time: { $ctx: 'time' } },
                filter:    { isCarryForward: 0 },
              },
              children: [
                { type: 'table', layout: { role: 'table' } },      // [ROLE SLOT] table
                { type: 'chart', layout: { role: 'chart' },        // [ROLE SLOT] chart
                  def: { type: 'stacked-bar',
                         encoding: { x: { field: 'BREAKDOWN' }, y: { field: 'value' },
                                      color: { field: 'indicator' } } } },
              ],
            },

          ],
        },

      ],
    },

  },   // end pages
}   // end SHOWCASE_MANIFEST


// ═══════════════════════════════════════════════════════════════════════════
// Feature index — რა features-ია გამოყენებული ამ ფაილში
// ═══════════════════════════════════════════════════════════════════════════

/*
  DataSpec types used:
    ✅ row-list      — kpi-strip, section data, multi-indicator
    ✅ timeseries    — GDP trend, sector timeseries
    ✅ growth        — GDP growth rates (yoy)
    ✅ ratio-list    — structural proportions (P3/B1G, P51G/B1G)
    ✅ pivot         — GDP by expenditure, sector comparison
    ✅ by-param      — year/range mode switching, account type switching
    ✅ url           — Eurostat external data

  ExprVal used:
    ✅ { $literal }   — explicit scalar (2024, true, 'GE', 'F')
    ✅ { $ctx }       — filter param reference (time, geo, sector, mode)
    ✅ { $derived }   — computed value (isGrowthMode, sectorLabel)
    ✅ { $row }       — row field reference (inside derive spec)
    ✅ op: template   — string interpolation ('მშპ · {regionName}')
    ✅ op: if         — conditional expression
    ✅ op: eq / ne    — equality / inequality
    ✅ op: gt         — greater than (growth bar color)
    ✅ op: and        — logical AND (visibleWhen)
    ✅ op: exists     — null check
    ✅ op: coalesce   — first-non-null (geo fallback)
    ✅ op: sub        — arithmetic (netD4 derive)

  NodeDeriveMap (node-level):
    ✅ ExprVal entry          — displayYear, unitLabel, isGrowthMode
    ✅ DataLookupOp map-field — regionName lookup from regional store

  FilterSchema:
    ✅ year-select    — time filter
    ✅ cascade        — geo, sector (options from store)
    ✅ select         — mode, unit, account
    ✅ multi-select   — aggregates
    ✅ hidden         — vintage (default value, never shown)
    ✅ derive         — computed filter values
    ✅ effects        — auto-reset on condition
    ✅ crossValidate  — cross-field validation with message

  Node types:
    ✅ section           — [NODE] layout container + data scope
    ✅ chart             — [NODE] all chart encodings (line, bar, donut, stacked-bar)
    ✅ table             — [NODE] tabular display
    ✅ filter-bar        — [NODE] sticky + float bars
    ✅ kpi-strip         — [NODE] headline metrics
    ✅ inner-page        — [PAGE NODE] gdp page (AppChrome)
    ✅ tab-page          — [PAGE NODE] accounts page (tabs)
    ✅ container-page    — [PAGE NODE] landing page (variant: 'landing')
    ✅ landing-hero      — [APP NODE] via NodeTypeMap augmentation
    ✅ landing-stats     — [APP NODE] via NodeTypeMap augmentation
    ✅ geo-map           — [APP NODE] via NodeTypeMap augmentation

  Shells (NOT in JSON — in ThemeConfig.shells):
    ThemeConfig.shells['inner-page']     → GeostatInnerPageShell
    ThemeConfig.shells['tab-page']       → GeostatTabPageShell
    ThemeConfig.shells['container-page'] → GeostatContainerPageShell
    ThemeConfig.shells['section']        → GeostatSectionShell
    ThemeConfig.shells['chart']          → GeostatChartShell
    ThemeConfig.shells['table']          → GeostatTableShell
    ThemeConfig.shells['filter-bar']     → GeostatFilterBarShell
    ThemeConfig.shells['kpi-strip']      → GeostatKpiStripShell

  Chrome slots (NOT in JSON — in ThemeConfig.chrome):
    ThemeConfig.chrome.AppHeader         → GeostatAppHeader  (reads nav[] via useSiteNav())
    ThemeConfig.chrome.AppSidebar        → GeostatAppSidebar
    ThemeConfig.chrome.AppFooter         → GeostatAppFooter

  Store access:
    ✅ storeKey on page     — [STORE SCOPE] page-level default store
    ✅ storeKey on section  — [STORE SCOPE] subtree override (nearest ancestor wins)
    ✅ storeId on DataSpec  — single-node explicit override
    ✅ multiple stores in same page — gdp + accounts + regional in one manifest

  Structural control:
    ✅ visibleWhen: { $derived }   — [ROLE SLOT] boolean from derived flag
    ✅ visibleWhen: op:and         — compound structural condition
    ✅ visibleWhen: op:exists      — null check structural condition
    ✅ layout.role: 'chart'/'table'/'map' — [ROLE SLOT] section shell toggles
    ✅ layout.label                — [TAB SLOT] tab header text
    ✅ layout.span: 'full'/'half'  — grid sizing
    ✅ variant: 'landing'          — SHELL ROUTING inside container-page shell

  ViewParams:
    ✅ subtitle    — section header with template/literal
    ✅ hero        — full-width treatment
    ✅ exportable  — enable export controls
    ✅ noCollapse  — always expanded
    ✅ defaultOpen — collapsed by default (false = closed on load)

  ChartDef (encoding variety):
    ✅ line         — x:time, y:value
    ✅ bar          — x:indicator/time, y:value
    ✅ stacked-bar  — x:time, y:value, color:indicator
    ✅ donut        — theta:value, color:indicator
    ✅ conditional color — op:gt for growth direction (positive green / negative red)
*/
```
