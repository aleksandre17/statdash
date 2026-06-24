// ── styleKeys — the section slice's typed class-name SSOT ──────────────
//
//  The static BEM block/element class names live in EXACTLY ONE place. The
//  shell references `SECTION.x` typed members instead of bare string literals,
//  so a CSS rename is a single typed edit (not silent dead strings scattered
//  across TSX), and the FF-NO-VARIANT-CLASS / no-bare-block-string fitness
//  functions have one allowlisted home for these strings.
//
//  This is the ADR's chosen alternative to CSS Modules: data-attribute scoping
//  for variants/state (resolveVariants → `data-emphasis`, resolveViewState →
//  `data-view`) + this typed constant for the static skeleton. No hashed class
//  names → byte-identical with the existing global `.section` selectors and the
//  `--sc` / `[data-tenant]` / `[data-theme]` token cascade.
//
//  VARIANT modifiers are intentionally ABSENT here — they are NOT class names
//  any longer. `section--hero` / `section--compact` became `[data-emphasis=…]`
//  attributes, resolved by the variant seam and declared in meta.ts.
//

export const SECTION = {
  block:      'section',
  drillLabel: 'section__drill-label',
  body:       'section__body',
  view:       'section__view',
} as const
