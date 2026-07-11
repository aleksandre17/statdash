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

// ── Chrome selection (Phase C) ──────────────────────────────────────────────
//
//  A chrome element is addressed by slot+key (the chromeRegistry composite key).
//  The Constructor selects it the same way it selects a page node, then the
//  Inspector renders its schema via chromeSchemaSource. Selection state is a
//  discriminated union so the panel knows which schema source + write path to
//  use without overloading the node-id string.
//
export interface ChromeSelection {
  kind: 'chrome'
  slot: string
  key:  string
}

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
 * perspectives · schemaVersion (page color lives under presentation.color) — and
 * AUTOMATICALLY any field a future PageConfigBase
 * grows, because canvasPageAdapter carries it by structural pass-through, not by
 * a hand-maintained key list (mirrors how CanvasNode.props carries node body fields).
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

// ── Studio shell (AR-49) ─────────────────────────────────────────────────────
//
//  The Studio's activity-rail surfaces. A StudioSurface is a NON-ordered lens
//  summoned over the always-mounted canvas — nothing gates anything (spec §2.1;
//  the ordered 3-step wizard it replaced was retired in M1.3b). `model` is the
//  Steward-role destination (AR-50 M5b: always-visible, role-split content).
//
//  ONE canonical list (AR-49 M0 routing): the string-literal type is DERIVED from
//  this runtime array, so the rail table, the route param validator, and the type
//  can never drift apart — a new surface is one entry here (OCP). Each id doubles
//  as the URL path segment (`/studio/<id>`), so the list is also the route table.
export const STUDIO_SURFACES = ['insert', 'data', 'layers', 'pages-site', 'style', 'model'] as const

export type StudioSurface = (typeof STUDIO_SURFACES)[number]

/** The surface the Studio opens on — Insert (drop a block) is the first affordance. */
export const DEFAULT_STUDIO_SURFACE: StudioSurface = 'insert'
