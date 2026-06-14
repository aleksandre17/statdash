# data-nodes.ts

> Reference example (TypeScript) — documentation, not compiled source.

```ts
/**
 * Example — Data Nodes: ChartNode and TableNode Independence
 *
 * Core insight: every visualization should be self-contained (Grafana/Superset/Metabase standard).
 *   Chart = data + rendering. Table = data + column config. Section = chrome only.
 *
 * Inheritance rule (engine):
 *   node.data present → resolve own DataSpec → own ctx.rows
 *   node.data absent  → inherit parent's ctx.rows
 *
 * ISP:
 *   ChartNode   has: data?, def?        — no section chrome, no table columns
 *   TableNode   has: data?, columns?    — no section chrome, no chart def
 *   SectionNode has: data?, view?, children — no chart/table specific fields
 *
 * Platform precedents:
 *   Grafana:   panel.targets[]  — each panel has own data query. Panels → rows (layout only).
 *   Superset:  chart.datasource — each chart self-contained. Dashboard = grid of charts.
 *   Metabase:  question = datasource + query + viz type. Dashboard = grid of questions.
 *   Retool:    component.query — per-component data binding. No "section" concept.
 */

import type {
  NodeBase, NodeDef, NodeRenderer, RenderContext,
  DataSpec, DataRow, ChartDef, ColumnDef,
  ChildrenArg,
} from '@geostat/react'


// ═══════════════════════════════════════════════════════════════════════════
// Types — updated ChartNode and TableNode
// module augmentation: plugins/nodes/chart/types.ts  +  plugins/nodes/table/types.ts
// ═══════════════════════════════════════════════════════════════════════════

declare module '@geostat/react' {
  interface NodeTypeMap {
    'chart': ChartNode
    'table': TableNode
  }
}

export interface ChartNode extends NodeBase {
  type:  'chart'
  data?: DataSpec   // own data — absent = inherit ctx.rows from parent
  def?:  ChartDef   // chart encoding (mark, encoding, axes, title)
  // ISP: no view, no children, no columns — only chart concerns
}

export interface TableNode extends NodeBase {
  type:     'table'
  data?:    DataSpec      // own data — absent = inherit ctx.rows from parent
  columns?: ColumnDef[]   // absent = infer from row keys
  // ISP: no view, no children, no def — only table concerns
}

// JSON.parse(JSON.stringify(node)) === node ✅ — all fields are JSON primitives


// ═══════════════════════════════════════════════════════════════════════════
// Engine — data resolution
// engine/react/src/engine/renderNode.ts  (one new pure function)
// ═══════════════════════════════════════════════════════════════════════════

// Called before shell invocation. Engine always populates ctx.rows.
// Shell never needs to check for empty rows or call interpretSpec.
export function resolveNodeRows(
  node: NodeBase,
  parentCtx: RenderContext,
): DataRow[] {
  if (!node.data) return parentCtx.rows
  return interpretSpec(node.data, parentCtx.sectionCtx, parentCtx.stores)
}

// Engine renderNode step (simplified):
//   const rows = resolveNodeRows(node, ctx)
//   const nodeCtx = { ...ctx, rows }
//   const shell = nodeRegistry.get(node.type)
//   return shell(node, nodeCtx, children)

// interpretSpec is already the resolution layer — no new abstraction. One line added.
declare function interpretSpec(
  spec:   DataSpec,
  ctx:    import('@geostat/engine').SectionContext,
  stores: Record<string, import('@geostat/engine').DataStore>,
): DataRow[]


// ═══════════════════════════════════════════════════════════════════════════
// ChartShell — plugins/nodes/chart/ChartShell.tsx
// Zero change: engine provides ctx.rows regardless of source.
// ═══════════════════════════════════════════════════════════════════════════

export const ChartShell: NodeRenderer<ChartNode> =
  (def, ctx, _children) => <ChartControl def={def} ctx={ctx} />

function ChartControl({ def, ctx }: { def: ChartNode; ctx: RenderContext }) {
  // ctx.rows is always resolved — engine handled data vs inheritance
  // def.def? = chart encoding. Absent = default bar chart.
  // def.layout?.role, def.layout?.label — read by parent shell (SectionShell or GridShell)
  // ChartShell never reads parent type — parent-blind ✅
  return (
    <div className="chart-container">
      {/* toApexOptions(def.def, ctx.rows) → ReactApexChart */}
      {/* zero change from current implementation */}
    </div>
  )
}


// ═══════════════════════════════════════════════════════════════════════════
// TableShell — plugins/nodes/table/TableShell.tsx
// Zero change: engine provides ctx.rows regardless of source.
// ═══════════════════════════════════════════════════════════════════════════

export const TableShell: NodeRenderer<TableNode> =
  (def, ctx, _children) => <TableControl def={def} ctx={ctx} />

function TableControl({ def, ctx }: { def: TableNode; ctx: RenderContext }) {
  // ctx.rows always populated. def.columns? = explicit columns; absent = infer.
  return (
    <div className="table-container">
      {/* DataTable columns derived from def.columns ?? inferColumns(ctx.rows) */}
    </div>
  )
}


// ═══════════════════════════════════════════════════════════════════════════
// Usage Patterns — five configs, all JSON-serializable
// ═══════════════════════════════════════════════════════════════════════════

// ── Pattern A: section owns data, children inherit (unchanged — backward compat) ──
// GDP timeseries — section provides data, chart and table inherit.
// Identical to today's pattern. Zero config change.
const patternA_sectionOwnsData: NodeDef = {
  type:   'section',
  layout: { position: 'flow', order: 3, span: 'full' },
  data: {
    type:      'timeseries',
    indicator: 'B1G',
    dims:      { geo: { $ctx: 'geo' }, time: { $ctx: 'time' } },
  },
  view: { subtitle: 'მლნ ₾ · SNA 2008', exportable: true },
  children: [
    { type: 'chart', layout: { role: 'chart', label: 'გრაფიკი' } },  // inherits B1G rows
    { type: 'table', layout: { role: 'table', label: 'ცხრილი'  } },  // inherits B1G rows
  ],
} as NodeDef


// ── Pattern B: standalone chart, no section parent ──
// Grafana equivalent: panel with own target query, placed directly in grid row.
const patternB_standaloneChart: NodeDef = {
  type:    'grid',
  columns: 12,
  children: [
    {
      type:   'chart',
      layout: { colSpan: 6 },
      data: {
        type:      'timeseries',
        indicator: 'B1G',
        dims:      { geo: { $ctx: 'geo' }, time: { $ctx: 'time' } },
      },
      def: { mark: 'line', title: 'GDP', encoding: { x: { field: 'time' }, y: { field: 'value' } } },
    },
    {
      type:   'chart',
      layout: { colSpan: 6 },
      data: {
        type:      'timeseries',
        indicator: 'D1',
        dims:      { geo: { $ctx: 'geo' }, time: { $ctx: 'time' } },
      },
      def: { mark: 'bar', title: 'შრომის ანაზღ.', encoding: { x: { field: 'time' }, y: { field: 'value' } } },
    },
  ],
} as NodeDef


// ── Pattern C: section = chrome only; chart and table each override data ──
// Chart shows growth rate, table shows raw values — different DataSpecs, same section chrome.
const patternC_chromeWithDataOverride: NodeDef = {
  type:   'section',
  layout: { position: 'flow', order: 4, span: 'full' },
  // no data on section — pure chrome (title, collapse, export, toggle)
  view: { subtitle: 'GDP ზრდის ტემპი · %', exportable: true },
  children: [
    {
      type:   'chart',
      layout: { role: 'chart', label: 'ზრდის ტემპი' },
      data:   { type: 'growth', indicator: 'B1G', dims: { geo: { $ctx: 'geo' } } },
      def:    { mark: 'line', encoding: { x: { field: 'time' }, y: { field: 'value' } } },
    },
    {
      type:   'table',
      layout: { role: 'table', label: 'ნედლი მონაცემი' },
      data:   { type: 'timeseries', indicator: 'B1G', dims: { geo: { $ctx: 'geo' } } },
    },
  ],
} as NodeDef


// ── Pattern D: dashboard grid — all independent (Grafana row pattern) ──
// No section nodes. Charts and table placed directly in grid. Filter provides dims.
const patternD_dashboardGrid: NodeDef = {
  type:     'inner-page',
  id:       'dashboard',
  title:    'მაკრო დეშბორდი',
  storeKey: 'gdp',
  children: [
    {
      type:   'filter-bar',
      layout: { position: 'sticky-top', order: 1 },
      bars: {
        main: {
          position: 'sticky',
          order:    1,
          filters: {
            time: { type: 'year-select', defaultValue: 2024 },
            geo:  { type: 'cascade', options: { type: 'query', data: { type: 'query', indicator: 'GEO_LIST' }, valueField: 'code', labelField: 'label' } },
          },
        },
      },
    },
    // 12-column grid — charts and table placed directly, no section wrappers:
    {
      type:    'grid',
      columns: 12,
      children: [
        {
          type:   'chart', layout: { colSpan: 4 },
          data:   { type: 'timeseries', indicator: 'B1G', dims: { geo: { $ctx: 'geo' } } },
          def:    { mark: 'line', title: 'GDP · მლნ ₾' },
        },
        {
          type:   'chart', layout: { colSpan: 4 },
          data:   { type: 'growth', indicator: 'B1G', dims: { geo: { $ctx: 'geo' } } },
          def:    { mark: 'line', title: 'GDP ზრდა · %' },
        },
        {
          type:   'chart', layout: { colSpan: 4 },
          data:   { type: 'timeseries', indicator: 'D1', dims: { geo: { $ctx: 'geo' } } },
          def:    { mark: 'bar', title: 'შრომის ანაზღ.' },
        },
        {
          type:   'table', layout: { colSpan: 12 },
          data: {
            type:      'pivot',
            indicator: 'B1G',
            rows:      'time',
            cols:      'sector',
            dims:      { geo: { $ctx: 'geo' } },
          },
          columns: [
            { key: 'time',   label: 'წელი'          },
            { key: 'sector', label: 'სექტორი'       },
            { key: 'value',  label: 'GDP · მლნ ₾', format: 'number' },
          ],
        },
      ],
    },
  ],
} as NodeDef


// ── Pattern E: mixed — sections with chrome + standalone charts ──
// Standard statistical section for important indicator; quick charts below without chrome.
const patternE_mixed: NodeDef = {
  type:     'inner-page',
  id:       'accounts',
  title:    'ეროვნული ანგარიშები',
  storeKey: 'accounts',
  children: [
    {
      type:   'filter-bar',
      layout: { position: 'sticky-top', order: 1 },
      bars: { main: { position: 'sticky', order: 1, filters: {
        time: { type: 'year-select', defaultValue: 2024 },
      }}},
    },
    // Featured indicator — full chrome (collapse, export, chart/table toggle):
    {
      type:   'section',
      layout: { order: 2, span: 'full' },
      data:   { type: 'timeseries', indicator: 'B1G', dims: { time: { $ctx: 'time' } } },
      view:   { subtitle: 'GDP · მლნ ₾', exportable: true },
      children: [
        { type: 'chart', layout: { role: 'chart', label: 'გრაფიკი' } },
        { type: 'table', layout: { role: 'table', label: 'ცხრილი'  } },
      ],
    },
    // Quick summary charts — no chrome, placed in columns:
    {
      type:  'columns', count: 3,
      children: [
        {
          type:   'chart',
          data:   { type: 'timeseries', indicator: 'D1',   dims: { time: { $ctx: 'time' } } },
          def:    { mark: 'bar',  title: 'შრომის ანაზღ.'  },
        },
        {
          type:   'chart',
          data:   { type: 'timeseries', indicator: 'B2G',  dims: { time: { $ctx: 'time' } } },
          def:    { mark: 'bar',  title: 'საოპ. ჭარბი'    },
        },
        {
          type:   'chart',
          data:   { type: 'timeseries', indicator: 'P51G', dims: { time: { $ctx: 'time' } } },
          def:    { mark: 'line', title: 'კაპ. ინვ.'       },
        },
      ],
    },
  ],
} as NodeDef


// ═══════════════════════════════════════════════════════════════════════════
// Anti-patterns
// ═══════════════════════════════════════════════════════════════════════════

// ❌ Section forced as wrapper even when no chrome is needed:
//    { type: 'section', data: {...}, view: {}, children: [
//      { type: 'chart' }   // only one child, no toggle needed — section adds zero value
//    ]}
// ✅ Standalone chart directly:
//    { type: 'chart', data: {...}, def: {...} }

// ❌ Chart fetching data independently (bypassing interpretSpec):
//    function ChartShell(def, ctx) {
//      const { data } = useSWR(def.url, fetcher)  // ← bypasses DataStore, no caching strategy
//    }
// ✅ Data stays in DataSpec. interpretSpec resolves. Engine injects into ctx.rows.

// ❌ Section with data AND children with data (double resolution, wasted work):
//    { type: 'section', data: { type: 'timeseries', ... },  // resolved → discarded
//      children: [{ type: 'chart', data: { type: 'timeseries', ... } }]  // own resolution
//    }
// ✅ Either section owns data (children inherit) OR children own data (section = chrome only).

// ❌ Table inside section just to get collapse/export chrome:
//    { type: 'section', view: { exportable: true },
//      children: [{ type: 'table', layout: { role: 'table' } }]  // no chart, no toggle
//    }
//    (using SectionNode only for its chrome is fine! that is Pattern C above)
// ✅ Pattern C is valid — section as chrome-only container is a legitimate use.

// All configs: JSON.parse(JSON.stringify(config)) === config ✅
// Constructor builds all patterns from palette — zero code, zero deploy ✅

declare const React: { createElement: Function }
```
