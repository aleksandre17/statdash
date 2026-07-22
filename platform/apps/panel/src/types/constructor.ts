// ── Constructor Domain Model ──────────────────────────────────────────────────
//
//  Three-layer construction session:
//    Layer 1 (Data)  — DataSources + named, reusable DataSpecs
//    Layer 2 (Site)  — Identity, navigation order, theme overrides
//    Layer 3 (Pages) — Ordered page list; each page = canvas of nodes
//
//  Serializable to JSON → saved to config API / exported as PageDef JSON.
//

import type { DataSpec } from '@statdash/engine'
import type { ChromeSlotConfig, PageConfigBase } from '@statdash/react/engine'

// ── Layer 1: Data ─────────────────────────────────────────────────────────────

export type DataSourceType = 'sdmx-json' | 'rest' | 'static'
export type ConnectionStatus = 'idle' | 'connected' | 'error' | 'pending'

export interface DataSourceDef {
  id:       string
  name:     string
  type:     DataSourceType
  url?:     string
  config:   Record<string, unknown>
  status:   ConnectionStatus
}

export interface NamedDataSpec {
  id:           string
  name:         string
  description?: string
  /** The actual DataSpec — JSON-serializable, engine-compatible. */
  spec:         DataSpec
}

// ── Layer 2: Site ─────────────────────────────────────────────────────────────

export type Locale = 'ka' | 'en'

export interface NavItem {
  id:     string
  label:  { ka: string; en: string }
  pageId: string
  /** Explicit order — array position is canonical, this is a display hint. */
  order:  number
}

export interface SiteDef {
  name:               string
  defaultLocale:      Locale
  /**
   * Active-locale codes the author must fill for every LocaleString, ORDERED —
   * the SSOT projection of `config.locale` (V13), mapped through the site read
   * (`fromApiSite`). Opaque string codes (the registry owns the universe); the
   * panel narrows them to known `Locale`s in `useActiveLocales`. May be empty on
   * the mock-data / older-payload fallback path — consumers degrade gracefully.
   */
  activeLocales:      string[]
  logo?:              string
  /** Ordered navigation items — D&D reorder updates this array. */
  nav:                NavItem[]
  /** Token key → CSS value overrides (from TOKENS_CATALOG keys). */
  themeOverrides:     Record<string, string>
  /** Context key → DataSource id — e.g. { geo: 'ds-geo-2024' } */
  dataSourceBindings: Record<string, string>
  /**
   * App-shell chrome configuration, keyed by slot (AppHeader / InnerSidebar /
   * AppFooter …). Each entry picks a variant + carries that chrome element's
   * OWN per-element `config` (the per-slot config the shell reads via
   * useSlotConfig). Mirrors the engine `SiteManifest.chrome` shape exactly so it
   * serializes straight to the config API. Authored through the generic
   * Inspector via `chromeSchemaSource` (Phase C).
   */
  chrome:             Record<string, ChromeSlotConfig>
}

// ── Chrome selection — FOLDED into the ONE PartAddress (S6) ──────────────────
//
//  Chrome is no longer a distinct selection species. A chrome region is a `sourced`
//  Part of the SITE-FRAME element (ADR-041 R4), selected through the SAME
//  `PartAddress` grammar as every other part: `{ nodeId: SITE_FRAME_ID, partPath:
//  chromePartPath(slot) }`. The `ChromeSelection` discriminated arm (`kind:'chrome'`)
//  is RETIRED — `SelectionAddress` is now the single `PartAddress` (arm count 2→1).
//  The store's `selectChrome(slot)` wrapper builds that address (constructor.store).

// ── Layer 3: Pages ────────────────────────────────────────────────────────────

/**
 * One node on the canvas — unified on the engine NodeDef model (C2).
 *
 *  Why no closed `kind` enum any more?
 *    The palette is an OPEN registry (`nodeRegistry.list()`): any registered
 *    slice is draggable. A hardcoded 8-member union meant a newly-registered
 *    type was palette-visible but UNSTORABLE — a Law-1 / OCP violation (the
 *    interpreter widens, the store doesn't). `type: string` keeps the store as
 *    open as the registry: a new type = a new capability, store unchanged.
 *
 *  Shape mirrors the engine node (`{ type, variant?, props, children }`):
 *    - `type`     dispatch discriminant — `nodeRegistry.get(type, variant)`.
 *    - `variant`  registry variant selector (default 'default' when omitted).
 *    - `props`    the node config body — keyed by the slice's PropSchema fields,
 *                 seeded from `getDefaults(type)` on add. (Was `config`.)
 *    - `childIds` child node IDs — id references into the page's flat node map
 *                 (Identity Map; the tree is projected by canvasPageAdapter).
 */
export interface CanvasNode {
  id:        string
  type:      string
  variant?:  string
  /** Config values — keyed by the slice's PropSchema field names. */
  props:     Record<string, unknown>
  /** Child node IDs for container nodes (e.g. section → panels). */
  childIds:  string[]
}

