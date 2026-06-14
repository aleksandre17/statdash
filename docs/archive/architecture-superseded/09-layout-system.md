# Layout System

> Layout hints + CSS = parent blind + open/closed. JS handles nothing visual.
> Agreement #13 (Layout IS a node type) + Agreement #15 (layout hints) + Agreement #18 (SlotWrapper removed)

---

## Core Principle — CSS First

```
JS:  data fetching · visibility (evalExpr) · composition (children[]) · event handlers
CSS: positioning · spacing · sizing · animation · responsive behavior

SlotWrapper → REMOVED (Agreement #18)
JS wrapping → REMOVED
className="slot slot--{position}" → CSS handles the rest
```

---

## layout field on NodeBase

```ts
interface LayoutHints {
  position?: 'sticky-top' | 'sticky-bottom' | 'flow' | 'overlay' | string
  order?:    number        // render order within parent container
  span?:     'full' | 'half' | 'third' | 'auto' | string
  label?:    string        // tab header, accordion title (parent reads)
  role?:     string        // 'chart' | 'table' | 'tab' | 'panel' | open string
}
```

**Open strings:** `position`, `span`, `role` accept any string — extensible without agreement.

---

## Engine Slot Wrapping

```tsx
// renderNode() — step 6 (always wraps — no registration option):
<div className={`slot slot--${child.layout?.position ?? 'flow'}`}>
  {renderedChild}
</div>

// Engine ALWAYS wraps. CSS controls position. No slotLayout registration option.
// SlotRegistry removed (Agreement #18) — layout.position on NodeDef drives wrapping.
```

**CSS classes generated:**
```
slot--sticky-top      → position: sticky; top: 0; z-index: 100
slot--sticky-bottom   → position: sticky; bottom: 0
slot--flow            → display: block (default document flow)
slot--overlay         → position: fixed; overlay: screen
```

---

## Layout IS a Node Type (Agreement #13)

```ts
// Layout nodes ARE nodes. Same registry, same pattern.
{ type: 'inner-page',     children: [...] }   // registered in nodeRegistry
{ type: 'tab-page',       children: [...] }
{ type: 'container-page', children: [...] }

// Parent blind — layout type doesn't need special engine handling.
// engine.renderNode dispatches by type just like section, chart, table.
```

---

## Config Examples

```ts
// Sticky filter bar at top
// bars: Record<string, BarDef> — config input (NOT FilterBarSpec[] runtime)
{ type: 'filter-bar',
  bars: { main: { position: 'sticky', order: 1, filters: { time: { type: 'year-select' } } } },
  layout: { position: 'sticky-top', order: 1 }
}

// Full-width section
{ type: 'section',
  layout: { position: 'flow', span: 'full', order: 2 }
}

// Tab page — children have labels
{ type: 'tab-page',
  children: [
    { type: 'inner-page', layout: { label: 'წლიური' },   children: [...] },
    { type: 'inner-page', layout: { label: 'კვარტალური' }, children: [...] },
  ]
}

// Container page — children have spans
{ type: 'container-page',
  children: [
    { type: 'section', layout: { span: 'two-thirds' }, children: [...] },
    { type: 'section', layout: { span: 'one-third'  }, children: [...] },
  ]
}

// Section — role identifies chart vs table (for toggle)
{ type: 'section',
  children: [
    { type: 'chart', layout: { role: 'chart' } },
    { type: 'table', layout: { role: 'table' } },
  ]
}
```

---

## SlotRegistry — REMOVED (Agreement #18)

```ts
// Before (wrong):
slotRegistry.register('filter-bar', { position: 'sticky-top', wrapper: FilterBarWrapper })
engine.extend(nodeRegistry, slotRegistry)   // two args

// After (correct):
// layout.position in config handles position declaration
// engine wraps with <div className="slot slot--{position}">
// CSS handles the rest
engine.extend(nodeRegistry)   // one arg — slotRegistry gone

// SlotWrapper REMOVED — FilterBarWrapper, SectionsWrapper — deleted
// renderSlots() REMOVED — renderNode() is the only entry point
```

---

## GeostatContainerPageShell — reads layout.span

```tsx
function GeostatContainerPageShell({ def, children }: PageShellProps<ContainerPageNode>) {
  return (
    <div className="container-page">
      {children.rendered.map((child, i) => (
        <div
          key={i}
          className={`container-slot span--${children.defs[i].layout?.span ?? 'auto'}`}
        >
          {child}
        </div>
      ))}
    </div>
  )
}
```

CSS:
```css
.span--full       { grid-column: 1 / -1 }
.span--half       { grid-column: span 6 }
.span--third      { grid-column: span 4 }
.span--two-thirds { grid-column: span 8 }
.span--auto       { grid-column: span 1 }
```

---

## Role Groups — Generic Toggle Pattern

`layout.role` is an **open string**. Shell never hardcodes role names.

```
children with distinct roles → toggle groups
children with no role        → always visible

roles.length === 1 → no toggle shown (all same group or no roles)
roles.length  >  1 → toggle buttons, one per distinct role
```

**Toggle label:** `layout.label ?? role` — config controls what the button says.
No label in config → role string shown. Always works without extra config.

```ts
// Config — role is open string. Shell reads it generically:
{ type: 'section', children: [
  { type: 'chart', layout: { role: 'chart',    label: 'გრაფიკი' } },
  { type: 'table', layout: { role: 'table',    label: 'ცხრილი'  } },
] }

// Same shell, different roles — zero shell code change:
{ type: 'section', children: [
  { type: 'chart', layout: { role: 'map',       label: 'რუკა'     } },
  { type: 'table', layout: { role: 'table',     label: 'ცხრილი'  } },
] }

{ type: 'section', children: [
  { type: 'chart', layout: { role: 'annual',    label: 'წლიური'   } },
  { type: 'chart', layout: { role: 'quarterly', label: 'კვარტალი' } },
] }

// No role → always visible (e.g. a subtitle node above the toggle area):
{ type: 'section', children: [
  { type: 'text',  layout: { /* no role */ } },   // always shown
  { type: 'chart', layout: { role: 'chart' } },
  { type: 'table', layout: { role: 'table' } },
] }
```

**SOLID O:** new role pair → zero shell change. Shell open for extension, closed for modification.
**PRINCIPLES rule 1:** `role` stays open string — never close to `'chart' | 'table'`.

---

## Parent Blind Rule

```
Parent reads:   children.defs[i].layout.label   (tab title)
                children.defs[i].layout.span    (column span)
                children.defs[i].layout.role    (chart vs table)
                children.defs[i].layout.order   (for sorting)
Parent NEVER:   checks children.defs[i].type    (breaks Open/Closed)
                imports child renderer types     (coupling)
                special-cases any child type     (if (child.type === 'chart') ...)
```

---

## Order — explicit render order

```ts
// Within a parent, children render in `layout.order` order (ascending).
// If no order → declaration order.
{ type: 'section',
  children: [
    { type: 'filter-bar', layout: { position: 'sticky-top', order: 1 } },
    { type: 'kpi-strip',  layout: { order: 2 } },
    { type: 'chart',      layout: { order: 3 } },
    { type: 'table',      layout: { order: 4 } },
  ]
}
// Engine sorts by order before rendering.
```
