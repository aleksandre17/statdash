# Monorepo Overview

> სამი package + app. ერთი dependency direction. Zero circles.

---

## Dependency Graph

```
engine/expr/    @geostat/expr     — zero deps
      ↑
engine/core/  @geostat/engine   — imports @geostat/expr
      ↑
engine/react/   @geostat/react    — imports @geostat/engine + @geostat/expr
      ↑
src/              national-accounts  — imports all three
```

**Rule:** Arrows point UP only. `src/` → `engine/react/` → `engine/core/` → `engine/expr/`.
Never reverse. Never circular.

---

## Package Roles

### `@geostat/expr` — pure expression evaluator
- Zero dependencies
- TypeScript only
- Evaluates `ExprVal` → `DimVal`
- Used by: engine (interpretSpec, evalDerived), react (renderNode visibleWhen)
- Future: WASM build, web worker, server-side Constructor validation

### `@geostat/engine` — data pipeline
- Pure TypeScript, zero React
- `interpretSpec(spec, ctx, stores) → DataRow[]`
- `evalDerived(deriveMap, ctx) → Record<string, DimVal>`
- `fromSDMX(raw) → Observation[]`
- `engine.renderNode(node, ctx) → ReactNode`

### `@geostat/react` — React adapter
- Zero app content
- Zero Geostat identity
- Bridges React Context → RenderContext
- Ships `DEFAULT_THEME` (new project works immediately)
- Exports all type contracts + components + hooks

### `src/` — Geostat app
- Geostat identity (GEOSTAT_THEME, brand shells)
- PageConfig JSON files (gdp, accounts, regional, landing)
- DataStore instances (gdp.store.ts, accounts.store.ts)
- nav.config.ts (NavItem[])

---

## Layer Rules

```
Layer             Can import from
engine/expr/    — nothing (zero deps)
engine/core/  — @geostat/expr
engine/react/   — @geostat/engine, @geostat/expr, React
src/              — all packages, own files

NEVER:
engine/react/ → src/     (circular dep, breaks isolation)
engine/core/ → React    (zero React rule)
engine/expr/ → anything   (zero deps rule)
```

---

## Three Separations in src/

```
data/        ← zero deps on features/ or components/
features/    ← data/ (storeKey strings only — NEVER DataStore instances)
             ← engine/react/ + @geostat/engine (types only)
components/  ← engine/react/ (ThemeConfig, Shell props interfaces)
             ← @geostat/engine (SectionNode, ChartNode — for def pass-through)
app/         ← wires all: data/ + features/ + components/ + packages/
```

### features/ → features/ imports — FORBIDDEN (J-4)

```
// ❌ Cross-feature imports — creates hidden coupling:
src/features/gdp/gdp.config.ts
  import { ACCOUNT_CODES } from '../accounts/accounts.constants'
  // GDP page now depends on accounts page. Refactoring accounts breaks GDP.

// ✅ Correct — shared data belongs in data/, not features/:
src/data/constants/sna-codes.ts     ← shared SNA codes (both gdp/ and accounts/ import from here)
src/features/gdp/gdp.config.ts      ← imports from src/data/, not from features/accounts/
src/features/accounts/accounts.config.ts  ← same
```

**Rule:** `features/X` may import only from:
- `packages/*` (type contracts, engine, hooks)
- `src/data/` (stores, nav, constants — via storeKey string, never DataStore instance)
- `src/components/` (shared UI only if truly generic)

`features/X` may **never** import from `features/Y`. Shared logic → `src/data/` or `packages/`.

---

## What Lives Where — Quick Reference

| Thing | Location |
|-------|----------|
| Expression types (ExprVal, DeriveMap) | `engine/expr/` |
| DataSpec, DataRow, DataStore | `engine/core/` |
| NodeBase, NodeDef, RenderContext | `engine/react/` |
| ThemeConfig, DEFAULT_THEME | `engine/react/` |
| SiteProvider, useTheme | `engine/react/` |
| defineFilters, useFilters | `engine/react/` |
| GEOSTAT_THEME | `src/app/theme.ts` |
| GeostatSectionShell (brand) | `src/components/theme/` |
| AppChrome, Sidebar, Header | `src/components/layout/` |
| GDP page config (JSON) | `src/features/gdp/gdp.config.ts` |
| GDP DataStore | `src/features/gdp/gdp.store.ts` |
| Landing renderer | `src/features/landing/` |
| nav.config.ts | `src/data/nav.config.ts` |
| LandingHeroNode type | `src/features/landing/types.ts` |

---

## Extension Pattern — App Adds Node Types

```ts
// src/app/setupEngine.ts
engine.extend(nodeRegistry)
nodeRegistry.register('landing-page',  LandingPageRenderer)   // src/ renderer
nodeRegistry.register('landing-hero',  LandingHeroRenderer)
nodeRegistry.register('landing-stats', LandingStatsRenderer)

// engine knows these types at runtime
// engine/react/ NodeDef union does NOT include these — by design
// T extends { type: string } — any object with type field can register
```

---

## pagesRecord() — definition (J-7)

`pagesRecord()` is a Phase 1 helper in `src/data/site-manifest.ts` that assembles all hand-crafted page configs into a `Record<string, PageConfig>` for `SiteProvider`.

```ts
// src/data/site-manifest.ts

import { gdpPage }      from '../features/gdp/gdp.config'
import { accountsPage } from '../features/accounts/accounts.config'
import { regionalPage } from '../features/regional/regional.config'
import { landingPage }  from '../features/landing/landing.config'
import type { PageConfig } from '@geostat/react'

// Phase 1: hand-crafted pages assembled into keyed record
function pagesRecord(): Record<string, PageConfig> {
  return {
    [gdpPage.id]:      gdpPage,
    [accountsPage.id]: accountsPage,
    [regionalPage.id]: regionalPage,
    [landingPage.id]:  landingPage,
  }
}

// Used in fetchSiteManifest():
async function fetchSiteManifest(): Promise<SiteManifest> {
  return { stores: STORE_MANIFEST, pages: pagesRecord(), nav: NAV }
}
```

**Phase 2 swap:** `pagesRecord()` body becomes `fetch('/api/pages').then(r => r.json())`.
Call site (`fetchSiteManifest`) and `SiteProvider` — zero changes.

---

## Phase 2 Swap Points

```
pagesRecord()       — local assembly → fetch('/api/pages') → Record<id, PageConfig>
fetchSiteManifest() — static return  → fetch('/api/site-manifest')
NAV: NavItem[]      — src/data/nav.config.ts → fetched from API nav table
```

All swap points isolated in `src/data/`. `packages/` unchanged. `App.tsx` unchanged.
