// ── chromeFacetModel — the chrome facet's STRUCTURAL contract (S6 · Gap 1) ────────
//
//  The declared, generic contract of a chrome region's STRUCTURAL facets — its
//  `variant` (which registered chrome shell), `region` (layout placement) and `order`
//  (sort within the region): the `ChromeSlotConfig` top-level, distinct from the
//  variant's own per-instance `config` schema (projected separately by `element.schema`).
//  Declared ONCE here (thin-base, feedback: strict-SOLID-per-element) and consumed by:
//    • the `chrome` FacetDescriptor (builtinFacets) — projected as a dock section when a
//      chrome region (or the site-frame's composition) is selected; and
//    • the site-frame composition panel (features/chrome) — the per-slot variant picker.
//
//  Genericity in DISPATCH: the fields are ordinary `select`/`number` PropFields, so the
//  generic Inspector + FieldControlRegistry render them through the SAME controls a node
//  prop uses (SelectControl / NumberControl) — NO chrome-specific control, NO per-type
//  branch. The variant OPTIONS are resolved from the registry (`listVariants(slot)`), so a
//  new chrome variant is offered by REGISTERING it — the picker is never edited (OCP).
//
import { chromeRegistry } from '@statdash/react/engine'
import type { LocaleString, PropSchema, PropFieldOption } from '@statdash/react/engine'

/** Field labels — bilingual, framework-neutral (Law 4); live app-tier, not in packages/react. */
export const CHROME_STRUCTURAL_LABELS = {
  facet:   { ka: 'ჩარჩო',    en: 'Chrome' }      as LocaleString,
  variant: { ka: 'ვარიანტი', en: 'Variant' }     as LocaleString,
  region:  { ka: 'რეგიონი',  en: 'Region' }      as LocaleString,
  order:   { ka: 'რიგი',     en: 'Order' }       as LocaleString,
}

/**
 * The canonical layout-region vocabulary (`ChromeSlotConfig.region`) — the WHATWG-style
 * placement set the renderer's `resolveChrome` honours. A closed, framework-level set
 * (not a per-tenant literal): the same values `ChromeSliceMeta.defaultRegion` declares.
 */
export const CHROME_REGIONS = ['top', 'bottom', 'left', 'right', 'overlay', 'inline'] as const

/** The registered variants for a slot as select options — label from each variant's META. */
export function chromeVariantOptions(slot: string): PropFieldOption[] {
  return chromeRegistry.listVariants(slot).map((v) => ({
    value: v,
    label: chromeRegistry.getMeta(slot, v)?.label ?? v,
  }))
}

/**
 * The chrome region's STRUCTURAL facet contract for `slot` — variant · region · order.
 * A `PropSchema` fragment the generic Inspector projects; each field dispatches to a
 * stock control (variant/region → SelectControl via `options`, order → NumberControl).
 * The subject is the `ChromeSlotConfig` top level (`site.chrome[slot]`), written through
 * the `updateChromeSlotField` structural lane (NOT the per-instance `config` bag).
 */
export function chromeStructuralContract(slot: string): PropSchema {
  return [
    { field: 'variant', type: 'string', label: CHROME_STRUCTURAL_LABELS.variant, options: chromeVariantOptions(slot) },
    { field: 'region',  type: 'string', label: CHROME_STRUCTURAL_LABELS.region,
      options: CHROME_REGIONS.map((r) => ({ value: r, label: r })) },
    { field: 'order',   type: 'number', label: CHROME_STRUCTURAL_LABELS.order },
  ]
}

/** The structural field names — the write lane that routes to the ChromeSlotConfig TOP
 *  level (`updateChromeSlotField`) rather than the per-instance `config` bag. */
export const CHROME_STRUCTURAL_FIELDS = new Set(['variant', 'region', 'order'])
