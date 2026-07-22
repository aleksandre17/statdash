// ── anchorBox — resolve the measurable box under a display:contents part anchor ──
//
//  The canvas overlay measures each node/item frame from its renderer anchor. Part
//  anchors (the ONE `data-part-*` family) are `display:contents`, so they contribute
//  NO box (`getBoundingClientRect()` = 0×0) — the overlay must descend to the first
//  real (boxed) element to get the true frame geometry.
//
//  This is a pure DOM helper (no React), extracted so it is unit-testable in isolation
//  and so the overlay component module keeps a components-only export surface.
//
export function resolveAnchorBox(anchor: Element | null): Element | null {
  // Descend through EVERY leading `display:contents` wrapper to the first real box.
  // Robust by construction to a wrapper-count regression: if a node were ever anchored
  // more than once (nested identical `display:contents` wrappers — the 0109 class), the
  // frame still measures the true content box instead of collapsing to a 0×0 dot at the
  // origin (FF-NODE-FRAME-NONDEGENERATE). Returns the last element reached (the anchor
  // itself when it has no child — the honest not-rendered 0×0 case).
  let box: Element | null = anchor
  while (box && box.firstElementChild && getComputedStyle(box).display === 'contents') {
    box = box.firstElementChild
  }
  return box
}
