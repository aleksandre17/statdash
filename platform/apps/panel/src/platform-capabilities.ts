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
//    @geostat/expr    ← ops + refs catalogs   (expression builder)
//    @geostat/engine  ← spec catalog          (DataSpec type picker)
//    @geostat/styles  ← tokens catalog        (style token picker)
//    @geostat/plugins ← META catalog          (Constructor palette + slots)
//

import { OPS_CATALOG, REFS_CATALOG }    from '@geostat/expr'
import { SPEC_CATALOG }                  from '@geostat/engine'
import { TOKENS_CATALOG }               from '@geostat/styles'
import { PLUGIN_CATALOG }               from '@geostat/plugins/catalog'

export type { OpCategory, OpArgType, OpDescriptor } from '@geostat/expr'
export type { RefKind, RefDescriptor }              from '@geostat/expr'
export type { SpecField, SpecDescriptor }           from '@geostat/engine'
export type { TokenGroup, TokenDescriptor }         from '@geostat/styles'
export type { PaletteEntry, PluginCatalog }         from '@geostat/plugins/catalog'

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
