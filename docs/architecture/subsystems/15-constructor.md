# Constructor — Phase 2 Admin Panel Architecture

> Constructor = admin UI that creates any page with zero code.
> JSON in DB → fetchSiteManifest() → SiteProvider → engine.renderNode() → page rendered.
> Core rendering architecture: zero changes. Constructor adds introspection layer on top.

---

## What Constructor Needs from the Architecture

```
1. Node type registry    — what types exist? what is their config schema?
2. Transform registry    — what transform keys are registered?
3. Data catalog API      — what datasets exist on the backend?
4. Manifest API          — GET /api/site-manifest → { pages, nav }
```

These are **additions on top** — the rendering pipeline (interpretSpec, engine.renderNode,
SiteProvider) is unchanged. Constructor writes JSON; the existing frontend renders it.

---

## 1. Node Type Registry — introspection

### Problem
`nodeRegistry.register('section', SectionRenderer)` — registers a renderer.
Constructor cannot ask: "what types are available?" or "what config does 'section' need?"

### Solution — optional metadata on register()

```ts
interface NodeRegistryMeta {
  label?:    string                    // 'სექცია' — Constructor type picker label
  icon?:     string                    // 'layout-section' — Constructor UI icon key
  category?: string                    // 'layout' | 'data' | 'page' — palette grouping
  variants?: string[]                  // CSS modifier hints for Constructor variant picker
                                       // Source of truth = component's exported const.
                                       // Registration imports from component (never hardcoded).
                                       // CSS accepts any string — list is not enforced.
  schema?:   object                    // JSON Schema → form UI (else JSON editor fallback)
  preview?:  string                    // path to static thumbnail (palette tile only)
                                       // canvas preview = iframe of actual app (see §6)
}

// Existing call (still works — no metadata, Constructor shows type key only):
nodeRegistry.register('section', SectionRenderer)

// With metadata (Constructor-aware):
nodeRegistry.register('section', SectionRenderer, {
  label:    'სექცია',
  icon:     'layout-section',
  category: 'layout',
  schema:   SectionNodeSchema,
})
```

### New nodeRegistry methods

```ts
// List all registered types with their metadata:
nodeRegistry.list(): Array<{ type: string } & Partial<NodeRegistryMeta>>

// Get JSON Schema for a specific type (null if not registered):
nodeRegistry.getSchema(type: string): object | null
```

### Usage in Constructor UI

```ts
// Type picker — show all registered types grouped by category:
const types = nodeRegistry.list()
// → [
//     { type: 'section',    label: 'სექცია',    category: 'layout', icon: 'layout-section' },
//     { type: 'kpi-strip',  label: 'KPI ზოლი',  category: 'data',   icon: 'bar-chart' },
//     { type: 'chart',      label: 'გრაფიკი',   category: 'data',   icon: 'chart-line' },
//     { type: 'table',      label: 'ცხრილი',    category: 'data',   icon: 'table' },
//     { type: 'filter-bar', label: 'ფილტრი',    category: 'layout', icon: 'filter' },
//     ...
//   ]

// Config form — render from JSON Schema:
const schema = nodeRegistry.getSchema('section')
if (schema) {
  // render form (react-jsonschema-form or custom)
} else {
  // fallback: raw JSON editor (Monaco / CodeMirror)
}
```

---

## 2. Transform Registry — introspection

### Problem
`engine.registerTransform('fromSDMX', fromSDMX)` — registers a parse function.
Constructor cannot list available transform keys for DataSpec.transform dropdown.

### Solution

```ts
engine.listTransforms(): string[]
// → ['fromSDMX', 'raw']    (built-ins)
// → ['fromSDMX', 'raw', 'fromCSV']   (after project registers 'fromCSV')
```

### Usage in Constructor UI

```ts
// DataSpec form — transform dropdown:
const transforms = engine.listTransforms()
// → ['fromSDMX', 'raw']
// Constructor renders <select> with these options
```

