# Missing Node Types — chip-select, links, page-header

> Migration audit revealed three node types present in the old project
> that were absent from the new architecture. All three are standard in
> statistical publication platforms (ONS, Eurostat, IMF).

---

## chip-select — toggle button filter control

### Platform comparison

| Platform | Component | When |
|----------|-----------|------|
| Grafana | Segmented control (variable) | ≤ 5 options, always visible |
| Retool | Segmented Control | Radio-like selection |
| ONS | Metric toggle buttons | Chart/table above, toggle below |
| Eurostat | Tab-style selector | Indicator or period toggle |

**Rule:** select → hidden dropdown (open on click). chip-select → all options always visible. Same data, different render.

### Design

```ts
// ParamDefMap augmentation:
'chip-select': ParamDefBase & {
  type:         'chip-select'
  options:      OptionsSource   // same as select — static/inline/query
  defaultValue?: DefaultSpec
  multiple?:    boolean         // false = radio (default) | true = multi-select render
}
```

**Behavioral equivalence:**

| Field | chip-select (multiple:false) | select | chip-select (multiple:true) | multi-select |
|-------|------------------------------|--------|---------------------------|--------------|
| ctx.dims value | string | string | string[] | string[] |
| OptionsSource | ✅ | ✅ | ✅ | ✅ |
| DefaultSpec | ✅ | ✅ | ✅ | ✅ |
| Render | chips | dropdown | chips | dropdown |

Engine treats chip-select identically to select (single) or multi-select (multiple:true) for ctx.dims computation. The only difference is in the FilterControlSlice Shell.

### Registration (plugins/controls/chip-select/)

```ts
export const chipSelectSlice: FilterControlSlice<string | string[], ChipSelectDef> = {
  Shell:        ChipSelectShell,
  META: { controlType: 'chip-select', label: 'Chip Select', category: 'selection' },
  codec: {
    encode: (v) => Array.isArray(v) ? v.join(',') : String(v),
    decode: (raw, def) => def.multiple ? raw.split(',').filter(Boolean) : raw,
  },
  defaultValue: (def) => resolveDefaultValue(def.defaultValue, def.options),
  validate:     (v, def) => def.multiple
    ? (Array.isArray(v) && v.length > 0)
    : (typeof v === 'string' && v.length > 0),
}
```

### ISP check

chip-select has no fields that other controls don't have. No violation. It is a pure presentation variant of `select` — different shell, same data contract.

---

## links — methodology / reference links

### Platform comparison

| Platform | Pattern | Standard? |
|----------|---------|-----------|
| ONS | "Further information" block | Every page |
| Eurostat | "Related publications" | Every dataset |
| WorldBank | "Sources & notes" | Every indicator |
| IMF | "References" | Every report |

Statistical publications always have methodology + source links. Missing from new arch — present in old (`LinksNode`).

### Design

```ts
interface LinksNode extends NodeBase {
  type:   'links'
  title?: string       // heading: "მეთოდოლოგია" / "გადმოწერა"
  items:  LinkItem[]
}

interface LinkItem {
  label:        string
  href:         string
  icon?:        string    // icon registry key; shell resolves
  description?: string    // "PDF · 2.4 MB"
  external?:    boolean   // default: true for http(s) → rel="noopener noreferrer"
}
```

**JSON-serializable:** all fields are primitives. Constructor stores as-is. ✅

### Shell concern

LinkItem.icon = string key. Shell resolves via icon registry (agnostic to icon set — lucide, phosphor, heroicons, custom SVG). Icon set registered at bootstrap.

```ts
// plugins/nodes/links/LinksShell.tsx
function LinksShell({ def }: { def: LinksNode }) {
  return (
    <nav className="links-block">
      {def.title && <h3 className="links-block__title">{def.title}</h3>}
      <ul className="links-block__list">
        {def.items.map((item, i) => (
          <li key={i}>
            <a href={item.href} {...(item.external !== false ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
              {item.icon && <Icon name={item.icon} />}
              <span>{item.label}</span>
              {item.description && <small>{item.description}</small>}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
```

---

## page-header — title + badge + description

### Platform comparison

| Platform | Header content | Badge |
|----------|---------------|-------|
| ONS | Title + "Published" date + "National Statistics" badge | Static |
| Eurostat | Title + reference period + "Preliminary" badge | Data-driven (obs_status) |
| IMF | Title + vintage + "Working Paper" classification | Static |
| WorldBank | Title + last updated + source | Mixed |

### Design

```ts
interface PageHeaderNode extends NodeBase {
  type:         'page-header'
  title?:       ExprVal   // absent = InnerPageNode.title (fallback via ctx.pageTitle)
  subtitle?:    ExprVal   // unit, period, methodology note
  description?: ExprVal   // paragraph text
  badge?:       BadgeSpec
}

type BadgeSpec =
  | { type: 'static'; label: string; variant?: 'warning'|'info'|'success'|'error' }
  | { type: 'data';   field: string; map: Record<string, { label: string; variant: '...' }> }
```

**BadgeSpec.type='data' — standard obs_status map:**

```ts
badge: {
  type: 'data',
  field: 'obs_status',
  map: {
    'P': { label: 'წინასწარი',    variant: 'warning' },
    'E': { label: 'შეფასებული',  variant: 'info'    },
    'F': { label: 'საბოლოო',     variant: 'success'  },
    'R': { label: 'გადახედული',  variant: 'info'    },
  },
}
// Shell reads ctx.rows[0]?.obs_status → maps → renders colored pill
```

### When to use page-header vs InnerPageNode.title

```
InnerPageNode.title   — page title in chrome (tab, breadcrumb, nav) — always required
page-header node      — visible in-page header block (ONS/Eurostat publication style)
                        optional — only add when page needs in-content title + badge
```

Dashboard-style pages: no page-header (chrome shows title).
Publication-style pages: page-header as first child (editorial style).