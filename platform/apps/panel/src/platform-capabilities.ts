// ── Platform Capabilities — Aggregation Point ────────────────────────────────
//
//  Single import for all engine capability catalogs. Panel's Constructor UI,
//  expression builder, and token pickers read from here.
//
//  Pattern: Self-Describing Module (VSCode contributes / Grafana plugin.json /
//  LSP ServerCapabilities). Each engine package describes its own API surface;
//  Panel aggregates without owning the definitions.
//
//  Dependency direction is preserved:
//    @statdash/expr    ← ops + refs catalogs   (expression builder)
//    @statdash/engine  ← spec catalog          (DataSpec type picker)
//    @statdash/styles  ← tokens catalog        (style token picker)
//    @statdash/plugins ← META catalog          (Constructor palette + slots)
//

import { OPS_CATALOG, REFS_CATALOG }    from '@statdash/expr'
import { SPEC_CATALOG }                  from '@statdash/engine'
import { TOKENS_CATALOG }               from '@statdash/styles'
import { PLUGIN_CATALOG }               from '@statdash/plugins/catalog'

export type { OpCategory, OpArgType, OpDescriptor } from '@statdash/expr'
export type { RefKind, RefDescriptor }              from '@statdash/expr'
export type { SpecField, SpecDescriptor }           from '@statdash/engine'
export type { TokenGroup, TokenDescriptor }         from '@statdash/styles'
export type { PaletteEntry, PluginCatalog }         from '@statdash/plugins/catalog'

// ── Aggregated capabilities object ────────────────────────────────────────────
//
//  ops:    25 expression ops — Panel builds expression editor form rows from this.
//  refs:   5 ExprRef/ListRef shapes — Panel builds reference type picker from this.
//  specs:  9 DataSpec discriminants — Panel builds spec-type picker from this.
//  tokens: 28 design tokens across 6 groups — Panel builds token pickers from this.
//  nodes:  Plugin catalog — Constructor palette entries indexed by category/sliceType.
//
export const PLATFORM_CAPABILITIES = {
  ops:    OPS_CATALOG,
  refs:   REFS_CATALOG,
  specs:  SPEC_CATALOG,
  tokens: TOKENS_CATALOG,
  nodes:  PLUGIN_CATALOG,
} as const
