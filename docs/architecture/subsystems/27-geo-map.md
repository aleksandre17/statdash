# Geo-Map Node — Architecture

> Library-agnostic geographic visualization node.
> Pattern: Grafana Geomap panel (plugin + data source separation).
> Shell handles map library. Engine handles data. Config is JSON.

---

## Platform comparison

| Platform | Geo model | Library | Data |
|----------|-----------|---------|------|
| Grafana | Geomap panel: basemap + layers[] | MapLibre GL | DataFrames per layer |
| Superset | Map chart: GeoJSON column or lat/lng | deck.gl | Query result |
| Metabase | Map visualization | Leaflet | Question result |
| Retool | Map component | Leaflet | Query binding |

**Common pattern:** map library in the shell/plugin, data from the standard data pipeline. GeoJSON geometry loaded separately from observation data.

**Our model:** same separation.
```
GeoMapNode.data → interpretSpec → DataRow[]  (observations — what to show)
GeoMapNode.source → GeoSource → GeoJSON      (geometry — where to show it)
Shell joins: rows[geoField] === feature.properties[geoField] → choropleth
```

---

## Three-tier GeoSource

Same tier concept as classifiers/display:

```
Tier 1  source: { type: 'inline', geojson }   — embedded, zero HTTP (dev/test)
Tier 2  source: { type: 'key', key }           — registered at bootstrap (setupRegistrations)
Tier 3  source: { type: 'url', href, ttl? }   — fetched + cached on first render
```

**Tier 2 bootstrap (setupRegistrations.ts):**
```ts
// src/app/setupRegistrations.ts
import GEORGIA_GEOJSON from '../data/geo/georgia-regions.json'
engine.geoRegistry.register('georgia-regions', GEORGIA_GEOJSON)
engine.geoRegistry.register('georgia-municipalities', await fetch('/geo/municipalities.json').then(r => r.json()))
```

**Tier 3 HTTP (Shell fetches on first render):**
```ts
// Shell fetches + caches; GeoMapNode config stays JSON-safe
source: { type: 'url', href: 'https://cdn.geostat.ge/geo/regions.geojson', ttl: 86400 }
// ttl (seconds): default 24h — geometry rarely changes; long cache OK
```

---

## GeoMapNode full type

```ts
interface GeoMapNode extends NodeBase {
  type:         'geo-map'
  data?:        DataSpec        // own data; absent = inherit ctx.rows
  geoField?:    string          // row field → feature.properties match key (default: 'geo')
  valueField?:  string          // row field for choropleth intensity (default: 'value')
  source:       GeoSource       // geometry source (required)
  options?:     GeoMapOptions
}

type GeoSource =
  | { type: 'inline'; geojson: object }
  | { type: 'key';    key: string }
  | { type: 'url';    href: string; ttl?: number }

interface GeoMapOptions {
  center?:       [number, number]  // [lat, lng] — absent = auto-fit to features
  zoom?:         number
  interactive?:  boolean           // default: true
  tooltipField?: string            // row field shown on hover
  onSelect?:     string            // filter param key set on feature click
}
```

---

## onSelect — interactive filter update

```ts
options: { onSelect: 'geo' }
// User clicks region → filter['geo'] = feature.properties['geo']
// → URL updates → ctx.dims['geo'] changes → all sections re-query

options: { onSelect: 'region_code' }
// Same pattern, different param key
// Shell calls: filterCtx.setMany({ [def.options.onSelect]: clickedCode })
```

**Why parameterized:** Grafana uses `variableName` on panel click actions. Retool uses `selectedRow.columnName`. Our approach: `onSelect: string` — any filter key, agnostic.

---

## Shell design (library-agnostic interface)

Shell receives:
```ts
interface GeoMapShellProps {
  def:       GeoMapNode
  ctx:       RenderContext    // ctx.rows = data (already resolved by engine)
  geojson:   object           // resolved by shell from def.source
}
```

Shell is responsible for:
1. Loading geojson (from inline / geoRegistry.get(key) / fetch(href) + cache)
2. Joining `ctx.rows` to features by `def.geoField`
3. Rendering choropleth
4. On feature click: `filterCtx.setMany({ [def.options.onSelect]: code })`

Shell is NOT responsible for data fetching (`ctx.rows` already populated by engine).

**Library swap = shell swap.** Config JSON unchanged.

---

## GeoRegistry (engine-level)

```ts
// engine.geoRegistry — accessed in setupRegistrations() and shell
interface GeoRegistry {
  register: (key: string, geojson: object) => void
  get:      (key: string) => object | undefined
  has:      (key: string) => boolean
}

// Shell usage:
function resolveGeoJson(source: GeoSource, registry: GeoRegistry): Promise<object> {
  switch (source.type) {
    case 'inline':  return Promise.resolve(source.geojson)
    case 'key':     return Promise.resolve(registry.get(source.key) ?? {})
    case 'url':     return geoCache.get(source.href, source.ttl ?? 86400)
  }
}
```

---

## Config examples

**Pattern A: section owns data, map inherits (same as chart/table)**
```ts
{
  type:     'section',
  data:     { type: 'timeseries', indicator: 'GVA_TOTAL', dims: { time: { $ctx: 'time' } } },
  children: [
    { type: 'geo-map', layout: { role: 'map' },
      source: { type: 'key', key: 'georgia-regions' },
      options: { tooltipField: 'label', onSelect: 'geo' } },
    { type: 'table', layout: { role: 'table' } },
  ],
}
```

**Pattern B: standalone map with own data**
```ts
{
  type:   'geo-map',
  data:   { type: 'timeseries', indicator: 'POPULATION', dims: { time: { $ctx: 'time' } } },
  source: { type: 'key', key: 'georgia-municipalities' },
  geoField:  'muni_code',
  valueField: 'value',
  options: { tooltipField: 'label', onSelect: 'municipality', interactive: true },
}
```

**Pattern C: display-only map (no click interaction)**
```ts
{
  type:   'geo-map',
  data:   { type: 'row-list', indicators: ['POVERTY_RATE'] },
  source: { type: 'url', href: 'https://cdn.geostat.ge/geo/georgia.geojson', ttl: 604800 },
  options: { interactive: false, tooltipField: 'label' },
  // onSelect absent → click does nothing
}
```

---

## Implementation checklist

```
plugins/nodes/geo-map/
  GeoMapShell.tsx      — Leaflet (or MapLibre) implementation
  GeoMapSkeleton.tsx   — loading state (placeholder div same height)
  types.ts             — module augmentation: NodeTypeMap['geo-map'] = GeoMapNode
  index.ts             — export GeoMapSlice

engine/core/src/
  registry/engine.ts   — add geoRegistry: GeoRegistry field
  data/geo-cache.ts    — URL fetch + TTL cache (same pattern as SuspenseStore)

src/app/
  setupRegistrations.ts — engine.geoRegistry.register('georgia-regions', ...)
```