# ★ Decision Framework

> ყოველი ახალი გადაწყვეტილება ამ framework-ით ფასდება.
> პლატფორმები პირველია — Eurostat/ONS პრაქტიკა — შემდეგ ინოვაცია.

---

## Step 1 — Commercial Platform Baseline

> "Grafana, Builder.io, Retool, AppSmith ამ პრობლემას როგორ წყვეტს?"

ეს platform-ები წლების R&D-ის შედეგია. ჩვენი baseline.
თუ ისინი ერთ approach-ზე თანხმდებიან — ეს proven solution-ია.

| Platform | Core Pattern |
|----------|-------------|
| **Grafana** | Plugin JSON → Dashboard JSON → render. `useTheme2()`. `bootData` nav. |
| **Builder.io** | `builder.get('page', url)` → PageConfig → `<Page def={def} />`. `Builder.registerComponent()`. |
| **Retool** | Named datasources. Computed state. Effect chaining. App-level nav. |
| **AppSmith** | Widget JSON tree. Canvas renders. Nav independent of pages. |

---

## Step 2 — Principles

```
Open / Closed      — add new type → register, never modify engine
Parent Blind       — parent never knows child type. children: NodeDef[] array
JSON Serializable  — every config field must survive JSON.parse(JSON.stringify(x))
Constructor Test   — "Constructor-ი ამ field-ს DB-ში ჩაწერს?" → if no, redesign
CSS First          — visual layout = CSS. JS = data, visibility, composition only
```

---

## Step 3 — Five Tests (new feature must pass all)

```
① Open/Closed Test
   ახალი node type → register(type, renderer) → done
   engine, ThemeConfig, NodeDef union-ი არ იცვლება

② Parent Blind Test
   parent renderer ვერ references child type-ს
   children: NodeDef[] — parent reads layout metadata (role, label, span)
   parent reads rendered[i] — never switches on child type

③ JSON Serializable Test
   JSON.parse(JSON.stringify(config)) === config  (deep equal)
   ❌ functions, Dates, undefined, class instances
   ✅ strings, numbers, booleans, null, arrays, plain objects

④ Constructor Test
   "Constructor-ი GUI-დან ამ config-ს შექმნის?"
   ✅ { op: 'eq', left: { $ctx: 'mode' }, right: 'year' }
   ❌ { filter: (row) => row.geo === 'ka' }

⑤ CSS First Test
   visual concern? → CSS class / CSS variable
   JS? — only: data fetch, visibility (evalExpr), composition (children[])
   ❌ style={} for layout   ✅ className="slot slot--sticky-top"
```

---

## Step 4 — Hierarchy Rules (when in conflict)

```
array > named fields     children: NodeDef[]  >  filterBar: FilterBarNode
CSS > JS                 layout.position CSS  >  JS wrapper logic
context > props          useTheme()           >  <Renderer theme={theme} />
type+registry > union    register(type, fn)   >  if (type === 'section') { ... }
```

---

## Decision Examples

### Nav items source

- ❌ `PageConfig.nav: NavItemDef` — page knows its nav position (coupling)
- ✅ `nav.config.ts: NavItem[]` — site-level concern, independent (Retool/AppSmith pattern)

### Children rendering

- ❌ `{ chart: ChartNode, table: TableNode }` — named fields (parent not blind)
- ✅ `children: NodeDef[]` + `layout.role` — parent blind, open, CSS controls

### Data lookup in expressions

- ❌ `{ op: 'tree-field', rows: DataRow[] }` — inline data (not JSON-serializable at scale)
- ✅ `{ op: 'tree-field', data: DataSpec }` → engine DeriveEntry (data resolved at runtime)

### Filter schema

- ❌ `{ bars: { main: { onFilter: (dims) => ... } } }` — function (not JSON)
- ✅ `defineFilters({ bars: { main: { filters: { time: { type: 'year-select' } } } } })` — pure JSON schema

---

## When In Doubt

> "Grafana plugin-ი ამ approach-ს გამოიყენებს?"
> "Builder.io content model-ი ამ field-ს JSON-ად შეინახავს?"
> "Constructor-ი ამ GUI-ს დახატავს?"

სამივე კი → proceed.
ერთი "არა" → redesign.
