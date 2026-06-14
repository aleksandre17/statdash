# Data Nodes — ChartNode and TableNode Independence

> Grafana / Superset / Metabase standard: every visualization is self-contained.
> Today our chart and table nodes are section-dependent empty shells. This fixes that.

---

## Platform precedent

| Platform  | Self-contained unit | Own data query? | Section concept? |
|-----------|--------------------|-----------------|--------------------|
| Grafana   | Panel              | ✅ `targets[]`  | Row = layout only  |
| Superset  | Chart              | ✅ datasource + metrics | Dashboard = grid |
| Metabase  | Question           | ✅ datasource + query | Dashboard = grid |
| Retool    | Component          | ✅ per-component query binding | Layout container |
| Builder.io| Block              | ✅ per-block API binding | Section = layout |

**Universal rule across all platforms:** visualization = data + rendering. Layout container is separate concern.

---

## Current state — the problem

```ts
// Section is the data owner. Chart and table are completely blind.
{ type: 'section',
  data: { type: 'timeseries', indicator: 'B1G' },   // section owns data
  children: [
    { type: 'chart' },   // ← no own data. useless without section parent.
    { type: 'table' },   // ← no own data. useless without section parent.
  ]
}
```

Consequences:
- Chart cannot exist outside a section.
- Table cannot exist outside a section.
- Dashboard grid of independent charts = impossible (every chart needs a section wrapper).
- ISP violation: SectionNode carries rendering concerns (collapse, export) AND data concerns.

---

## Solution — data inheritance with override

```
Node.data present  → engine resolves its own DataSpec → own ctx.rows
Node.data absent   → engine inherits parent's ctx.rows
```

Both patterns work. Backward compatibility: all existing configs (section owns data, children inherit) continue unchanged.

---

## Updated type definitions

```ts
interface ChartNode extends NodeBase {
  type:  'chart'
  data?: DataSpec    // own data — absent = inherit parent rows
  def?:  ChartDef    // chart encoding (mark, encoding, axes)
  // No section chrome (title, collapse, export) — ISP: only chart concerns
}

interface TableNode extends NodeBase {
  type:     'table'
  data?:    DataSpec      // own data — absent = inherit parent rows
  columns?: ColumnDef[]   // explicit columns — absent = infer from row keys
  // No section chrome — ISP: only table concerns
}

interface SectionNode extends NodeBase {
  type:     'section'
  data?:    DataSpec    // optional — children may supply their own
  view?:    ViewParams  // chrome: title, subtitle, exportable, collapse
  children: NodeDef[]
  // No chart-specific or table-specific fields — ISP: pure chrome + data container
}
```

**ISP — each node has only what it needs:**

| Node    | data? | def? | columns? | view? | children? |
|---------|-------|------|----------|-------|-----------|
| Section | ✅    | ❌   | ❌       | ✅    | ✅        |
| Chart   | ✅    | ✅   | ❌       | ❌    | ❌        |
| Table   | ✅    | ❌   | ✅       | ❌    | ❌        |

---

## Engine — data resolution (engine/react/src/engine/renderNode.ts)

```ts
function resolveNodeRows(node: NodeBase, parentCtx: RenderContext): DataRow[] {
  if (!node.data) return parentCtx.rows           // inherit
  return interpretSpec(node.data, parentCtx.sectionCtx, parentCtx.stores)
}
```

Called during `renderNode()` before invoking the shell. `ctx.rows` is always populated — shell never needs to check.

---

## Usage patterns

### Pattern A — section owns data, children inherit (unchanged — backward compat)

```ts
{ type: 'section',
  data: { type: 'timeseries', indicator: 'B1G' },
  view: { subtitle: 'მლნ ₾', exportable: true },
  children: [
    { type: 'chart', layout: { role: 'chart' } },   // inherits B1G timeseries rows
    { type: 'table', layout: { role: 'table' } },   // inherits B1G timeseries rows
  ]
}
```

Identical to today. Zero config change needed.

---

### Pattern B — standalone chart (no section parent)

```ts
// Chart placed directly in grid — no section, no wrapper:
{ type: 'grid', columns: 12, children: [
  {
    type:   'chart',
    layout: { colSpan: 6 },
    data:   { type: 'timeseries', indicator: 'B1G' },   // own data
    def:    { mark: 'line', encoding: { x: 'time', y: 'value' } },
  },
  {
    type:   'chart',
    layout: { colSpan: 6 },
    data:   { type: 'timeseries', indicator: 'D1' },    // different data, same layout
    def:    { mark: 'bar',  encoding: { x: 'time', y: 'value' } },
  },
] }
// Grafana equivalent: two panels in a row, each with own target query.
```

