# theme-config.md

> Reference example (TypeScript) — documentation, not compiled source.

```ts
/**
 * Example — ThemeConfig + Chrome + Testing + Scoped Overrides (E-4 + E-5 + Gap 4)
 *
 * New architecture: component dispatch moved from ThemeConfig to registries.
 *   OLD: GEOSTAT_THEME.shells['section'] = GeostatSectionShell  (static map)
 *   NEW: nodeRegistry.register('section', 'default', GeostatSectionShell)  (variant-aware table)
 *
 * Patterns documented here:
 *   1. setupRegistrations.ts — barrel import pattern (see vertical-slice-registration.ts §4)
 *   2. CSS layers            — import order: base.css → tokens → per-shell
 *   3. ThemeConfig usage     — skeletons only (no shells/chrome)
 *   4. Chrome dispatch       — chromeRegistry.get(slot, key) in AppChrome
 *   5. Constructor palette   — nodeRegistry.list() + chromeRegistry.list()
 *   6. Testing               — createTestRegistryProvider for isolated instances
 *   7. Scoped overrides      — ShellOverrideProvider for print/embed (no global mutation)
 *
 * Platform precedents:
 *   Grafana:    plugin registry — PanelPlugin registered once, palette auto-updates
 *   WordPress:  registerBlockStyle(type, { name, label }) — variant-aware, no dispatch map
 *   Backstage:  TestApiRegistry.from() — factory for isolated test instances
 *   Single-SPA: shell (chrome) vs feature (content) — separate registries by design
 */

import type {
  ThemeConfig,
  NodeRenderer, NodeRegistryMeta, ChromeMeta,
  NavItem,
  ReactNode,
} from '@geostat/react'
import {
  DEFAULT_THEME, mergeTheme,
  nodeRegistry, chromeRegistry,
  createNodeRegistry, createChromeRegistry,
  createTestRegistryProvider,
  ShellOverrideProvider,
} from '@geostat/react'
import { useSiteNav, useSiteChrome } from '@geostat/react'
import { useLocation }   from 'react-router-dom'
import { NavLink }       from 'react-router-dom'
import { engine, HttpDataStore } from '@geostat/engine'
import { fromSDMX }              from '@geostat/engine'

// ── Barrel imports — all registrable slices ────────────────────────────────
// Barrel pattern = each slice is a folder with index.ts (Shell + META).
// Barrels aggregate slices: export * as section from './section' etc.
// Full documentation: examples/vertical-slice-registration.md
import * as Nodes        from '../plugins/nodes'            // all system node slices
import * as Chrome       from '../plugins/chrome'           // all chrome slot variants
import * as Controls     from '../plugins/controls'         // all filter control types
import * as LandingNodes from '../plugins/landing/nodes'   // feature-specific nodes

// ── Print shells — scoped overrides, not in registration barrels ───────────
import { PrintSectionShell } from '../plugins/nodes/section/PrintSectionShell'
import { PrintChartShell }   from '../plugins/nodes/chart/PrintChartShell'

// ── Brand skeleton — co-located with its node slice ───────────────────────
import { KpiStripSkeleton } from '../plugins/nodes/kpi-strip'

// ── Types for registerSlice (defined in vertical-slice-registration.ts) ───
declare interface NodeSliceMeta    extends NodeRegistryMeta { type: string; variant?: string }
declare interface ChromeSliceMeta  extends ChromeMeta       { slot: string; key: string }
declare interface FilterControlSliceMeta                    { controlType: string; label?: string }
declare interface NodeSlice    { Shell: NodeRenderer;          Skeleton?: Function; META: NodeSliceMeta }
declare interface ChromeSlice  { Shell: () => ReactNode;       META: ChromeSliceMeta }
declare interface ControlSlice { Shell: React.ComponentType;   META: FilterControlSliceMeta }
declare type RegistrableSlice = NodeSlice | ChromeSlice | ControlSlice
declare const isNodeSlice:    (s: RegistrableSlice) => s is NodeSlice
declare const isChromeSlice:  (s: RegistrableSlice) => s is ChromeSlice
declare const isControlSlice: (s: RegistrableSlice) => s is ControlSlice
declare const filterControlRegistry: { register(t: string, c: any, m?: any): void }
declare function identity(x: unknown): unknown
declare function accountSequenceResolver(...args: unknown[]): unknown

// declare to satisfy type check in this example file:
declare namespace React { type ComponentType = any }
declare function DefaultSectionSkeleton(props: { span?: string }): unknown


// ═══════════════════════════════════════════════════════════════════════════
// setupRegistrations — barrel pattern (discoverability rule)
// ═══════════════════════════════════════════════════════════════════════════
//
// Called once, before ReactDOM.createRoot, in main.tsx.
// DISCOVERABILITY RULE: all registrations come via barrels — no individual Shell imports.
// Adding a new node:    create folder + index.ts + 1 line in src/nodes/index.ts.
// Adding a new chrome:  create folder + index.ts + 1 line in src/chrome/index.ts.
// TypeScript validates all slice exports at compile time. tsc --noEmit → 0 errors.
//
// Full barrel documentation: examples/vertical-slice-registration.md
//
// src/app/setupRegistrations.ts:

export function setupRegistrations() {

  // ── All registrable slices — 4 barrel imports cover every registration ────
  //
  // registerSlice dispatches via META discriminant:
  //   'type' in META        → nodeRegistry.register(type, variant, Shell, meta)
  //   'slot' in META        → chromeRegistry.register(slot, key, Shell, meta)
  //   'controlType' in META → filterControlRegistry.register(controlType, Shell, meta)
  //
  // Object.values(Nodes) = [ section slice, chart slice, table slice, ... ]
  // Each value = { Shell, Skeleton?, META } — TypeScript validated by barrel export type.

  ;[
    ...Object.values(Nodes),
    ...Object.values(Chrome),
    ...Object.values(Controls),
    ...Object.values(LandingNodes),
    // ← add new feature domain barrel here (import + 1 spread line)
  ].forEach(registerSlice)

  // ── Non-slice registrations (no META, no registry dispatch needed) ────────
  engine.extendSpec('account-sequence', accountSequenceResolver)
  engine.registerTransform('fromSDMX', fromSDMX)
  engine.registerTransform('raw',      identity)
  engine.registerBuiltinStore('http',  new HttpDataStore())
}

// registerSlice — pure dispatch on META discriminant (see vertical-slice-registration.ts §4)
function registerSlice(mod: RegistrableSlice): void {
  if (isNodeSlice(mod)) {
    nodeRegistry.register(
      mod.META.type,
      mod.META.variant ?? 'default',
      mod.Shell as NodeRenderer,
      { ...mod.META, ...(mod.Skeleton && { skeleton: mod.Skeleton }) }
    )
  } else if (isChromeSlice(mod)) {
    chromeRegistry.register(mod.META.slot, mod.META.key, mod.Shell, mod.META)
  } else if (isControlSlice(mod)) {
    filterControlRegistry.register(mod.META.controlType, mod.Shell, mod.META)
  }
}


// ═══════════════════════════════════════════════════════════════════════════
// AppChrome — registry dispatch (no if/switch, no static map)
// ═══════════════════════════════════════════════════════════════════════════
//
// Old pattern: const { chrome } = useTheme()  → ChromeMap dispatch (static, compiled in)
// New pattern: chromeRegistry.get(slot, key)  → pure table lookup (data-driven, JSON-controlled)
//
// AppChrome.tsx — reads SiteManifest.chrome → resolves active variants from chromeRegistry.

export function AppChrome({ children }: { children: ReactNode }) {
  const chromeConfig = useSiteChrome()   // SiteManifest.chrome from SiteContext

  // Pure table lookups — no if/switch. Unknown key → undefined → engine uses 'default'.
  const Header  = chromeRegistry.get('AppHeader',  chromeConfig?.['AppHeader']  ?? 'default')
  const Sidebar = chromeRegistry.get('AppSidebar', chromeConfig?.['AppSidebar'] ?? 'default')
  const Footer  = chromeRegistry.get('AppFooter',  chromeConfig?.['AppFooter']  ?? 'default')

  // Optional custom slots (Phase 2):
  const Banner = chromeRegistry.get('AppBanner', chromeConfig?.['AppBanner'] ?? 'default')

  return (
    <div className="app-shell">
      {Header  && <Header  />}
      {Banner  && <Banner  />}   {/* optional — renders only if registered */}
      <main className="app-main">{children}</main>
      {Sidebar && <Sidebar />}
      {Footer  && <Footer  />}
    </div>
  )
}

// Why this is correct:
//   chrome key in DB = 'minimal'  → Header = GeostatMinimalHeader  ✅ (no code change)
//   chrome key absent             → Header = GeostatFullHeader      ✅ (default fallback)
//   unregistered key              → Header = undefined              → nothing renders (fail visible)
//
// No if/switch in AppChrome.
// No static ChromeMap compiled into the binary.
// Constructor changes manifest.chrome → next fetchSiteManifest() → different variant. ✅


// ═══════════════════════════════════════════════════════════════════════════
// Chrome — GeostatFullHeader reference implementation
// ═══════════════════════════════════════════════════════════════════════════
//
// Contract: () => ReactNode — ZERO PROPS.
// Data from hooks — useSiteNav(), useLocation().
// chromeRegistry calls component with no args: chromeRegistry.get(slot, key)?.()
//
// Why zero props:
//   Chrome components = singletons per slot. No external data contract.
//   Everything needed comes from SiteContext (useSiteNav) and router (useLocation).
//   If Chrome needed props, AppChrome would have to know them → coupling violation.

export function FullHeader() {
  const nav          = useSiteNav()           // NavItem[] from SiteProvider
  const { pathname } = useLocation()

  const visibleNav = nav.filter((n: NavItem) => !n.hidden)

  return (
    <header className="geostat-header" role="banner">
      <div className="header-brand">
        <img src="/logo.svg" alt="Geostat" />
        <span className="header-title">ეროვნული ანგარიშები</span>
      </div>
      <nav className="header-nav" aria-label="მთავარი ნავიგაცია">
        {visibleNav.map((item: NavItem) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }: { isActive: boolean }) =>
              `nav-link ${isActive ? 'nav-link--active' : ''}`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </header>
  )
}
// Actual export lives in ../chrome/AppHeader/default/GeostatFullHeader.tsx
// () => ReactNode — zero props — exactly matching chromeRegistry component contract.


// ═══════════════════════════════════════════════════════════════════════════
// CSS layers — import order (E-5)
// ═══════════════════════════════════════════════════════════════════════════
//
// Three-layer CSS architecture. Import order in main.tsx:
//
//   import '@geostat/react/styles'          // Layer 1 — base.css (brand-free)
//   import './shared/styles/tokens.css'     // Layer 2 — design tokens (exists)
//
//   // Per-shell CSS imported inside each GeostatShell component:
//   // import './GeostatSectionShell.css'    // inside GeostatSectionShell.tsx
//   // import './GeostatChartShell.css'      // inside GeostatChartShell.tsx  etc.
//
// Layer 1 — engine/react/src/styles/base.css:
//   @layer base { .node-slot { display: contents } }     // grid pass-through
//   @layer skeleton { @keyframes skeleton-shimmer; .node-skeleton { ... } }
//   // No brand colors. No Geostat typography. Structural + shimmer only.
//
// Layer 2 — src/shared/styles/tokens.css (already exists):
//   :root { --color-primary: ...; --space-4: ...; ... }
//
// Layer 3 — per-shell CSS, co-located with each shell component.


// ═══════════════════════════════════════════════════════════════════════════
// ThemeConfig — skeletons only
// ═══════════════════════════════════════════════════════════════════════════
//
// ThemeConfig no longer contains shells or chrome (moved to registries).
// Use mergeTheme only when brand skeleton treatment differs from type default.
//
// Three-level skeleton resolution (renderNode — per-node):
//   1. ctx.theme.skeletons?.[node.type]          ← brand override (ThemeConfig, here)
//   2. nodeRegistry.getMeta(node.type)?.skeleton ← type default  (setupRegistrations)
//   3. generic <div className="node-skeleton node-skeleton--{type}" />  ← engine
//
// Level 2 preferred: skeleton co-located with renderer registration (discoverability).
// Level 1 (here) only needed when brand skeleton DIFFERS from registered type default.

// ── Level 2 example — skeleton registered in setupRegistrations ───────────
// Already shown above in setupRegistrations:
//   nodeRegistry.register('section', 'default', GeostatSectionShell, {
//     skeleton: (ctx) => DefaultSectionSkeleton({ span: ctx.layout?.span }),
//   })
// → Suspense fallback while HttpDataStore loads → <DefaultSectionSkeleton span="full" /> ✅

// ── Level 1 example — brand override when type default is insufficient ────
export const GEOSTAT_THEME: ThemeConfig = mergeTheme(DEFAULT_THEME, {
  skeletons: {
    'kpi-strip': (_ctx) => KpiStripSkeleton(),
    // Geostat KPI skeleton uses brand colors + card shape — different from generic shimmer.
    // 'section', 'chart', etc. → fall through to Level 2 (nodeRegistry defaults) ✅
  },
})
// If no skeleton overrides needed: const GEOSTAT_THEME = DEFAULT_THEME (empty skeletons)

// App.tsx:
//   <ThemeProvider theme={GEOSTAT_THEME}>
//     <SiteProvider stores={manifest.stores} pages={manifest.pages}
//                  nav={manifest.nav} chrome={manifest.chrome}>
//       <Router />
//     </SiteProvider>
//   </ThemeProvider>


// ═══════════════════════════════════════════════════════════════════════════
// Constructor palette — nodeRegistry.list() + chromeRegistry.list()
// ═══════════════════════════════════════════════════════════════════════════
//
// Constructor uses registry introspection — no separate catalog needed.
// nodeRegistry.list()              → all node types + variants (type picker, canvas)
// chromeRegistry.list('AppHeader') → all header variants with preview thumbnails
//
// These are live — register() in setupRegistrations → list() auto-updates.
// No constructor-specific metadata file to keep in sync.

// Constructor node type palette:
export function getNodePalette() {
  return nodeRegistry.list()   // Array<{ type, variant, label?, icon?, category?, preview? }>
  // e.g. [
  //   { type: 'section',        variant: 'default', label: 'სექცია',    icon: 'layout-section', category: 'layout' },
  //   { type: 'chart',          variant: 'default', label: 'გრაფიკი',   icon: 'bar-chart',      category: 'data'   },
  //   { type: 'container-page', variant: 'default', label: 'კონტეინერი',icon: 'grid',           category: 'page'   },
  //   { type: 'container-page', variant: 'landing', label: undefined, ... },
  //   { type: 'landing-hero',   variant: 'default', label: 'ჰირო',      icon: 'home',           category: 'landing'},
  //   ...
  // ]
}

// Constructor chrome palette (for SiteManifest.chrome selection UI):
export function getChromePalette(slot: string) {
  return chromeRegistry.list(slot)   // Array<{ key, label?, preview? }>
  // chromeRegistry.list('AppHeader') → [
  //   { key: 'default', label: 'სრული',     preview: '/previews/header-full.png'    },
  //   { key: 'minimal', label: 'მინიმალური', preview: '/previews/header-minimal.png' },
  //   { key: 'compact', label: 'კომპაქტური', preview: '/previews/header-compact.png' },
  // ]
  // Constructor renders thumbnail grid — user clicks one → manifest.chrome.AppHeader updated ✅
}

// Dev introspection — all registered entries at a glance:
export function devDump() {
  console.table(nodeRegistry.dump())    // Record<type, Record<variant, NodeRenderer>>
  console.table(chromeRegistry.dump())  // Record<slot, Record<key, () => ReactNode>>
}


// ═══════════════════════════════════════════════════════════════════════════
// Testing — createTestRegistryProvider (Backstage TestApiRegistry pattern)
// ═══════════════════════════════════════════════════════════════════════════
//
// Problem with global singleton in tests:
//   nodeRegistry is a global mutable singleton.
//   Test A registers MockShell → leaks into Test B.
//   Tests depending on registration order = non-deterministic failures.
//
// Solution: createNodeRegistry() factory + createTestRegistryProvider() injection.
//   Tests create isolated instances — global nodeRegistry never touched.
//   Components resolve registry from context — test instances shadow globals.

// ── Test: renders GeostatSectionShell with mock data ─────────────────────
//
// import { render, screen } from '@testing-library/react'
// import { createNodeRegistry, createTestRegistryProvider } from '@geostat/react'
//
// test('section renders title from view params', () => {
//   const testNodes = createNodeRegistry()
//   testNodes.register('section', 'default', MockSectionShell)
//   // MockSectionShell: minimal, no Geostat CSS, no animation → fast, deterministic
//
//   const TestProvider = createTestRegistryProvider({ nodeRegistry: testNodes })
//
//   render(
//     <TestProvider>
//       <SomeComponentThatUsesEngine />
//     </TestProvider>
//   )
//   expect(screen.getByText('GDP')).toBeInTheDocument()
// })
//
// ── Test: snapshot/restore on global registry ─────────────────────────────
//
// If a test must use the global (e.g. integration test):
//
// let snap: RegistrySnapshot
// beforeEach(() => { snap = nodeRegistry.snapshot() })
// afterEach  (() => { nodeRegistry.restore(snap)    })
//
// test('landing-hero registered', () => {
//   nodeRegistry.register('landing-hero', 'default', MockHeroRenderer)
//   expect(nodeRegistry.get('landing-hero', 'default')).toBe(MockHeroRenderer)
// })
// // After: nodeRegistry.restore(snap) → 'landing-hero' unregistered — no leak ✅


// ═══════════════════════════════════════════════════════════════════════════
// Scoped overrides — ShellOverrideProvider (print, embed, A/B)
// ═══════════════════════════════════════════════════════════════════════════
//
// Problem: print view needs simplified section/chart shells.
//   Old solution: PRINT_THEME = mergeTheme(GEOSTAT_THEME, { shells: { ... } })
//   → No longer works: shells not in ThemeConfig.
//
// New solution: ShellOverrideProvider — React Context that shadows global registry.
//   Components inside ShellOverrideProvider resolve overrides first.
//   No global nodeRegistry mutation. No ThemeProvider nesting.
//
// Print dialog:
export function PrintPageView({ pageId }: { pageId: string }) {
  return (
    <ShellOverrideProvider
      shells={{
        'section/default': PrintSectionShell,  // no export controls, clean print margins
        'chart/default':   PrintChartShell,    // static SVG, no tooltip/zoom
        // 'filter-bar', 'table', ... → global nodeRegistry kept ✅
      }}
    >
      {/* <PageLoader pageId={pageId} /> */}
    </ShellOverrideProvider>
  )
  // No code outside <ShellOverrideProvider> is affected.
  // GEOSTAT_THEME (skeletons) still applies — not overriding skeletons here.
}

// Key format: '{type}/{variant}' — mirrors nodeRegistry namespace.
// Chrome override: chromeOverrides={{ 'AppHeader/default': PrintHeaderShell }}


// ═══════════════════════════════════════════════════════════════════════════
// What NOT to do
// ═══════════════════════════════════════════════════════════════════════════

// ❌ ThemeConfig.shells (old pattern — pre-registry migration)
//    const GEOSTAT_THEME = mergeTheme(DEFAULT_THEME, { shells: { 'section': X } })
//    → shells not in ThemeConfig anymore — TypeScript error
//    ✅ nodeRegistry.register('section', 'default', X) in setupRegistrations.ts

// ❌ ThemeConfig.chrome (old pattern)
//    const GEOSTAT_THEME = mergeTheme(DEFAULT_THEME, { chrome: { AppHeader: X } })
//    → chrome not in ThemeConfig anymore — TypeScript error
//    ✅ chromeRegistry.register('AppHeader', 'default', X) in setupRegistrations.ts

// ❌ if/switch for variant routing inside a shell
//    function GeostatContainerShell({ def }) {
//      if (def.variant === 'landing') return <LandingLayout />   ← static, not data-driven
//      return <DefaultLayout />
//    }
//    → every new variant = code change. Constructor cannot add variants without deploy.
//    ✅ nodeRegistry.register('container-page', 'landing', GeostatLandingShell)
//       nodeRegistry.get('container-page', 'landing') → GeostatLandingShell — pure table ✅

// ❌ Nested ThemeProvider for scoped shell override
//    <ThemeProvider theme={{ shells: { 'section': PrintShell } }}>   ← inner theme = shells only
//      // useTheme() → { shells: { 'section': PrintShell } } — no skeletons
//    </ThemeProvider>
//    → skeletons from outer GEOSTAT_THEME lost. And shells no longer in ThemeConfig anyway.
//    ✅ <ShellOverrideProvider shells={{ 'section/default': PrintShell }}>

// ❌ Registering chrome components with props
//    chromeRegistry.register('AppHeader', 'default', ({ nav }) => ...)  ← props expected
//    → chromeRegistry contract: () => ReactNode — called with no arguments
//    → if component expects props, it will crash at AppChrome call site
//    ✅ function GeostatFullHeader() { const nav = useSiteNav(); ... }

// ❌ Individual imports in setupRegistrations.ts (old pattern):
//    import { GeostatSectionShell } from '../nodes/section/GeostatSectionShell'
//    import { GeostatChartShell }   from '../nodes/chart/GeostatChartShell'
//    // ... 13 more imports + 15 nodeRegistry.register() calls ...
//    → Adding a node = 2 manual changes in setupRegistrations.ts (import + register call).
//    → Barrel name 'components/theme/' no longer exists in new folder structure.
//    ✅ import * as Nodes from '../nodes' → adding a node = 0 changes in setupRegistrations.ts.

// ❌ Registering in feature files instead of setupRegistrations.ts
//    // src/features/landing/nodes/hero/LandingHeroRenderer.tsx
//    nodeRegistry.register('landing-hero', 'default', LandingHeroRenderer)  ← side-effect in module
//    → registration runs whenever module is imported — hard to predict, non-obvious order
//    ✅ All register() calls via setupRegistrations.ts → registerSlice() — one file, explicit order ✅

// ❌ 'landing-page' as a registered type (E-2 anti-pattern)
//    nodeRegistry.register('landing-page', 'default', LandingPageRenderer)
//    → 'landing-page' ∉ PageConfig union → SiteManifest.pages type error
//    ✅ ContainerPageNode { variant: 'landing' } + nodeRegistry.register('container-page', 'landing', GeostatLandingShell)

// declare JSX namespace for type checking in this example:
declare namespace JSX { interface Element {} }
declare const header: unknown
declare const div: unknown
declare const nav: unknown
declare const img: unknown
declare const span: unknown
declare const main: unknown
```