---

## 3. JSON Schema — node config forms

JSON Schema is **optional per node type**. Progressive enhancement:

```
no schema registered  →  Constructor shows raw JSON editor
schema registered     →  Constructor shows form UI (react-jsonschema-form or custom)
```

### Schema registration (src/app/setupEngine.ts)

```ts
import { SectionNodeSchema }   from './schemas/section.schema'
import { KpiStripNodeSchema }  from './schemas/kpi-strip.schema'
import { ChartNodeSchema }     from './schemas/chart.schema'

nodeRegistry.register('section',   SectionRenderer,   { label: 'სექცია',   schema: SectionNodeSchema })
nodeRegistry.register('kpi-strip', KpiStripRenderer,  { label: 'KPI ზოლი', schema: KpiStripNodeSchema })
nodeRegistry.register('chart',     ChartRenderer,     { label: 'გრაფიკი',  schema: ChartNodeSchema })
// Types without schema → Constructor uses JSON editor fallback
```

### Example schema (section node)

```ts
// src/app/schemas/section.schema.ts
export const SectionNodeSchema = {
  type: 'object',
  properties: {
    title:    { type: 'string',  title: 'სათაური' },
    color:    { type: 'string',  title: 'ფერი', format: 'color' },
    data:     { title: 'მონაცემები', $ref: '#/definitions/DataSpec' },
    children: { type: 'array',   title: 'ქვე-კვანძები',
                items: { $ref: '#/definitions/NodeDef' } },
  },
  required: ['children'],
  definitions: {
    DataSpec: { /* ... */ },
    NodeDef:  { /* ... */ },
  },
}
```

### Constructor stores schema in DB

```sql
-- node_schemas table (optional — schemas can also live in frontend bundle):
CREATE TABLE node_schemas (
  type    TEXT PRIMARY KEY,
  schema  JSONB NOT NULL   -- JSON Schema object
);
```

Constructor writes `schema` to DB on registration. On manifest fetch, schemas returned alongside pages/nav. Frontend uses schema for validation before saving.

---

## 4. Data Catalog API — dataset browser

Constructor user creates DataSpec. They need to browse available datasets, pick indicators, dimensions.

### API Contract

```
GET /api/catalog
→ DatasetEntry[]
```

```ts
interface DatasetEntry {
  id:         string           // 'GDP_GE' — internal dataset code
  label:      string           // 'მთლიანი შიდა პროდუქტი'
  href:       string           // 'https://api.geostat.ge/sdmx/v1/data/GDP_GE'
  transform:  string           // 'fromSDMX' — matches TRANSFORM_MAP key
  dimensions: DimensionMeta[]  // available dims for DataSpec.dims
  indicators: IndicatorMeta[]  // available indicator codes
}

interface DimensionMeta {
  key:    string                            // 'geo' | 'time' | 'sector'
  label:  string                            // 'გეოგრაფია'
  values: Array<{ code: string; label: string }>
  //   [{ code: 'GE', label: 'საქართველო' }, ...]
}

interface IndicatorMeta {
  code:  string   // 'B1G' | 'P3' | 'P51G'
  label: string   // 'მშპ' | 'მოხმარება' | 'ინვესტიციები'
}
```

### Usage in Constructor DataSpec form

```ts
// User picks dataset from catalog:
const catalog = await fetch('/api/catalog').then(r => r.json())
// → [{ id:'GDP_GE', label:'მშპ', href:'https://...', indicators:[...], dimensions:[...] }]

// User picks 'GDP_GE' → Constructor auto-fills DataSpec:
const spec: DataSpec = {
  type:      'timeseries',
  href:      catalog[0].href,       // 'https://api.geostat.ge/sdmx/v1/data/GDP_GE'
  transform: catalog[0].transform,  // 'fromSDMX'
  indicator: 'B1G',                 // picked from catalog[0].indicators dropdown
  dims: {
    geo:  { $ctx: 'geo' },          // picked from catalog[0].dimensions
    time: { $ctx: 'time' },
  },
}
// Constructor saves this JSON to DB. SiteProvider fetches and renders. Zero code.
```