---

### Pattern C — section provides chrome, chart overrides data

```ts
// Section = chrome only (title, collapse, export). Chart = own data.
{ type: 'section',
  // no data on section — it's chrome only
  view: { subtitle: 'GDP ზრდის ტემპი · %' , exportable: true },
  children: [
    {
      type:   'chart',
      layout: { role: 'chart' },
      data:   { type: 'growth', indicator: 'B1G' },   // chart overrides
      def:    { mark: 'line' },
    },
    {
      type:   'table',
      layout: { role: 'table' },
      data:   { type: 'timeseries', indicator: 'B1G' }, // table has different data from chart
    },
  ]
}
// Chart shows growth rate, table shows raw values — same section chrome.
```

---

### Pattern D — dashboard grid of independent charts (Grafana row pattern)

```ts
{ type: 'inner-page', id: 'dashboard', title: 'დეშბორდი', children: [
  { type: 'filter-bar', bars: { main: { position: 'sticky', filters: {
    time: { type: 'year-select', defaultValue: 2024 },
    geo:  { type: 'cascade', optionsQuery: { type: 'query', indicator: 'GEO_LIST' } },
  }}}},

  // 12-column grid — charts placed directly, no section wrappers:
  { type: 'grid', columns: 12, children: [
    {
      type:   'chart', layout: { colSpan: 4 },
      data:   { type: 'timeseries', indicator: 'B1G' },
      def:    { mark: 'line', title: 'GDP' },
    },
    {
      type:   'chart', layout: { colSpan: 4 },
      data:   { type: 'timeseries', indicator: 'D1' },
      def:    { mark: 'bar', title: 'შრომის ანაზღ.' },
    },
    {
      type:   'chart', layout: { colSpan: 4 },
      data:   { type: 'growth', indicator: 'B1G' },
      def:    { mark: 'line', title: 'ზრდის ტემპი' },
    },
    // Full-width table — own data, no section:
    {
      type:   'table', layout: { colSpan: 12 },
      data:   { type: 'pivot', indicator: 'B1G', rows: 'time', cols: 'sector' },
      columns: [
        { key: 'time',   label: 'წელი' },
        { key: 'sector', label: 'სექტორი' },
        { key: 'value',  label: 'მნიშვნელობა', format: 'number' },
      ]
    },
  ]},
] }
// Zero section nodes. Same result as Grafana dashboard.
```

---

### Pattern E — mixed (some sections, some standalone)

```ts
{ type: 'inner-page', children: [
  // Section with chrome (collapse, export):
  { type: 'section',
    data:     { type: 'timeseries', indicator: 'B1G' },
    view:     { subtitle: 'GDP · მლნ ₾', exportable: true },
    children: [
      { type: 'chart', layout: { role: 'chart' } },
      { type: 'table', layout: { role: 'table' } },
    ]
  },
  // Standalone chart (no chrome needed):
  { type: 'chart',
    data: { type: 'growth', indicator: 'B1G' },
    def:  { mark: 'line', title: 'ზრდის ტემპი' },
  },
] }
```

---

## SectionNode — pure chrome when data absent

When a section has no `data`, it provides:
- Collapsible container (if `view.noCollapse !== true`)
- Title / subtitle rendering
- Export button (if `view.exportable: true`)
- Role-based toggle (chart ↔ table tab) over children

Data resolution is delegated entirely to children.

Engine rule: `section.data absent → section resolves no rows → children each resolve own`.

---

## Constructor implications

- Constructor palette: chart block drops into a grid directly. No section wrapping required.
- Constructor schema: `ChartNode.data` and `TableNode.data` are editable via data binding UI.
- Existing sections: fully backward compatible. No migration required.

---

## Change list — exact files

```
engine/react/src/engine/renderNode.ts
  resolveNodeRows(node, parentCtx) → DataRow[]        ← NEW
  call before shell invocation — always populates ctx.rows

engine/core/src/config/node.ts (or types.ts)
  ChartNode  += data?: DataSpec                        ← CHANGE
  TableNode  += data?: DataSpec                        ← CHANGE
  SectionNode data?: DataSpec (already exists)         ← NO CHANGE

plugins/nodes/chart/ChartShell.tsx
  remove: reads ctx.rows (already works — engine provides)  ← NO CHANGE
  zero shell changes needed — engine handles resolution

plugins/nodes/table/TableShell.tsx
  same — zero shell changes                            ← NO CHANGE
```

Shell code is unchanged. Engine adds one pure function. Types get one optional field each.

---

## Code reference

```
docs/architecture/examples/data-nodes.md  ← complete implementation
```