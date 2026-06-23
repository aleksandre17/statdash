// ── resolveViewState ──────────────────────────────────────────────────
//
//  Translates a hidden boolean into data-view + aria-hidden attributes.
//  Spread directly onto any view-wrapper element — zero class coupling.
//  CSS in node-styles.css reads [data-view="hidden/visible"].
//

export type ViewStateAttrs = {
  'data-view':   'hidden' | 'visible'
  'aria-hidden'?: true
}

export function resolveViewState(hidden: boolean): ViewStateAttrs {
  return hidden
    ? { 'data-view': 'hidden', 'aria-hidden': true }
    : { 'data-view': 'visible' }
}