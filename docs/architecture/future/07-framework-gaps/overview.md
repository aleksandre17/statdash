# Framework Gaps — Platform Comparison

> სად ვართ ახლა vs სად უნდა ვიყოთ generic BI framework-ისთვის.
> ეს document განახლდება Phase-ების მიხედვით.

---

## შედარება — reference platforms

| კრიტერიუმი | ჩვენი სტატუსი | Grafana | Retool | შენიშვნა |
|---|---|---|---|---|
| Plugin registry pattern | ✅ Grafana-ს დონის | ✅ | ✅ | `DatasourcePlugin.create()` = `DataSourcePlugin.create()` |
| JSON-safe instance config | ✅ Retool-ს დონის | ✅ | ✅ | DB-storable, Constructor-ready |
| Classifiers/display resolution | ✅ უფრო explicit | ❌ variables სისტემა | ❌ | Tier 1/2/3 — ჩვენი invention |
| React Suspense loading | ✅ framework standard | ❌ RxJS | ❌ | Next.js / Relay pattern |
| Query-level caching | ❌ Phase 3 | ✅ hash(query) | ✅ | ქვემოთ აღწერილია |
| Format-agnostic query type | ❌ Phase 3 | ✅ DataQueryRequest | ✅ | ჩვენი ObsQuery SDMX-tinted |
| Streaming / real-time | ❌ not needed yet | ✅ Observable | ❌ | სტატისტიკაზე არ გვჭირდება |
| Plugin sandboxing | ❌ Phase 4+ | ✅ NPM packages | ✅ | monorepo-only ახლა |

---

## Gap 1 — Query-level caching

**ახლა:** SuspenseStore ინახავს "ყველა observation"-ს. ყოველი `query()` filter in-memory.

**პრობლემა (scale-ზე):** 500k row dataset — ყველა page-ს ერთნაირი payload. `query({ indicator: 'B1G', geo: 'GE' })` vs `query({ indicator: 'D1', geo: 'TB' })` — ორივე ერთ fetch-ს ხდის, ერთ cache entry-ს.

**Grafana pattern:**
```ts
// hash(DataQueryRequest) → cache key
// სხვადასხვა query params → სხვადასხვა cache entry → სხვადასხვა fetch
queryCache.get(hash({ indicator: 'B1G', geo: 'GE', time: 2024 }))
```

**ჩვენი fix (Phase 3):**
```ts
class SuspenseStore {
  private cache = new Map<string, EngineRow[]>()

  query(q: ObsQuery): EngineRow[] {
    const key = stableHash(q)
    if (this.cache.has(key)) return this.cache.get(key)!
    // throw Promise → fetch only the requested slice
    throw this.fetchSlice(q).then(rows => this.cache.set(key, rows))
  }
}
```

**Priority:** Phase 3 — საჭიროა dataset-ის ზომა > 50k rows-ზე.

---

## Gap 2 — Format-agnostic ObsQuery

**ახლა:** `ObsQuery` = `{ indicators?, dims?, filter?, ... }` — SDMX vocabulary.

**პრობლემა:** `restJsonPlugin`, `csvPlugin`, `sqlPlugin` სხვა query shape-ს ელოდება. ჩვენი `query(q: ObsQuery)` interface strong-typing-ს კარგავს non-SDMX datasource-ებზე.

**Grafana pattern:** `query(request: DataQueryRequest<TQuery>)` — plugin defines `TQuery`. Engine passes it through opaquely.

**ჩვენი fix (Phase 3):**
```ts
// DataStore interface — generic query type
interface DataStore<TQuery = ObsQuery> {
  query(q: TQuery): EngineRow[]
}

// interpretSpec-ი builds the query — plugin-specific builder:
const q = plugin.buildQuery(spec, ctx)   // sdmx-api builds ObsQuery, sql builds SqlQuery
store.query(q)
```

**Priority:** Phase 3 — საჭიროა როდესაც non-SDMX datasource plugin გამოჩნდება.

---

## Gap 3 — Streaming / real-time

**ახლა:** Promise-only. `SuspenseStore.fetcher()` → `Promise<ApiResponse>`. Fire-and-forget.

**პრობლემა:** Live data (WebSocket, SSE) — promise-ი ერთხელ resolves, მეტი არ განახლდება.

**Grafana pattern:** `Observable<DataQueryResponse>` (RxJS) — WebSocket, live panels.

**ჩვენი fix (if needed):**
```ts
// fetcher-ი Observable-ს დააბრუნებს:
queryStream(q: ObsQuery): Observable<EngineRow[]>
// SuspenseStore → StreamStore — სხვა implementation
```

**Priority:** Phase 4+ — სტატისტიკის dashboard-ზე არ გვჭირდება. batch data only.

---

## Gap 4 — Plugin sandboxing

**ახლა:** Plugins = functions registered in `setupEngine()`. monorepo-only. Third-party plugin = კოდის ჩასმა.

**Grafana pattern:** Plugin = NPM package with `plugin.json` manifest. Separate bundle, runtime loaded, sandboxed iframe.

**ჩვენი fix (Phase 4+):**
```
engine.registerDatasource(url)  // URL-ით, dynamic import
→ fetch plugin bundle → validate manifest → register
```

**Priority:** Phase 4+ — Constructor-ი third-party plugin marketplace-ს დაამატებს.

---

## ვერდიქტი

**ჩვენი use case-ისთვის** (სტატისტიკური dashboard, batch data, SDMX) — **production-ready framework დონის.**

Gap-ები 1 და 2 ჩნდება მხოლოდ:
- dataset > 50k rows (Gap 1)
- non-SDMX plugin-ი (Gap 2)

Gap-ები 3 და 4 — Phase 4+ concerns.

**Phase 1/2-ისთვის ეს gaps irrelevant-ია.**

---

## Phase roadmap

```
Phase 1  — static data, TypeScript configs         ← ახლა
Phase 2  — Constructor, DB configs, real API        ← მომდევნო
Phase 3  — query-level cache, format-agnostic query ← scale
Phase 4  — streaming, plugin sandboxing             ← marketplace
```