### Backend responsibility

Data catalog derives from SDMX DSD (Data Structure Definition):
- `GET /api/sdmx/dataflow` → list of available datasets
- `GET /api/sdmx/datastructure/{id}` → dimensions + codelists
- Backend aggregates → `GET /api/catalog` → `DatasetEntry[]`

Frontend does NOT fetch raw SDMX — catalog API is pre-processed, Constructor-friendly.

---

## 5. Manifest API — Phase 2 backend

```
GET /api/site-manifest
→ { pages: Record<string, PageConfig>, nav: NavItem[] }
```

```ts
// Constructor writes:
//   POST /api/pages    → { id, type, title, children: NodeDef[] }
//   POST /api/nav      → { label, path, pageId, icon, color }
//
// Frontend fetches (main.tsx top-level await):
//   fetchSiteManifest() → GET /api/site-manifest
//   → { pages, nav, stores: {} }
//   stores: {} — Constructor pages use href, HttpDataStore built-in
```

Phase 1 hand-crafted pages still use STORE_MANIFEST (storeId path). Both coexist.
See `architecture/08-site-manifest.md` + `examples/main.md`.

---

## 6. Constructor Canvas — iframe preview

Constructor does NOT have its own rendering engine. Canvas = iframe of the actual app.

```
Constructor user places 'section' node
  → PageConfig draft updated (in-memory or draft=true DB flag)
  → iframe: GET /api/site-manifest?draft=true
  → SiteRenderer → engine.renderNode() ← same pipeline, unchanged
  → user sees exact result, pixel-perfect
```

### Why iframe

| Approach | Problem |
|---|---|
| Constructor renders components itself | Duplicates rendering logic — two sources of truth |
| Static screenshot | Stale after CSS change |
| iframe of actual app | ✅ Always correct — same engine, same shells, same CSS |

### Platform consensus

| Platform | Canvas pattern |
|---|---|
| Builder.io | iframe of actual site — live render |
| Grafana | Live panel render with sample data |
| Retool | Live component render in canvas |

All serious platforms: canvas = live render, not Constructor-owned renderer.

### NodeRegistryMeta.preview

`preview?: string` = static thumbnail path for the **palette tile** (type picker).
Not for the canvas. Palette tile = small icon-sized preview before placing a node.
Canvas = always iframe.

```ts
nodeRegistry.register('section', SectionRenderer, {
  preview: '/assets/previews/section-card.png',  // optional, palette tile only
})
```

---

## Constructor Save — Validation Contract (K-3)

> **Retool + Builder.io:** config validation on save → form errors shown inline, save blocked.
> Constructor uses JSON Schema (if registered) to validate before persisting. No schema = raw JSON editor, no validation gate.

### Validation flow on save

```
User edits node config in Constructor
  → schema registered?
      YES → validate config against JSON Schema
              errors? → inline form errors shown, save button disabled
              valid?  → POST /api/pages with config → DB persists
      NO  → raw JSON editor shown
              valid JSON? → save proceeds (structural check only — no schema validation)
              invalid JSON? → editor error shown, save blocked

On load (existing page):
  → config fetched from DB
  → schema registered?
      YES → validate (non-blocking) — emit console.warn if invalid (migration safety)
      NO  → render as-is
```

### What validation catches

```ts
// SectionNodeSchema validates:
//   required: ['children']          → save blocked if no children
//   children: { type: 'array' }     → type error caught
//   data.type: enum of known types  → unknown DataSpec type caught before runtime

// What validation does NOT catch:
//   storeId referencing non-existent store  → runtime DataStore.query() throws (NodeErrorBoundary)
//   indicator code not in dataset           → interpretSpec returns [] → EmptyState shown
//   href returning 404                      → HttpDataStore throws Error → NodeErrorBoundary
// These are data-level errors — not config schema errors. Runtime boundaries handle them.
```

