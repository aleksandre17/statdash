
# Pre-Flight — What a New Session Must Know Before Migrating

> Architecture leads. Codebase follows. (→ decisions/05-architecture-mandate.md)
> This file covers only what is NOT derivable from the codebase or other docs.

---

## Phase 1 Backend Constraints — Do NOT Touch

These look like violations. They are NOT. They are **intentional Phase 1 compromises**
agreed with the backend team. Phase 2 backend integration removes them.

### 1. `fromSDMX` — CODE_MAP

```ts
// src/data/accounts/adapter.ts
const CODE_MAP: Record<string, string> = { 'B1g': 'B1G', 'B2g+B3g': 'B2G', ... }
measure: CODE_MAP[o.dims.measure] ?? o.dims.measure
```

**Leave as-is.** Phase 2: backend sends canonical SNA codes (`B1G` not `B1g`) → CODE_MAP removed then.

### 2. `fromSDMX` — isCarryForward computation

```ts
// Phase 1: frontend computes SNA rule
const isCarryForward = o.dims.isBalancing === 1 && o.dims.side === 'R' && ... ? 1 : 0
```

**Leave as-is.** Phase 2: backend sends `isCarryForward: 0|1` directly → computation removed then.

---

## What Does NOT Exist Yet (create from scratch)

| File | Step |
|------|------|
| `engine/react/src/engine/theme.ts` — ThemeConfig + DEFAULT_THEME | ② |
| `engine/react/src/context/SiteContext.tsx` — SiteProvider + useStores + useSiteNav + usePageById | ② |
| `engine/react/src/engine/renderNode.ts` — engine.renderNode() (if not exists) | ② |
| `src/app/theme.ts` — GEOSTAT_THEME base (shells added per step) | ② |
| `src/data/nav.config.ts` — NavItem[] | ⑤ |
| `src/data/site-manifest.ts` — SiteManifest | ⑤ |
| `src/components/theme/GeostatInnerPageShell.tsx` | ④ |
| `src/components/theme/GeostatTabPageShell.tsx` | ④ |
| `src/components/theme/GeostatContainerPageShell.tsx` | ④ |
| `src/components/theme/GeostatSectionShell.tsx` | ⑦ |
| `src/components/theme/GeostatChartShell.tsx` | ⑧ |
| `src/components/theme/GeostatTableShell.tsx` | ⑧ |
| `src/components/theme/GeostatFilterBarShell.tsx` | ⑧ |
| `src/components/theme/GeostatKpiCard.tsx` | ⑧ |
| `src/features/landing/types.ts` | 🗂 |