/**
 * Page-level config carried losslessly across the edit→save round-trip.
 *
 * Everything on `PageConfigBase` EXCEPT the structural identity fields the
 * CanvasPage already models as first-class columns:
 *   - `id`   ⇒ CanvasPage.id
 *   - `path` ⇒ CanvasPage.slug
 * (`type`/`children` are NODE-structural, owned by the inner-page root + nodeIds.)
 *
 * So `meta` holds frame · chrome · presentation · filterSchema · vars ·
 * perspectives · schemaVersion · **storeKey** (the page's declared store home,
 * PageConfigBase §storeKey — mirrors `NodeBase.storeKey` so a page-level-only
 * consumer, e.g. this type, sees it without reaching into the node-structural
 * half of the `NodePageConfig` intersection) — and AUTOMATICALLY any field a
 * future PageConfigBase grows, because canvasPageAdapter carries it by
 * structural pass-through, not a hand-maintained key list (mirrors how
 * CanvasNode.props carries node body fields).
 */
export type PageMeta = Omit<PageConfigBase, 'id' | 'path'>

export interface CanvasPage {
  id:       string
  /**
   * The page-root KIND — the engine's page-root node type (`inner-page` /
   * `tab-page` / `container-page`; see PAGE_ROOT_TYPES). First-class + node-
   * structural, exactly like the engine root node's own `type`: the canvas renders
   * THIS page's real shell (landing→landing frame, inner→inner) and the adapter
   * round-trips it LOSSLESSLY — never a privileged hardcoded literal (Law 1).
   *
   * REQUIRED so every creation path must declare it (`DEFAULT_PAGE_TYPE` for a
   * genuinely kind-less blank page). This makes the `undefined`-type case
   * unrepresentable, which is what keeps the fromNodePageConfig∘toNodePageConfig
   * round-trip SYMMETRIC — a type-less page can never silently acquire (and then
   * be locked into) the default on reload.
   */
  type:     string
  /**
   * The page-root VARIANT (e.g. container-page `landing`) — the second half of the
   * page-KIND identity, symmetric to {@link CanvasNode.variant}. A registered page
   * kind is a `(type, variant)` pair (ADR-050 R3): `landing` is `container-page` +
   * `variant:'landing'`, whose meta `defaults` select the landing frame + chrome.
   * First-class + node-structural (NOT swept into `meta`), so the adapter round-trips
   * it LOSSLESSLY — absent ⇒ the kind's `'default'` variant (byte-identical to pre-R3
   * pages, which carried no page-root variant).
   */
  variant?: string
  title:    { ka: string; en: string }
  slug:     string
  /** Ordered top-level node IDs — D&D reorder updates this array. */
  nodeIds:  string[]
  /** All nodes keyed by id (flat map for O(1) lookup). */
  nodes:    Record<string, CanvasNode>
  /**
   * Page-level engine config (frame/chrome/presentation/filterSchema/vars/
   * perspectives/…) preserved verbatim across edit→save. Absent when the page carries
   * none. See {@link PageMeta}. Carried generically by canvasPageAdapter so a new
   * PageConfigBase field survives the round-trip with zero adapter change.
   */
  meta?:    PageMeta
}

// ── Studio surfaces — the URL route table (AR-49 M0 · SPEC-studio-ia-canonical S5) ─
//
//  A StudioSurface is a route segment (`/studio/<id>`), NOT a peer navigation
//  destination. After the S5 rail collapse there are TWO kinds of surface behind
//  the one scheme, but the URL/type stays ONE derived list (a new surface is one
//  entry — OCP; the route validator + string type can never drift):
//    • Compose panes — `insert` (Add) · `layers` (Layers): the left Navigator's two
//      panes, swapped over the always-mounted canvas (nothing gates anything).
//    • Project workspaces — `pages-site` (Site) · `style` (Theme) · `data` (the ONE
//      Data workspace): DEMOTED from the rail to full-screen focus-view destinations
//      (project-scope, not per-element navigation). Still real routes, so each stays
//      deep-linkable and Back/Forward moves in/out of it.
//
//  ── ADR-051 DU1 — the ONE Data workspace (2026-07-20) ─────────────────────────
//  `sources` + `model` collapse into ONE `data` destination whose internal IA is the
//  four-floor ladder (Sources → Model → Pipelines → element). The rail exposes exactly
//  one data door (FF-ONE-DATA-WORKSPACE); the two legacy segments survive here ONLY as
//  redirect-only aliases (StudioRoutes 301-redirects `/studio/sources` + `/studio/model`
//  → `/studio/data`) so the still-live cross-gesture courier (SourcesBody →
//  `setSurface('model')`, DU2 deletes it) keeps type-checking and working. They carry no
//  rail entry and no focus-view target — a walk never surfaces them. When DU2 kills the
//  courier they leave the union entirely.
export const STUDIO_SURFACES = ['data', 'sources', 'insert', 'layers', 'pages-site', 'style', 'model'] as const

export type StudioSurface = (typeof STUDIO_SURFACES)[number]

/** The surface the Studio opens on — Insert (drop a block) is the first affordance. */
export const DEFAULT_STUDIO_SURFACE: StudioSurface = 'insert'
