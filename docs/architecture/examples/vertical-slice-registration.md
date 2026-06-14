# vertical-slice-registration.ts

> Reference example (TypeScript) — documentation, not compiled source.

```ts
/**
 * Example — Vertical Slice Registration Pattern
 *
 * Key concept: each node/chrome/filter-control type = one folder = one RegistrableSlice.
 * Each slice exports Shell + META (+ optional Skeleton).
 * Barrel files aggregate: `export * as <name> from './<folder>'`.
 * setupRegistrations.ts imports barrels → registerSlice() dispatches via META discriminant.
 *
 * Adding a new node:
 *   1. plugins/nodes/<type>/   — create folder + Shell + META + optional Skeleton
 *   2. plugins/nodes/index.ts  — ONE LINE: export * as myType from './<type>'
 *   Done — zero changes to setupRegistrations.ts, zero changes to any other file.
 *   TypeScript validates at compile time. tsc --noEmit → 0 errors.
 *
 * Why barrel over import.meta.glob:
 *   import.meta.glob<T>() = TYPE ASSERTION, not a type check.
 *   Missing Shell export or wrong META shape → runtime crash, not compile error.
 *   `export * as name from '...'` = TypeScript validates at compile time. ✅
 *
 * Platform precedents:
 *   Grafana:    src/plugins/<type>/module.ts — explicit entry, self-contained
 *   Backstage:  createPlugin({ id, apis }) — explicit registration, no magic
 *   WordPress:  blocks/<name>/index.ts — explicit registerBlockType()
 *
 * 4-Layer architecture:
 *   packages/    — platform foundation (defaults only in react/)
 *   plugins/     — plugin library: generic, token-driven shells (this file's territory)
 *   app/         — developer usage (Mode A: JSON | Mode B: direct React)
 *   src/         — bootstrap only (5–6 files)
 */

import type { ReactNode, ComponentType }           from 'react'
import type { NodeRenderer, NodeRegistryMeta, ChromeMeta, LayoutHints } from '@geostat/react'
import { nodeRegistry, chromeRegistry, NullChromeSlot }                from '@geostat/react'
import { engine, HttpDataStore }                                        from '@geostat/engine'
import { fromSDMX }                                                     from '@geostat/engine'

type SkeletonFn = (ctx: { layout?: LayoutHints }) => ReactNode

declare function identity(x: unknown): unknown
declare function accountSequenceResolver(...args: unknown[]): unknown
declare const filterControlRegistry: {
  register(controlType: string, component: ComponentType<any>, meta?: FilterControlSliceMeta): void
}


// ═══════════════════════════════════════════════════════════════════════════
// 1. RegistrableSlice types
// ═══════════════════════════════════════════════════════════════════════════
//
// Three registries → three META shapes, discriminated by a unique property:
//   'type'        ∈ NodeSliceMeta          → nodeRegistry
//   'slot'        ∈ ChromeSliceMeta        → chromeRegistry
//   'controlType' ∈ FilterControlSliceMeta → filterControlRegistry
//
// Mutually exclusive: no META has more than one discriminant property.
// Type guards narrow Shell type in each branch — no `any` casts.

interface NodeSliceMeta extends NodeRegistryMeta {
  type:     string    // nodeRegistry key — matches NodeDef.type
  variant?: string    // 'default' if omitted — matches NodeDef.variant
}

interface ChromeSliceMeta extends ChromeMeta {
  slot: string        // chromeRegistry slot name ('AppHeader', 'AppSidebar', ...)
  key:  string        // variant key within slot ('default', 'minimal', 'hidden', ...)
}

interface FilterControlSliceMeta {
  controlType: string // filterControlRegistry key — matches ParamDef.type
  label?:      string
}

// Shell contract differs per registry — ISP enforced:
//   Node:          NodeRenderer  = (def, ctx, children) => ReactNode
//   Chrome:        () => ReactNode  (zero props — data via hooks)
//   FilterControl: ComponentType<FilterControlProps>

interface NodeSlice {
  Shell:     NodeRenderer         // (def, ctx, children) => ReactNode — plain fn, not React component
  Skeleton?: SkeletonFn           // separate export — NOT in META (function, not JSON-serializable)
  META:      NodeSliceMeta        // pure JSON — JSON.parse(JSON.stringify(META)) === META ✅
}

interface ChromeSlice {
  Shell: () => ReactNode          // CRITICAL: zero props — called with no arguments
  META:  ChromeSliceMeta
}

interface FilterControlSlice {
  Shell: ComponentType<any>
  META:  FilterControlSliceMeta
}

type RegistrableSlice = NodeSlice | ChromeSlice | FilterControlSlice

// Type guards — runtime dispatch + TypeScript narrowing:
const isNodeSlice    = (s: RegistrableSlice): s is NodeSlice          => 'type'        in s.META
const isChromeSlice  = (s: RegistrableSlice): s is ChromeSlice        => 'slot'        in s.META
const isControlSlice = (s: RegistrableSlice): s is FilterControlSlice => 'controlType' in s.META


// ═══════════════════════════════════════════════════════════════════════════
// 2a. Node slice — plugins/nodes/section/index.ts
// ═══════════════════════════════════════════════════════════════════════════

// import { SectionShell    } from './SectionShell'
// import { SectionSkeleton } from './SectionSkeleton'
//
// export { SectionShell    as Shell    }
// export { SectionSkeleton as Skeleton }   // ← separate from META (fn, not JSON)
// export const META: NodeSliceMeta = {
//   type:     'section',
//   variant:  'default',
//   label:    'სექცია',
//   icon:     'layout-section',
//   category: 'layout',
//   schema: {                              // ← Constructor reads → builds form editor
//     type: 'object',
//     properties: {
//       view: { type: 'object', properties: {
//         subtitle:   { type: 'string' },
//         hero:       { type: 'boolean' },
//         exportable: { type: 'boolean' },
//       }}
//     }
//   },
//   preview: '/previews/section.png',      // ← Constructor palette thumbnail
// }
// // META is JSON-serializable: JSON.parse(JSON.stringify(META)) === META ✅
// // Skeleton is a function — registerSlice adds it to registration separately


// ═══════════════════════════════════════════════════════════════════════════
// 2b. Variant slice — plugins/nodes/container-page/
// ═══════════════════════════════════════════════════════════════════════════
//
// Same type, different variant = separate slice = separate barrel entry.
// No if/switch. Table dispatch: nodeRegistry.get('container-page', 'landing').

// plugins/nodes/container-page/default/index.ts:
// export { DefaultContainerLayout as Shell }
// export const META: NodeSliceMeta = {
//   type: 'container-page', variant: 'default',
//   label: 'კონტეინერი', icon: 'grid', category: 'page',
// }

// plugins/nodes/container-page/landing/index.ts:
// export { GeostatLandingShell as Shell }
// export const META: NodeSliceMeta = {
//   type: 'container-page', variant: 'landing',
//   label: 'Landing Page',  icon: 'home', category: 'page',
// }
// Config:  { type: 'container-page', variant: 'landing', ... }
// Engine:  nodeRegistry.get('container-page', 'landing') → GeostatLandingShell ✅


// ═══════════════════════════════════════════════════════════════════════════
// 2c. Chrome slice — plugins/chrome/AppHeader/
// ═══════════════════════════════════════════════════════════════════════════
//
// Shell: () => ReactNode — ZERO PROPS (chromeRegistry calls with no args).
// Data inside component via: useSiteNav(), useLocation(), useSiteChrome().
// NullChromeSlot: pre-built () => null for 'hidden' variant.

// plugins/chrome/AppHeader/default/index.ts:
// export { FullHeader as Shell }
// export const META: ChromeSliceMeta = {
//   slot: 'AppHeader', key: 'default',
//   label: 'სრული სათაური', preview: '/previews/header-full.png',
// }

// plugins/chrome/AppSidebar/hidden/index.ts:
// import { NullChromeSlot } from '@geostat/react'
// export { NullChromeSlot as Shell }  // ← no component file needed
// export const META: ChromeSliceMeta = {
//   slot: 'AppSidebar', key: 'hidden', label: 'გამოთიშული',
// }
// manifest.chrome.AppSidebar = 'hidden' → null rendered → no sidebar ✅


// ═══════════════════════════════════════════════════════════════════════════
// 2d. Filter control slice — plugins/controls/year-select/index.ts
// ═══════════════════════════════════════════════════════════════════════════

// export { YearSelectControl as Shell }
// export const META: FilterControlSliceMeta = {
//   controlType: 'year-select',  // ← matches { type: 'year-select' } in FilterBarNode.bars
//   label: 'წელი',
// }


// ═══════════════════════════════════════════════════════════════════════════
// 2e. Feature node slice — plugins/landing/nodes/hero/index.ts
// ═══════════════════════════════════════════════════════════════════════════
//
// Module augmentation in plugins/landing/types.ts:
//   declare module '@geostat/react' {
//     interface NodeTypeMap { 'landing-hero': LandingHeroNode }
//   }
// → LandingHeroNode ∈ NodeDef ✅ (no cast, no packages/ change)

// import { LandingHeroRenderer } from './LandingHeroRenderer'
// export { LandingHeroRenderer as Shell }
// export const META: NodeSliceMeta = {
//   type: 'landing-hero', variant: 'default',
//   label: 'ჰირო სექცია', icon: 'home', category: 'landing',
//   schema: { ... }, preview: '/previews/hero.png',
// }


// ═══════════════════════════════════════════════════════════════════════════
// 3a. Node barrel — plugins/nodes/index.ts (exact content)
// ═══════════════════════════════════════════════════════════════════════════

// export * as section              from './section'
// export * as chart                from './chart'
// export * as table                from './table'
// export * as kpiStrip             from './kpi-strip'
// export * as filterBar            from './filter-bar'
// export * as innerPage            from './inner-page'
// export * as tabPage              from './tab-page'
// export * as containerPageDefault from './container-page/default'
// export * as containerPageLanding from './container-page/landing'
// // ← add new node type here (1 line)   ← DISCOVERABILITY


// ═══════════════════════════════════════════════════════════════════════════
// 3b. Chrome barrel — plugins/chrome/index.ts (exact content)
// ═══════════════════════════════════════════════════════════════════════════

// export * as appHeaderDefault    from './AppHeader/default'
// export * as appHeaderMinimal    from './AppHeader/minimal'
// export * as appHeaderCompact    from './AppHeader/compact'
// export * as appSidebarDefault   from './AppSidebar/default'
// export * as appSidebarCollapsed from './AppSidebar/collapsed'
// export * as appSidebarHidden    from './AppSidebar/hidden'
// export * as appFooterDefault    from './AppFooter/default'
// export * as appFooterMinimal    from './AppFooter/minimal'
// // ← add new chrome variant here (1 line)   ← DISCOVERABILITY


// ═══════════════════════════════════════════════════════════════════════════
// 3c. Controls barrel — plugins/controls/index.ts (exact content)
// ═══════════════════════════════════════════════════════════════════════════

// export * as yearSelect  from './year-select'
// export * as cascade     from './cascade'
// export * as select      from './select'
// export * as range       from './range'
// export * as multiSelect from './multi-select'
// // ← add new control type here (1 line)   ← DISCOVERABILITY


// ═══════════════════════════════════════════════════════════════════════════
// 3d. Landing barrel — plugins/landing/nodes/index.ts (exact content)
// ═══════════════════════════════════════════════════════════════════════════

// export * as hero  from './hero'
// export * as stats from './stats'
// // ← add new landing node here (1 line)


// ═══════════════════════════════════════════════════════════════════════════
// 4. setupRegistrations — src/setupRegistrations.ts
// ═══════════════════════════════════════════════════════════════════════════
//
// Called ONCE in src/main.tsx before createRoot.
// DISCOVERABILITY RULE: all registrations via barrels, none in slice files.
// tsc --noEmit → 0 errors — TypeScript validates all slice exports at compile time.

declare const Nodes:        Record<string, NodeSlice>
declare const Chrome:       Record<string, ChromeSlice>
declare const Controls:     Record<string, FilterControlSlice>
declare const LandingNodes: Record<string, NodeSlice>

// import * as Nodes        from '../plugins/nodes'
// import * as Chrome       from '../plugins/chrome'
// import * as Controls     from '../plugins/controls'
// import * as LandingNodes from '../plugins/landing/nodes'
// import { accountSequenceResolver } from '../app/data/accounts/account-sequence'

export function setupRegistrations() {

  ;[
    ...Object.values(Nodes),
    ...Object.values(Chrome),
    ...Object.values(Controls),
    ...Object.values(LandingNodes),
    // ← new feature domain: import * as FooNodes from '../plugins/foo/nodes'
    //                        ...Object.values(FooNodes)  (2 lines total)
  ].forEach(registerSlice)

  // engine extensions (not registrable slices — called directly):
  engine.extendSpec('account-sequence', accountSequenceResolver)
  engine.registerTransform('fromSDMX', fromSDMX)
  engine.registerTransform('raw',      identity)
  engine.registerBuiltinStore('http',  new HttpDataStore())
}

// Pure dispatch — TypeScript narrows Shell type in each branch:
function registerSlice(mod: RegistrableSlice): void {
  if (isNodeSlice(mod)) {
    nodeRegistry.register(
      mod.META.type,
      mod.META.variant ?? 'default',
      mod.Shell,
      {
        ...mod.META,
        ...(mod.Skeleton && { skeleton: mod.Skeleton }),
        // Skeleton = function, NOT in META (META must be JSON-serializable).
        // registerSlice adds it here → nodeRegistry has the skeleton fn.
        // Constructor stores META in DB — functions cannot round-trip JSON.stringify.
      }
    )
  } else if (isChromeSlice(mod)) {
    chromeRegistry.register(mod.META.slot, mod.META.key, mod.Shell, mod.META)
  } else if (isControlSlice(mod)) {
    filterControlRegistry.register(mod.META.controlType, mod.Shell, mod.META)
  }
}
// Discriminants:
//   'type'        in mod.META → NodeSlice          → nodeRegistry.register(type, variant, Shell)
//   'slot'        in mod.META → ChromeSlice        → chromeRegistry.register(slot, key, Shell)
//   'controlType' in mod.META → FilterControlSlice → filterControlRegistry.register(ctrl, Shell)


// ═══════════════════════════════════════════════════════════════════════════
// 5. Constructor ↔ extensions — they know each other
// ═══════════════════════════════════════════════════════════════════════════

// plugins/ → Constructor (via registries):
//
// const palette = nodeRegistry.list()
// // → [
// //   { type:'section', variant:'default', label:'სექცია', icon:'layout-section',
// //     category:'layout', schema:{...}, preview:'/previews/section.png' },
// //   { type:'chart',   variant:'default', label:'გრაფიკი', ... },
// //   { type:'landing-hero', label:'ჰირო', ... },
// // ]
//
// const formSchema = nodeRegistry.getSchema('section')
// // → JSON Schema → Constructor renders form sidebar for this node type
//
// const chromePalette = {
//   AppHeader:  chromeRegistry.list('AppHeader'),
//   // → [{ key:'default', label:'სრული' }, { key:'minimal' }, { key:'compact' }]
//   AppSidebar: chromeRegistry.list('AppSidebar'),
//   // → [{ key:'default' }, { key:'collapsed' }, { key:'hidden', label:'გამოთიშული' }]
// }
//
// Constructor → app/pages/ (Phase 1) or DB (Phase 2):
// const nodeDef = {
//   type: 'section', variant: 'default',  // user dragged from palette
//   data: { type: 'timeseries', indicator: 'B1G' },
//   children: [...]
// }
// JSON.parse(JSON.stringify(nodeDef)) === nodeDef ✅
// Constructor saves to DB → fetchSiteManifest() returns it → SiteRenderer renders it


// ═══════════════════════════════════════════════════════════════════════════
// 6. New node workflow — step by step (example: 'sparkline')
// ═══════════════════════════════════════════════════════════════════════════

// Step 1: plugins/nodes/sparkline/
//   SparklineShell.tsx      — NodeRenderer<SparklineNode>
//   SparklineSkeleton.tsx   — optional
//   index.ts:
//     export { SparklineShell    as Shell    }
//     export { SparklineSkeleton as Skeleton }
//     export const META: NodeSliceMeta = {
//       type: 'sparkline', variant: 'default',
//       label: 'სპარკლაინი', icon: 'trending-up', category: 'data',
//       schema: { ... }, preview: '/previews/sparkline.png',
//     }
//
// Step 2: plugins/nodes/index.ts — ONE LINE:
//   export * as sparkline from './sparkline'
//
// Step 3 (if new type): module augmentation in plugins/sparkline/types.ts:
//   declare module '@geostat/react' {
//     interface NodeTypeMap { 'sparkline': SparklineNode }
//   }
//
// Done:
//   setupRegistrations.ts: unchanged ✅
//   Constructor palette:   auto-updated (nodeRegistry.list() includes sparkline) ✅
//   tsc --noEmit:          validates NodeRenderer<SparklineNode> ✅
//   JSON.parse(JSON.stringify(META)) === META: ✅


// ═══════════════════════════════════════════════════════════════════════════
// 7. Anti-patterns
// ═══════════════════════════════════════════════════════════════════════════

// ❌ import.meta.glob:
//    const mods = import.meta.glob<RegistrableSlice>('../nodes/**/index.ts', { eager: true })
//    → type assertion, not check → wrong META → runtime crash
//    ✅ barrel: export * as section from './section' → tsc validates

// ❌ side-effect registration in slice file:
//    nodeRegistry.register('section', 'default', SectionShell) // in Shell file!
//    → unpredictable order, not discoverable
//    ✅ ALL register() calls via src/setupRegistrations.ts → registerSlice()

// ❌ function in META:
//    export const META = { type: 'section', skeleton: (ctx) => <Skeleton /> }
//    → NOT JSON-serializable → Constructor DB storage fails
//    ✅ export { SectionSkeleton as Skeleton }  (separate named export)
//       registerSlice adds { skeleton: mod.Skeleton } → nodeRegistry has fn, META stays JSON

// ❌ chrome component with props:
//    function FullHeader({ nav }: { nav: NavItem[] }) { ... }
//    → chromeRegistry.get(slot, key)() → no args → crash
//    ✅ function FullHeader() { const nav = useSiteNav() }

// ❌ app content in packages/:
//    engine/react/src/engine/types.ts: interface NodeTypeMap { 'landing-hero': ... }
//    → agnosticism violation
//    ✅ module augmentation in plugins/landing/types.ts → packages/ zero change
```
