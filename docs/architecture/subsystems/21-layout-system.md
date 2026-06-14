# Layout System — v2

> Supersedes `09-layout-system.md`. All prior content transferred + platform comparison + new primitives.
>
> Layout IS the node tree (Agreement #13).
> CSS first — JS handles composition, CSS handles all visual positioning.
> Parent blind. Open registry. Token-driven. Constructor-controllable.

---

## Platform comparison

| Feature                      | Grafana           | Builder.io        | Webflow          | Framer           | **Ours**         |
|------------------------------|-------------------|-------------------|------------------|------------------|------------------|
| Layout unit                  | Row (panel grid)  | Section/Box/Columns | Section/Container/Grid | Frame/Stack | grid/columns/stack/card |
| Registry                     | Open (panel types) | Open (components) | Closed (Webflow primitives) | Open (components) | ✅ Open nodeRegistry |
| CSS tokens                   | Theme variables   | Design tokens     | Design system    | Variables        | ✅ CSS custom props |
| Parent-blind children        | ✅ panels blind to row | ✅ blocks blind to container | ❌ some coupling | ✅ | ✅ |
| Layout in config             | ✅ JSON pos       | ✅ JSON props     | ✅ visual editor → JSON | ✅ JSON | ✅ JSON NodeDef |
| Responsive                   | ✅ breakpoints    | ✅ breakpoints    | ✅ breakpoints   | ✅ responsive     | ⚠️ via CSS only (gap) |
| Constructor controllable     | ✅ drag panels    | ✅ drag blocks    | ✅ visual editor | ✅ canvas editor  | ✅ JSON palette |

**Our gaps vs Grafana/Builder.io:**
- Responsive breakpoints: no `responsive?: { sm: LayoutHints, md: LayoutHints }` — CSS-only solution for now
- `minWidth` / `maxWidth` per child: not on LayoutHints — use CSS token gap + auto columns instead

**Our strengths:**
- Same open registry for layout AND content nodes (Grafana uses separate panel/row systems)
- CSS token isolation: `--spacing-*`, `--color-*`, `--radius-*` — multi-site zero-code theming
- Constructor palette shows layout nodes grouped by category — discoverable without documentation

---

## Core principle — CSS first

```
JS:  data fetching · visibility (evalExpr) · composition (children[]) · event handlers
CSS: positioning · spacing · sizing · animation · responsive behavior

SlotWrapper → REMOVED (Agreement #18)
JS wrapping → REMOVED
className="slot slot--{position}" → CSS handles the rest
```

---

## NodeBase.layout field

```ts
interface LayoutHints {
  position?: 'sticky-top' | 'sticky-bottom' | 'flow' | 'overlay' | string
  order?:    number        // render order within parent container
  span?:     'full' | 'half' | 'third' | 'two-thirds' | 'auto' | string
  colSpan?:  number        // explicit column span for grid parent (1–12)
  rowSpan?:  number        // explicit row span for grid parent
  align?:    'start' | 'center' | 'end' | 'stretch' | string  // alignSelf in flex/grid
  label?:    string        // tab header, accordion title (parent reads)
  role?:     string        // 'chart' | 'table' | 'tab' | 'panel' | open string
}
```

**Open strings:** `position`, `span`, `role`, `align` accept any string — extensible without agreement.

**`colSpan`** — explicit number for grid layout (e.g., `colSpan: 6` in a 12-column grid).
**`span`** — named fraction alias (`'half'` = span 6 of 12). Both coexist — `colSpan` takes precedence when set.

---

## Engine slot wrapping

```tsx
// renderNode() — always wraps child (no registration option):
<div className={`slot slot--${child.layout?.position ?? 'flow'}`}>
  {renderedChild}
</div>
```

**CSS classes generated:**
```
slot--sticky-top     → position: sticky; top: 0; z-index: 100
slot--sticky-bottom  → position: sticky; bottom: 0
slot--flow           → display: block (default document flow)
slot--overlay        → position: fixed; inset: 0; z-index: 200
```

---

## Layout IS a node type (Agreement #13)

Layout nodes are registered in the same `nodeRegistry` as content nodes.
Same pattern. Same palette. Engine dispatches by `type` — no special handling.

```ts
// Layout nodes — registered exactly like content nodes:
nodeRegistry.register('grid',    GridShell)
nodeRegistry.register('columns', ColumnsShell)
nodeRegistry.register('stack',   StackShell)
nodeRegistry.register('card',    CardShell)
nodeRegistry.register('divider', DividerShell)   // new
nodeRegistry.register('spacer',  SpacerShell)    // new
```

---

## Layout node types

### grid — CSS grid, configurable columns and gaps

```ts
interface GridNode extends NodeBase {
  type:     'grid'
  columns?: number     // template column count (default: 12)
  gap?:     string     // CSS value or token: 'var(--spacing-md)' default
  children: NodeDef[]
}
```

Children use `layout.colSpan` / `layout.rowSpan` / `layout.align` for placement.

**When to use:** dashboard-style layouts with irregular spans (4+4+4, 8+4, 12, etc.).

```ts
{ type: 'grid', columns: 12, children: [
  { type: 'kpi-strip', layout: { colSpan: 12 } },   // full width
  { type: 'chart',     layout: { colSpan: 6  } },   // half
  { type: 'chart',     layout: { colSpan: 6  } },   // half
  { type: 'table',     layout: { colSpan: 12 } },   // full width
] }
```

---

### columns — equal-width columns (simpler than grid)

```ts
interface ColumnsNode extends NodeBase {
  type:     'columns'
  count?:   number    // column count (default: 2)
  gap?:     string    // default: 'var(--spacing-md)'
  children: NodeDef[]
}
```

Children use `layout.colSpan` to override equal width.

**When to use:** side-by-side equal-width content (KPI cards, two charts). Simpler than grid.

```ts
{ type: 'columns', count: 3, children: [
  { type: 'chart', data: { type: 'timeseries', indicator: 'B1G' } },
  { type: 'chart', data: { type: 'timeseries', indicator: 'D1'  } },
  { type: 'chart', data: { type: 'timeseries', indicator: 'B2G' } },
] }
```

---

### stack — flex column or row

```ts
interface StackNode extends NodeBase {
  type:       'stack'
  direction?: 'row' | 'column'   // default: 'column'
  gap?:       string             // default: 'var(--spacing-md)'
  wrap?:      boolean            // flex-wrap (default: false)
  children:   NodeDef[]
}
```

Children use `layout.order` / `layout.align`.

**When to use:** hero + sidebar pattern (direction: 'row'), vertical sequential stacking (direction: 'column' — default).

```ts
// Hero + sidebar:
{ type: 'stack', direction: 'row', gap: 'var(--spacing-lg)', children: [
  { type: 'landing-hero', layout: { align: 'stretch' } },    // takes remaining space
  { type: 'stack', direction: 'column', children: [          // sidebar stacked cards
    { type: 'card', children: [{ type: 'kpi-strip', ... }] },
    { type: 'card', children: [{ type: 'kpi-strip', ... }] },
  ]},
] }
```

---

### card — surface container with visual boundary

```ts
interface CardNode extends NodeBase {
  type:      'card'
  children?: NodeDef[]   // optional — card can be leaf or container
}
```

No layout fields — pure visual grouping. CSS provides background, border, radius, padding via tokens.

**When to use:** visual grouping with surface elevation. Wrap charts, tables, or KPI strips.

Token-driven: `--color-surface`, `--color-border`, `--radius-md`, `--spacing-md` — per-org, zero code.

```ts
{ type: 'card', children: [
  { type: 'kpi-strip', data: { type: 'row-list', indicators: ['B1G'] } },
] }
```

---

### divider — horizontal rule (NEW)

```ts
interface DividerNode extends NodeBase {
  type:     'divider'
  variant?: 'solid' | 'dashed' | 'invisible'   // default: 'solid'
}
```

**When to use:** visual section break between content groups. `variant: 'invisible'` = spacing only, no visible line.

```ts
{ type: 'divider', variant: 'solid' }
// CSS: border-top: 1px solid var(--color-border)
```

---

### spacer — explicit gap without content (NEW)

```ts
interface SpacerNode extends NodeBase {
  type:  'spacer'
  size?: string   // CSS value or token: 'var(--spacing-xl)' default
}
```

**When to use:** when gap between specific nodes differs from surrounding rhythm. Constructor-droppable spacing primitive.

```ts
{ type: 'spacer', size: 'var(--spacing-2xl)' }
// CSS: display: block; height: var(--spacing-2xl)
```

Do not overuse — prefer consistent grid/stack gaps. Use spacer only for exceptional spacing.

---

## Role groups — generic toggle pattern

`layout.role` is an **open string**. Shell never hardcodes role names.

```
children with distinct roles → toggle groups (chart ↔ table tab)
children with no role        → always visible

roles.length === 1 → no toggle shown
roles.length  >  1 → toggle buttons, one per distinct role
```

**Toggle label:** `layout.label ?? role` — config controls what the button says.

```ts
// Standard chart ↔ table toggle:
{ type: 'section', children: [
  { type: 'chart', layout: { role: 'chart', label: 'გრაფიკი' } },
  { type: 'table', layout: { role: 'table', label: 'ცხრილი'  } },
] }

// Map ↔ table toggle (zero shell code change — role is open string):
{ type: 'section', children: [
  { type: 'map',   layout: { role: 'map',   label: 'რუკა'    } },
  { type: 'table', layout: { role: 'table', label: 'ცხრილი'  } },
] }

// Annual ↔ quarterly (two charts, one toggle):
{ type: 'section', children: [
  { type: 'chart', layout: { role: 'annual',    label: 'წლიური'   } },
  { type: 'chart', layout: { role: 'quarterly', label: 'კვარტალი' } },
] }

// No role → always visible (subtitle above toggle area):
{ type: 'section', children: [
  { type: 'text',  /* no role → always visible */ },
  { type: 'chart', layout: { role: 'chart' } },
  { type: 'table', layout: { role: 'table' } },
] }
```

**SOLID O:** new role pair → zero shell change.

---

## Parent blind rule

```
Parent reads:  children.defs[i].layout.label   — tab title
               children.defs[i].layout.span    — column span
               children.defs[i].layout.colSpan — grid span
               children.defs[i].layout.role    — chart vs table toggle
               children.defs[i].layout.order   — render sort
               children.defs[i].layout.align   — alignSelf

Parent NEVER:  children.defs[i].type           — breaks Open/Closed
               imports child renderer types     — coupling
               if (child.type === 'chart') ...  — special-casing
```

---

## Layout order

```ts
// Within a parent, children render in layout.order order (ascending).
// No order → declaration order (stable).
{ type: 'section', children: [
  { type: 'filter-bar', layout: { position: 'sticky-top', order: 1 } },
  { type: 'kpi-strip',  layout: { order: 2 } },
  { type: 'chart',      layout: { order: 3 } },
  { type: 'table',      layout: { order: 4 } },
] }
// Engine sorts by order before rendering.
```

---

## ChildrenArg — why both defs and rendered

```ts
interface ChildrenArg {
  defs:     NodeDef[]     // original defs — layout metadata
  rendered: ReactNode[]   // pre-rendered by engine (same index as defs)
}
// Invariant: defs.length === rendered.length. No null in rendered.
// Engine filters visibleWhen=false before building ChildrenArg.
// Shell never receives invisible children — never checks for null.
```

---

## Slot wrapping — SlotRegistry REMOVED (Agreement #18)

```ts
// Before (wrong):
slotRegistry.register('filter-bar', { position: 'sticky-top' })
engine.extend(nodeRegistry, slotRegistry)

// After (correct):
// layout.position on NodeDef drives the slot class
// engine wraps: <div className="slot slot--{position}">
engine.extend(nodeRegistry)   // one arg — slotRegistry gone
```

---

## GeostatContainerPageShell — reads layout.span

```tsx
function GeostatContainerPageShell({ def, children }: PageShellProps<ContainerPageNode>) {
  return (
    <div className="container-page">
      {children.rendered.map((child, i) => (
        <div key={i} className={`container-slot span--${children.defs[i].layout?.span ?? 'auto'}`}>
          {child}
        </div>
      ))}
    </div>
  )
}
```

```css
.span--full       { grid-column: 1 / -1  }
.span--half       { grid-column: span 6  }
.span--third      { grid-column: span 4  }
.span--two-thirds { grid-column: span 8  }
.span--auto       { grid-column: span 1  }
```

---

## Constructor — layout palette

```ts
// nodeRegistry.list() after layout registration:
[
  { type: 'grid',    category: 'layout', label: 'გრიდი',     icon: 'layout-grid'    },
  { type: 'columns', category: 'layout', label: 'სვეტები',   icon: 'layout-columns' },
  { type: 'stack',   category: 'layout', label: 'სტეკი',     icon: 'layout-stack'   },
  { type: 'card',    category: 'layout', label: 'კარტა',     icon: 'layout-card'    },
  { type: 'divider', category: 'layout', label: 'გამყოფი',   icon: 'minus'          },
  { type: 'spacer',  category: 'layout', label: 'სივრცე',    icon: 'move-vertical'  },
  // content nodes:
  { type: 'section', category: 'data',   label: 'სექცია',    icon: 'layout-panel'   },
  { type: 'chart',   category: 'data',   label: 'ჩარტი',     icon: 'bar-chart-2'    },
  { type: 'table',   category: 'data',   label: 'ცხრილი',    icon: 'table-2'        },
  ...
]
// Constructor groups by category → 'layout' and 'data' tabs in palette
```

**Auto-discovery:** layout nodes registered via barrel → `setupRegistrations.ts` zero changes.

---

## IA convention — ONS / Eurostat standard page structure

```
PageHeader → FilterBar (sticky) → KPI strip → Sections [chart ↔ table] → Methodology footer
```

Progressive disclosure: KPI → chart → table → methodology. Secondary sections collapsed by default.

This ordering = JSON children order. Constructor templates enforce it.
Platform renders in whatever order JSON specifies. No platform enforcement.

---

## When to use each layout node

| Situation                                  | Use         | Why                                         |
|--------------------------------------------|-------------|---------------------------------------------|
| Dashboard with mixed column spans          | `grid`      | Explicit colSpan control (4+8, 6+6, 12, …)  |
| Two or three equal columns                 | `columns`   | Simpler than grid for equal widths           |
| Hero + sidebar side by side                | `stack row` | Flex row, children sized by content          |
| Vertical list of sections                  | default flow | No layout node needed — children stack by default |
| Visual grouping with surface               | `card`      | CSS token background + border + radius        |
| Section break                              | `divider`   | HR with variant control                      |
| Exceptional gap between two items          | `spacer`    | One-off spacing outside normal rhythm        |

---

## Anti-patterns

```ts
// ❌ Hardcoded colors in layout shell:
function GridShell(...) { return <div style={{ background: '#005A9C' }}> }
// ✅ CSS tokens only: style={{ gap: 'var(--spacing-md)' }}

// ❌ IA order enforced in platform code:
// renderNode.ts: if (node.type === 'filter-bar') renderFirst()
// ✅ IA order = JSON children order. Constructor templates enforce convention.

// ❌ Layout in page shell instead of layout node:
function InnerPageShell(def, ctx, children) {
  return <div style={{ display: 'grid', gridTemplateColumns: '8fr 4fr' }}>
    {children.rendered}  // fixed layout — Constructor has no control
  </div>
}
// ✅ InnerPageShell renders children in default flow.
//    Constructor adds <grid> or <columns> when spatial arrangement needed.

// ❌ Separate "layout system" outside node registry:
const layoutRegistry = new LayoutRegistry()
// ✅ Layout nodes = same nodeRegistry, same Constructor palette, same renderNode().

// ❌ Closed layout type union:
type LayoutType = 'grid' | 'columns' | 'stack'  // Constructor can't extend
// ✅ type: string on NodeBase — any registered type works.

// ❌ Parent inspects child type:
children.defs.forEach(d => { if (d.type === 'chart') renderChart(d) })
// ✅ Parent reads layout hints only: d.layout?.role, d.layout?.colSpan
```

---

## Code reference

```
docs/architecture/examples/layout-nodes.md  ← full shell implementations + usage examples
docs/architecture/examples/data-nodes.md    ← chart/table with own data (Pattern B–E)
```