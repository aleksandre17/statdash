---
description: Data adapter boundary rules — fromSDMX, DataSpec, DataStore
paths:
  - "src/data/**"
  - "engine/core/src/data/**"
---

# Data Layer Rules

> **Enforcement layer** (path-scoped · auto-loads on `paths:` match) — ✅/❌ only, not a design home.
> Design → `docs/architecture/subsystems/25-datasource-system.md` · `18-classifier-pipe.md` · `05-data-pipeline.md` · Method → `.claude/generic/engineering/structure.md` (ports & adapters) · Orientation → `packages/CLAUDE.md` · `src/CLAUDE.md`

## fromSDMX — only adapter boundary

```ts
// fromSDMX() = ONLY place where API format → internal DataRow[]
// Phase 2: backend sends correct codes → fromSDMX simplified or removed
// Now: leave CODE_MAP + isCarryForward filter as-is

// Multilingual extraction (Phase 1 — both locales):
fromSDMX(json, { locales: manifest.i18n.locales })
// Result: classifiers: { geo: { 'GE': { ka: 'საქართველო', en: 'Georgia' } } }
```

## DataSpec — declarative, zero logic

```ts
// ✅ In DataSpec: indicator codes · ObsQuery · CtxRef { $ctx } · years: number[]
// ❌ In DataSpec: val() · fetch() · async · store refs · ctx.dims access at defn time
// ❌ getRows: (ctx) => DataRow[]  — function in config = not Constructor-ready

// interpretSpec(spec, ctx, store) → DataRow[]  — called by engine, not manually
```

## DataStore interface — unified query

```ts
interface DataStore {
  query(q: StoreQuery, ctx: SectionContext): EngineRow[]
  batchQuery?(queries: StoreQuery[], ctx: SectionContext): EngineRow[][]
  readonly caps?:        StoreCaps
  readonly classifiers?: Record<string, Classifier>   // LocaleString values
  readonly display?:     Record<string, DisplayMap>   // LocaleString fields
}
```

## SectionContext.locale — pass to store for locale-aware APIs

```ts
// ExternalStore: GET /api/data?lang=ka  — locale from SectionContext.locale
// Engine: agnostic (never reads locale itself)
```

## Phase 1 constraints — do NOT touch

```
CODE_MAP       — leave as-is (Phase 2: backend sends correct codes)
isCarryForward — leave filter as-is (Phase 2: DB filters)
```

Full DataStore design → `docs/architecture/subsystems/25-datasource-system.md`