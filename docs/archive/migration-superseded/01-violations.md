# Current Violations — Priority Order

> ეს არის ის, რაც ახლა კოდში არასწორია და უნდა გამოსწორდეს.
> Priority = სერიოზულობა + dependency სხვა fixes-ზე.

---

## P0 — TypeScript Violations (tsc errors will appear after type updates)

### V-1: NodeRegistry constraint

```ts
// CURRENT (wrong):
class NodeRegistry {
  register<T extends NodeDef>(type: string, renderer: NodeRenderer<T>): void
}

// CORRECT:
class NodeRegistry {
  register<T extends { type: string }>(type: string, renderer: NodeRenderer<T>): void
}
```
**Impact:** App cannot register `LandingHeroRenderer` (LandingHeroNode ∉ NodeDef).
**File:** `engine/react/src/engine/nodeRegistry.ts`
**Risk:** TypeScript only. Zero visual change. Safe first step.

---

## P1 — Wrong Layer (app code in engine/react/)

### V-2: Landing code in engine/react/

Any landing-specific code (LandingHeroNode, LandingStatsNode types, landing renderers) in `engine/react/` is a violation.

```
engine/react/src/... — any landing-* Shell files
→ MOVE TO: plugins/landing/nodes/hero/HeroShell.tsx
           plugins/landing/nodes/stats/StatsShell.tsx

engine/react/src/... — LandingHeroNode / LandingStatsNode type declarations
→ MOVE TO: plugins/landing/types.ts  (module augmentation on NodeTypeMap)
```

**Why violation:** engine/react/ = zero app content. Landing is Geostat-specific.
**Correct destination:** plugins/ — all registrable slices live here. src/ is bootstrap only.
**Impact:** engine/react/ not reusable on other projects.

### V-3: Chrome components in engine/react/

AppChrome, Sidebar, Header, Footer in engine/react/ are violations.

```
engine/react/src/components/layout/AppChrome.tsx  → plugins/chrome/AppChrome.tsx
engine/react/src/components/layout/Header.tsx     → plugins/chrome/AppHeader/default/FullHeader.tsx
engine/react/src/components/layout/Sidebar.tsx    → plugins/chrome/AppSidebar/default/ExpandedSidebar.tsx
engine/react/src/components/layout/Footer.tsx     → plugins/chrome/AppFooter/default/FullFooter.tsx
```

**Why violation:** AppChrome uses Geostat identity. engine/react/ = zero brand.
**Correct destination:** plugins/chrome/ — all chrome registrable slices live here.
**Impact:** engine/react/ not reusable on other projects. AppChrome exposes Geostat slot names into platform layer.

---

## P2 — Wrong Import Pattern

### V-4: SectionRenderer imports SectionBlock directly

```ts
// CURRENT (wrong):
import { SectionBlock } from '../components/SectionBlock'
function SectionRenderer(def, ctx, children) {
  return <SectionBlock def={def} children={children.rendered} />
}

// CORRECT:
function SectionRenderer(def, ctx, children) {
  const Shell = ctx.theme.shells['section'] ?? DEFAULT_THEME.shells['section']!
  return <Shell def={def} children={children} />
}
```
**File:** `engine/react/src/engine/renderers/SectionRenderer.tsx`

### V-5: Any renderer in engine/react/ directly imports src/ component

```ts
// CURRENT pattern (wrong — any renderer doing this):
import { GeostatXxx } from '../../../../src/components/...'

// CORRECT:
const Shell = ctx.theme.shells['type'] ?? DEFAULT_THEME.shells['type']!
```

---

## P3 — Wrong Type Definition

### V-6: NodeDef union contains app-specific types

```ts
// CURRENT (wrong):
type NodeDef = ... | LandingHeroNode | LandingStatsNode

// CORRECT:
type NodeDef =
  | SectionNode | ChartNode | TableNode | FilterBarNode | KpiStripNode
  | InnerPageNode | TabPageNode | ContainerPageNode
  // LandingHeroNode → src/features/landing/types.ts
  // LandingStatsNode → src/features/landing/types.ts
```
**File:** `engine/react/src/engine/types.ts`

---

## P4 — Stale Registrations

### V-7: engine.extend() with two args

```ts
// CURRENT (wrong):
engine.extend(nodeRegistry, slotRegistry)

// CORRECT:
engine.extend(nodeRegistry)
```
**File:** `src/app/setupEngine.ts`

### V-8: SlotRegistry still exists

```
engine/react/src/engine/slotRegistry.ts  → DELETE
```
Agreement #18: SlotRegistry removed. layout.position + CSS replaces.

### V-9: SlotWrapper still exists

```
engine/react/src/engine/wrappers/FilterBarWrapper.tsx  → DELETE
engine/react/src/engine/wrappers/SectionsWrapper.tsx   → DELETE
```

### V-10: renderSlots() still called

```ts
// CURRENT (wrong):
renderSlots(nodeRegistry, slotRegistry, root, ctx)

// CORRECT:
engine.renderNode(root, ctx)
```

---

## P5 — Architectural Inconsistencies

### V-11: ctx.store (single store)

```ts
// CURRENT (wrong):
ctx.store: DataStore

// CORRECT:
ctx.stores: Record<string, DataStore>
```
**File:** `engine/react/src/engine/types.ts` (RenderContext)

### V-12: PageConfig.nav field

```ts
// CURRENT (wrong):
interface PageConfigBase { nav: NavItemDef; ... }

// CORRECT:
interface PageConfigBase { /* no nav field */ }
// Nav lives in src/data/nav.config.ts
```

### V-13: SiteProvider missing pages prop

```ts
// CURRENT (wrong):
<SiteProvider stores={storeManifest}>

// CORRECT:
<SiteProvider stores={manifest.stores} pages={manifest.pages} nav={manifest.nav}>
```

### V-14: SectionNode has chart?/table? named fields

```ts
// CURRENT (wrong):
interface SectionNode { chart?: ChartNode; table?: TableNode; ... }

// CORRECT:
interface SectionNode { children: NodeDef[]; ... }
// chart/table as children with layout.role
```
Agreement #16.

### V-15: DeriveMap as Record

```ts
// CURRENT (wrong):
type DeriveMap = Record<string, ExprVal>

// CORRECT:
type DeriveMap = Array<{ key: string; expr: ExprVal }>
```
Agreement I-5.

---

## Violation Count Summary

| Priority | Count | Description |
|----------|-------|-------------|
| P0 | 1 | TypeScript constraint |
| P1 | 2 | Wrong layer |
| P2 | 2 | Wrong import |
| P3 | 1 | Wrong union |
| P4 | 4 | Stale registrations |
| P5 | 5 | Architectural inconsistencies |

**Total: 15 violations** across 5 priority levels.

→ See `migration/02-strangler-fig.md` for the fix order.