### Schema-absent types — raw JSON editor contract

```
No schema registered → Constructor shows Monaco/CodeMirror JSON editor.
User edits raw JSON. No form validation.
Save contract: valid JSON parse → save. Invalid JSON → save blocked with JSON parse error.
Runtime contract: if config has wrong shape → NodeErrorBoundary catches the runtime error.

This is a Progressive Enhancement:
  phase 0: no schema — JSON editor (always works)
  phase 1: schema registered — form UI + validation (better UX)
  Constructor can ship without schemas and progressively add them per type.
```

### Deleted catalog entry — graceful degradation

```
Dataset was in /api/catalog → Constructor used it in DataSpec.href
Backend removes the dataset → href now returns 404 → HttpDataStore fetch fails

Result:
  HttpDataStore.query() → fetch fails → fetchError set → throws Error on retry
  NodeErrorBoundary catches → error node shown ("მონაცემი მიუწვდომელია")
  Other sections on the page continue rendering normally

Constructor responsibility:
  When /api/catalog endpoint removes an entry → Constructor should flag pages
  that reference that href (via a validation API or background check).
  This is a backend concern — not a frontend architecture change.
```

---

## Constructor — What Does NOT Change

```
engine.renderNode()          — unchanged. Renders JSON config.
interpretSpec()              — unchanged. href path already works.
SiteProvider                 — unchanged. 3 props: stores, pages, nav.
fetchSiteManifest()          — unchanged. Layer 2 → Phase 2 flip.
DataSpec types               — unchanged. href already on DataSpecBase.
NavItem                      — unchanged. Independent of PageConfig.
main.tsx top-level await     — unchanged. manifest arrives before React mounts.
```

Constructor is purely **additive**. No rendering code changes.

---

## Registration in src/app/setupEngine.ts — full picture

```ts
import { engine, nodeRegistry }          from '@geostat/engine'
import { SectionRenderer }               from '../features/section/SectionRenderer'
import { SectionNodeSchema }             from './schemas/section.schema'
import { accountSequenceResolver }       from '../features/accounts/resolvers'
import { fromSDMX }                      from '@geostat/engine'

export function setupEngine() {
  // 1. Node types (rendering + Constructor metadata)
  engine.extend(nodeRegistry)
  nodeRegistry.register('section', SectionRenderer, {
    label: 'სექცია', icon: 'layout-section', category: 'layout',
    schema: SectionNodeSchema,   // optional — enables form UI in Constructor
  })
  nodeRegistry.register('landing-page', LandingPageRenderer, {
    label: 'სალანდინგო გვერდი', category: 'page',
  })

  // 2. Custom DataSpec types
  engine.extendSpec('account-sequence', accountSequenceResolver)

  // 3. Parse functions (Constructor transform dropdown uses listTransforms())
  engine.registerTransform('fromSDMX', fromSDMX)
}
```

---

## Summary

| Concern | Solution | Where |
|---|---|---|
| Node type list | `nodeRegistry.list()` | engine/react |
| Node type variants | component exports `SECTION_VARIANTS` → `register({ variants })` | src/components/theme/ |
| Node type schema | `nodeRegistry.register(type, r, { schema })` | src/app/setupEngine.ts |
| Palette thumbnail | `register({ preview: '/assets/...' })` — optional | src/app/setupEngine.ts |
| Canvas preview | iframe of actual app (`?draft=true`) | Constructor app |
| Transform list | `engine.listTransforms()` | engine/core |
| Dataset browser | `GET /api/catalog` → `DatasetEntry[]` | backend |
| Manifest fetch | `GET /api/site-manifest` | backend + fetchSiteManifest() |
| Page rendering | unchanged | existing pipeline |
