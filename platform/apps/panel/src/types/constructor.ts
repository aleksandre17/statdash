// ── Constructor Domain Model ──────────────────────────────────────────────────
//
//  Three-layer construction session:
//    Layer 1 (Data)  — DataSources + named, reusable DataSpecs
//    Layer 2 (Site)  — Identity, navigation order, theme overrides
//    Layer 3 (Pages) — Ordered page list; each page = canvas of nodes
//
//  Serializable to JSON → saved to config API / exported as PageDef JSON.
//

import type { DataSpec } from '@geostat/engine'

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
  logo?:              string
  /** Ordered navigation items — D&D reorder updates this array. */
  nav:                NavItem[]
  /** Token key → CSS value overrides (from TOKENS_CATALOG keys). */
  themeOverrides:     Record<string, string>
  /** Context key → DataSource id — e.g. { geo: 'ds-geo-2024' } */
  dataSourceBindings: Record<string, string>
}

// ── Layer 3: Pages ────────────────────────────────────────────────────────────

/** Unique discriminated type for a node on the canvas. */
export type CanvasNodeKind =
  | 'section'
  | 'kpi-strip'
  | 'filter-bar'
  | 'page-header'
  | 'links'
  | 'hero'
  | 'stats-carousel'
  | 'repeat'

export interface CanvasNode {
  id:       string
  kind:     CanvasNodeKind
  /** Config values — keyed by META.schema field names. */
  config:   Record<string, unknown>
  /** Child node IDs for container nodes (e.g. section → panels). */
  children: string[]
}

export interface CanvasPage {
  id:       string
  title:    { ka: string; en: string }
  slug:     string
  /** Ordered top-level node IDs — D&D reorder updates this array. */
  nodeIds:  string[]
  /** All nodes keyed by id (flat map for O(1) lookup). */
  nodes:    Record<string, CanvasNode>
}

// ── Wizard ────────────────────────────────────────────────────────────────────

export type WizardStep = 0 | 1 | 2

export const WIZARD_STEPS = [
  { index: 0 as const, id: 'data',  label: { ka: 'მონაცემები', en: 'Data'  }, description: { ka: 'DataSource-ები და DataSpec-ები', en: 'Data sources and specs' } },
  { index: 1 as const, id: 'site',  label: { ka: 'საიტი',     en: 'Site'  }, description: { ka: 'იდენტობა, ნავიგაცია, თემა',     en: 'Identity, navigation, theme' } },
  { index: 2 as const, id: 'pages', label: { ka: 'გვერდები',  en: 'Pages' }, description: { ka: 'გვერდების ვიზუალური აწყობა',     en: 'Visual page assembly' } },
] as const

export type WizardStepMeta = typeof WIZARD_STEPS[number]
