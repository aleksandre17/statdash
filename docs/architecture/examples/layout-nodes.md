# layout-nodes.ts

> Reference example (TypeScript) — documentation, not compiled source.

```ts
/**
 * Example — Layout Nodes
 *
 * Core insight: layout IS the node tree.
 *   Platform = rendering primitives (registered shells).
 *   Constructor = layout decisions (what nodes, what order, what colSpan).
 *
 * Layout nodes: node types whose PRIMARY purpose is spatial composition.
 *   Same registration pattern as all other nodes — open registry.
 *   CSS tokens for all spacing/visual — zero hardcoded values.
 *   agnostic: GridShell knows CSS grid. Does not know GDP, Geostat, B1G.
 *
 * Platform precedents:
 *   Builder.io: Box · Columns · Section = layout nodes in open registry
 *   Grafana:    Row = layout node; panels sit inside rows
 *   Webflow:    Section > Container > Grid > Block — structural nesting IS layout
 *
 * IA Convention (platform: convention, not enforcement):
 *   Statistical publication standard (ONS · Eurostat · World Bank):
 *     1. Filter bar  — context setting   (sticky)
 *     2. KPI strip   — key numbers
 *     3. Sections    — breakdown / charts
 *     4. Methodology — collapsed by default
 *   This ordering = JSON children order. Constructor templates enforce it.
 *   Platform renders in whatever order JSON specifies. No platform enforcement.
 */

import type {
  NodeBase, NodeDef, ChildrenArg, NodeRenderer,
  RenderContext, NodeSliceMeta,
} from '@geostat/react'


// ═══════════════════════════════════════════════════════════════════════════
// Types — module augmentation (plugins/nodes/layout/types.ts)
// ═══════════════════════════════════════════════════════════════════════════

declare module '@geostat/react' {
  interface NodeTypeMap {
    'grid':    GridNode
    'columns': ColumnsNode
    'stack':   StackNode
    'card':    CardNode
    'divider': DividerNode
    'spacer':  SpacerNode
  }
}

export interface GridNode extends NodeBase {
  type:      'grid'
  columns?:  number     // grid template columns count (default: 12)
  gap?:      string     // CSS value or token: 'var(--spacing-md)' (default)
  children:  NodeDef[]
}

export interface ColumnsNode extends NodeBase {
  type:    'columns'
  count?:  number       // column count (default: 2)
  gap?:    string       // default: 'var(--spacing-md)'
  children: NodeDef[]
}

export interface StackNode extends NodeBase {
  type:       'stack'
  direction?: 'row' | 'column'   // default: 'column'
  gap?:       string             // default: 'var(--spacing-md)'
  wrap?:      boolean            // flex-wrap (default: false)
  children:   NodeDef[]
}

export interface CardNode extends NodeBase {
  type:      'card'
  children?: NodeDef[]     // optional — card can be leaf or container
}

export interface DividerNode extends NodeBase {
  type:     'divider'
  variant?: 'solid' | 'dashed' | 'invisible'   // default: 'solid'
}

export interface SpacerNode extends NodeBase {
  type:  'spacer'
  size?: string   // CSS value or token, default: 'var(--spacing-xl)'
}

// JSON.parse(JSON.stringify(node)) === node ✅ — all fields are JSON primitives


// ═══════════════════════════════════════════════════════════════════════════
// GridShell — plugins/nodes/layout/grid/GridShell.tsx
// ═══════════════════════════════════════════════════════════════════════════

// NodeRenderer = plain function. Hooks → inner component wrapper (engine rule).
export const GridShell: NodeRenderer<GridNode> =
  (def, _ctx, children) => <GridControl def={def} children={children} />

// Inner component owns all rendering logic:
function GridControl({ def, children }: { def: GridNode; children: ChildrenArg }) {
  return (
    <div
      className="layout-grid"
      style={{
        display:             'grid',
        gridTemplateColumns: `repeat(${def.columns ?? 12}, 1fr)`,
        gap:                 def.gap ?? 'var(--spacing-md)',   // CSS token
      }}
    >
      {children.defs.map((d, i) => (
        <div
          key={i}
          style={{
            gridColumn: d.layout?.colSpan ? `span ${d.layout.colSpan}` : undefined,
            gridRow:    d.layout?.rowSpan ? `span ${d.layout.rowSpan}` : undefined,
            alignSelf:  d.layout?.align   ?? undefined,
          }}
        >
          {children.rendered[i]}
        </div>
      ))}
    </div>
  )
}

// GridShell knows: CSS grid, colSpan, rowSpan, align, gap, --spacing-md token.
// GridShell does NOT know: GDP, Geostat, B1G, time, geo. Fully agnostic. ✅
// Zero hardcoded colors. CSS tokens only. ✅


// ═══════════════════════════════════════════════════════════════════════════
// ColumnsShell — plugins/nodes/layout/columns/ColumnsShell.tsx
// ═══════════════════════════════════════════════════════════════════════════

export const ColumnsShell: NodeRenderer<ColumnsNode> =
  (def, _ctx, children) => <ColumnsControl def={def} children={children} />

function ColumnsControl({ def, children }: { def: ColumnsNode; children: ChildrenArg }) {
  const count = def.count ?? 2
  return (
    <div
      className="layout-columns"
      style={{
        display:             'grid',
        gridTemplateColumns: `repeat(${count}, 1fr)`,
        gap:                 def.gap ?? 'var(--spacing-md)',
      }}
    >
      {children.defs.map((d, i) => (
        <div
          key={i}
          style={{
            gridColumn: d.layout?.colSpan ? `span ${d.layout.colSpan}` : undefined,
            alignSelf:  d.layout?.align ?? undefined,
          }}
        >
          {children.rendered[i]}
        </div>
      ))}
    </div>
  )
}


// ═══════════════════════════════════════════════════════════════════════════
// StackShell — plugins/nodes/layout/stack/StackShell.tsx
// ═══════════════════════════════════════════════════════════════════════════

export const StackShell: NodeRenderer<StackNode> =
  (def, _ctx, children) => <StackControl def={def} children={children} />

function StackControl({ def, children }: { def: StackNode; children: ChildrenArg }) {
  return (
    <div
      className="layout-stack"
      style={{
        display:        'flex',
        flexDirection:  def.direction ?? 'column',
        gap:            def.gap       ?? 'var(--spacing-md)',
        flexWrap:       def.wrap      ? 'wrap' : 'nowrap',
      }}
    >
      {children.defs.map((d, i) => (
        <div
          key={i}
          style={{
            order:     d.layout?.order ?? undefined,
            alignSelf: d.layout?.align ?? undefined,
          }}
        >
          {children.rendered[i]}
        </div>
      ))}
    </div>
  )
}


// ═══════════════════════════════════════════════════════════════════════════
// CardShell — plugins/nodes/layout/card/CardShell.tsx
// ═══════════════════════════════════════════════════════════════════════════

export const CardShell: NodeRenderer<CardNode> =
  (def, _ctx, children) => (
    <div className="layout-card">
      {children.rendered}
    </div>
  )

// CardShell.css (token-driven, zero hardcoded values):
//   .layout-card {
//     background:    var(--color-surface);
//     border:        1px solid var(--color-border);
//     border-radius: var(--radius-md);
//     padding:       var(--spacing-md);
//   }
// Geostat:  --color-surface = #FFFFFF → white card
// ENstat:   --color-surface = #F8F9FA → light grey card
// ArmStat:  same plugin, different token value, zero code change ✅


// ═══════════════════════════════════════════════════════════════════════════
// META slices — plugins/nodes/layout/{type}/index.ts
// ═══════════════════════════════════════════════════════════════════════════

export const GRID_META: NodeSliceMeta = {
  type:     'grid',
  variant:  'default',
  label:    'გრიდი',
  icon:     'layout-grid',
  category: 'layout',
  schema: {
    type: 'object',
    properties: {
      columns: { type: 'number', default: 12, description: 'სვეტების რაოდენობა' },
      gap:     { type: 'string', default: 'var(--spacing-md)', description: 'მანძილი' },
    }
  },
  preview: '/previews/layout-grid.png',
}

export const COLUMNS_META: NodeSliceMeta = {
  type:     'columns',
  variant:  'default',
  label:    'სვეტები',
  icon:     'layout-columns',
  category: 'layout',
  schema: {
    type: 'object',
    properties: {
      count: { type: 'number', default: 2 },
      gap:   { type: 'string', default: 'var(--spacing-md)' },
    }
  },
  preview: '/previews/layout-columns.png',
}

export const STACK_META: NodeSliceMeta = {
  type:     'stack',
  variant:  'default',
  label:    'სტეკი',
  icon:     'layout-stack',
  category: 'layout',
  schema: {
    type: 'object',
    properties: {
      direction: { type: 'string', enum: ['column', 'row'], default: 'column' },
      gap:        { type: 'string', default: 'var(--spacing-md)' },
      wrap:       { type: 'boolean', default: false },
    }
  },
  preview: '/previews/layout-stack.png',
}

export const CARD_META: NodeSliceMeta = {
  type:     'card',
  variant:  'default',
  label:    'კარტა',
  icon:     'layout-card',
  category: 'layout',
  schema:   { type: 'object', properties: {} },
  preview:  '/previews/layout-card.png',
}

// META is JSON-serializable: JSON.parse(JSON.stringify(META)) === META ✅
// Constructor palette reads category:'layout' → groups grid/columns/stack/card together


// ═══════════════════════════════════════════════════════════════════════════
// DividerShell — plugins/nodes/layout/divider/DividerShell.tsx
// ═══════════════════════════════════════════════════════════════════════════

export const DividerShell: NodeRenderer<DividerNode> =
  (def, _ctx, _children) => (
    <hr
      className={`layout-divider layout-divider--${def.variant ?? 'solid'}`}
      aria-hidden="true"
    />
    // .layout-divider--solid     { border-top: 1px solid var(--color-border); margin: 0 }
    // .layout-divider--dashed    { border-top: 1px dashed var(--color-border); margin: 0 }
    // .layout-divider--invisible { border: none; display: block; margin: 0 }
  )

export const DIVIDER_META: NodeSliceMeta = {
  type:     'divider',
  variant:  'default',
  label:    'გამყოფი',
  icon:     'minus',
  category: 'layout',
  schema: {
    type: 'object',
    properties: {
      variant: { type: 'string', enum: ['solid', 'dashed', 'invisible'], default: 'solid' },
    }
  },
  preview: '/previews/layout-divider.png',
}


// ═══════════════════════════════════════════════════════════════════════════
// SpacerShell — plugins/nodes/layout/spacer/SpacerShell.tsx
// ═══════════════════════════════════════════════════════════════════════════

export const SpacerShell: NodeRenderer<SpacerNode> =
  (def, _ctx, _children) => (
    <div
      className="layout-spacer"
      style={{ height: def.size ?? 'var(--spacing-xl)' }}
      aria-hidden="true"
    />
  )

export const SPACER_META: NodeSliceMeta = {
  type:     'spacer',
  variant:  'default',
  label:    'სივრცე',
  icon:     'move-vertical',
  category: 'layout',
  schema: {
    type: 'object',
    properties: {
      size: { type: 'string', default: 'var(--spacing-xl)', description: 'სიმაღლე (CSS ან token)' },
    }
  },
  preview: '/previews/layout-spacer.png',
}


// ═══════════════════════════════════════════════════════════════════════════
// Constructor builds diverse layouts — same palette, different JSON
// ═══════════════════════════════════════════════════════════════════════════

// ── Layout A — default vertical (no layout nodes needed) ────────────────
// Standard statistical page: filter → KPI → sections (ONS/Eurostat IA)
const layoutA_verticalPage: NodeDef = {
  type:     'inner-page',
  id:       'gdp',
  title:    'მთლიანი შიდა პროდუქტი',
  storeKey: 'gdp',
  children: [
    {
      type: 'filter-bar',
      bars: { main: { position: 'sticky', filters: {
        time: { type: 'year-select', defaultValue: 2024 },
      }}}
    },
    {
      type: 'kpi-strip',
      data: { type: 'row-list', indicators: ['B1G', 'D1', 'B2G', 'P51G'] },
    },
    {
      type: 'section',
      data: { type: 'timeseries', indicator: 'B1G' },
      view: { subtitle: 'მლნ ₾', exportable: true },
      children: [
        { type: 'chart', layout: { role: 'chart', label: 'გრაფიკი' } },
        { type: 'table', layout: { role: 'table', label: 'ცხრილი'  } },
      ]
    },
    {
      type: 'section',
      data: { type: 'timeseries', indicator: 'D1' },
      view: { subtitle: 'მლნ ₾', exportable: true, noCollapse: false },
      children: [
        { type: 'chart', layout: { role: 'chart' } },
        { type: 'table', layout: { role: 'table' } },
      ]
    },
  ]
} as NodeDef

// ── Layout B — 2-column (layout node: columns) ───────────────────────────
// Two related indicators side by side — Constructor uses 'columns' node
const layoutB_twoColumnPage: NodeDef = {
  type:     'inner-page',
  id:       'gdp-comparison',
  title:    'GDP შედარება',
  storeKey: 'gdp',
  children: [
    {
      type: 'filter-bar',
      bars: { main: { position: 'sticky', filters: {
        time: { type: 'year-select', defaultValue: 2024 },
      }}}
    },
    {
      type: 'kpi-strip',
      data: { type: 'row-list', indicators: ['B1G', 'D1', 'B2G', 'P51G'] },
    },
    // 2-column layout — Constructor drags 'columns' from layout palette:
    {
      type:  'columns',
      count: 2,
      children: [
        {
          type:   'section',
          layout: { colSpan: 1 },
          data:   { type: 'timeseries', indicator: 'B1G' },
          view:   { subtitle: 'GDP' },
          children: [{ type: 'chart', layout: { role: 'chart' } }],
        },
        {
          type:   'section',
          layout: { colSpan: 1 },
          data:   { type: 'timeseries', indicator: 'D1' },
          view:   { subtitle: 'შრომის ანაზღ.' },
          children: [{ type: 'chart', layout: { role: 'chart' } }],
        },
      ]
    },
  ]
} as NodeDef

// ── Layout C — hero + sidebar (landing page) ─────────────────────────────
// Landing page: hero left + KPI cards right
const layoutC_heroWithSidebar: NodeDef = {
  type:    'container-page',
  variant: 'landing',
  id:      'landing',
  children: [
    // stack row: hero (wide) + card column (narrow)
    {
      type:      'stack',
      direction: 'row',
      gap:       'var(--spacing-lg)',
      children: [
        // Hero — takes 8 of 12 grid units
        {
          type:   'landing-hero',
          layout: { colSpan: 8 },
          view:   { subtitle: 'საქართველოს ეროვნული სტატისტიკა' },
        },
        // Sidebar — takes 4 of 12 grid units, stacked KPI cards
        {
          type:      'stack',
          direction: 'column',
          layout:    { colSpan: 4 },
          children: [
            { type: 'card', children: [
              { type: 'kpi-strip', data: { type: 'row-list', indicators: ['B1G'] } }
            ]},
            { type: 'card', children: [
              { type: 'kpi-strip', data: { type: 'row-list', indicators: ['P3'] } }
            ]},
            { type: 'card', children: [
              { type: 'kpi-strip', data: { type: 'row-list', indicators: ['D1'] } }
            ]},
          ],
        },
      ],
    },
    // Landing stats section below
    {
      type: 'landing-stats',
      data: { type: 'row-list', indicators: ['B1G', 'P3', 'D1', 'P51G'] },
    },
  ]
} as NodeDef

// ── Layout D — grid with mixed spans ─────────────────────────────────────
// Dashboard-style: KPI full-width, two charts, one wide table
const layoutD_dashboardGrid: NodeDef = {
  type:     'inner-page',
  id:       'dashboard',
  title:    'დეშბორდი',
  storeKey: 'gdp',
  children: [
    {
      type: 'filter-bar',
      bars: { main: { position: 'sticky', filters: {
        time: { type: 'year-select', defaultValue: 2024 },
        geo:  { type: 'cascade',
                options: { type: 'query', data: { type: 'query', storeId: 'geo-store', indicator: 'GEO_LIST' }, valueField: 'code', labelField: 'label' } },
      }}}
    },
    // 12-column grid — different spans per child:
    {
      type:    'grid',
      columns: 12,
      children: [
        // KPI strip — full width (12)
        {
          type:   'kpi-strip',
          layout: { colSpan: 12 },
          data:   { type: 'row-list', indicators: ['B1G', 'D1', 'B2G', 'P51G'] },
        },
        // Two charts — half width each (6)
        {
          type:   'section',
          layout: { colSpan: 6 },
          data:   { type: 'timeseries', indicator: 'B1G' },
          children: [{ type: 'chart', layout: { role: 'chart' } }],
        },
        {
          type:   'section',
          layout: { colSpan: 6 },
          data:   { type: 'timeseries', indicator: 'D1' },
          children: [{ type: 'chart', layout: { role: 'chart' } }],
        },
        // Wide table — full width (12)
        {
          type:   'section',
          layout: { colSpan: 12 },
          data:   { type: 'pivot', indicator: 'B1G' },
          children: [{ type: 'table', layout: { role: 'table' } }],
        },
      ]
    },
  ]
} as NodeDef

// All layouts: JSON.parse(JSON.stringify(config)) === config ✅
// All layouts: same plugins/, same code, different JSON tree ✅
// Constructor builds all from same palette — zero code, zero deploy ✅


// ═══════════════════════════════════════════════════════════════════════════
// setupRegistrations.ts — how layout nodes get registered
// ═══════════════════════════════════════════════════════════════════════════

// plugins/nodes/layout/index.ts barrel (DISCOVERABILITY):
//   export * as grid    from './grid'
//   export * as columns from './columns'
//   export * as stack   from './stack'
//   export * as card    from './card'

// plugins/nodes/index.ts barrel — ONE line added:
//   export * as layout from './layout'

// setupRegistrations.ts — ZERO changes needed:
//   import * as Nodes from '../plugins/nodes'
//   Object.values(Nodes).forEach(registerSlice)
//   ← layout nodes discovered automatically via barrel ✅

// Constructor palette after registration:
//   nodeRegistry.list()
//   → [
//     { type:'grid',    variant:'default', category:'layout', label:'გრიდი',   ... },
//     { type:'columns', variant:'default', category:'layout', label:'სვეტები', ... },
//     { type:'stack',   variant:'default', category:'layout', label:'სტეკი',   ... },
//     { type:'card',    variant:'default', category:'layout', label:'კარტა',   ... },
//     { type:'section', variant:'default', category:'data',   label:'სექცია',  ... },
//     ...
//   ]
// Constructor groups by category → 'layout' tab in palette ✅


// ═══════════════════════════════════════════════════════════════════════════
// Anti-patterns
// ═══════════════════════════════════════════════════════════════════════════

// ❌ Hardcoded colors in layout shell:
//    function GridShell(...) {
//      return <div style={{ background: '#005A9C' }}>  ← org color hardcoded
//    }
// ✅ CSS tokens only:
//    function GridShell(...) {
//      return <div style={{ gap: 'var(--spacing-md)' }}>

// ❌ IA order enforced in platform code:
//    // renderNode.ts:
//    if (node.type === 'filter-bar') renderFirst()  ← platform dictates order
// ✅ IA order = JSON children order. Constructor templates enforce convention.
//    Platform renders in whatever order JSON specifies.

// ❌ Layout in page shell instead of layout node:
//    function InnerPageShell(def, ctx, children) {
//      return <div style={{ display:'grid', gridTemplateColumns:'8fr 4fr' }}>
//        {children.rendered}   ← fixed layout! Constructor has no control.
//      </div>
//    }
// ✅ InnerPageShell renders children in default flow.
//    Constructor adds <grid> or <columns> node when spatial arrangement needed.

// ❌ Separate "layout system" outside node registry:
//    const layoutRegistry = new LayoutRegistry()
//    layoutRegistry.register('two-column', TwoColumnLayout)
//    ← separate registry = two sources of truth, Constructor sees only one
// ✅ Layout nodes = same nodeRegistry, same Constructor palette, same renderNode().

// ❌ Closed layout type union:
//    type LayoutType = 'grid' | 'columns' | 'stack'  ← Constructor can't extend
// ✅ type: string on NodeBase — any registered type works.

// declare for type-checking:
declare const React: { createElement: Function }
```
