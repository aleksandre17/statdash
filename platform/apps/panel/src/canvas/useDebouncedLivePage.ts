// ── useDebouncedLivePage — request-volume guard for live preview (G3.2) ───────
//
//  G3.1 injected a LIVE store into the canvas behind a structural|live toggle.
//  G3.2 hardens the INTERACTIVE editing loop: while the author edits a node's
//  DataSpec (rapid keystrokes / dim toggles), every intermediate `page` state
//  flows to the engine renderer, where each distinct DataSpec produces a fresh
//  specDimKey → a fresh useNodeRows promise → a fresh ApiStore.queryAsync →
//  a fresh observation fetch against the cube. The existing caches
//  (ApiStore._cache, useNodeRows._promiseCache, both keyed by query identity)
//  dedupe IDENTICAL queries — but they cannot collapse the DISTINCT intermediate
//  DataSpec states a debounce produces. So the only thing that bounds request
//  VOLUME across an edit burst is debouncing the descriptor that feeds the live
//  renderer.
//
//  WHY THIS SEAM (the page descriptor → renderer, not the render itself):
//    • CanvasView is two stacked layers. Layer 1 (NodePageRenderer) is the only
//      layer that issues data queries. Layer 2 (CanvasOverlay: selection frames,
//      drop zones) must stay INSTANT for responsive editing — it keeps the live
//      `page`. Debouncing here narrows the delay to exactly the data-fetch layer.
//    • The `structural|live` toggle (CanvasView `mode`) and all unrelated UI are
//      untouched: in structural mode this hook is an identity passthrough, so the
//      structural preview stays byte-identical and instant (G3.1 invariant).
//    • Debouncing the DESCRIPTOR (not the live-store map) composes with the caches
//      instead of fighting them: we feed FEWER distinct specs; the query-identity
//      caches still dedupe the identical ones. No double-caching, no cache-busting.
//
//  The live-store MAP itself (buildStoreManifest in useLivePreviewStores) is NOT
//  rebuilt per DataSpec edit — it keys off the cube binding (descriptors), which
//  a DataSpec edit does not change. So this hook is the complete request-volume
//  seam for DataSpec editing; the store-map build is already bounded by its own
//  descriptor identity.
//
//  Law 3: app-layer hook. Pure React + the panel's own PreviewMode; no engine or
//  renderer change — the panel decides WHICH page descriptor the renderer sees.
//
import { useEffect, useState } from 'react'
import type { NodePageConfig } from '@statdash/react/engine'
import type { PreviewMode } from './useLivePreviewStores'

/**
 * Resolve the page the LIVE renderer should currently see, WITHOUT touching the
 * timer. Pure function of (live page, mode, last-published, prev mode):
 *
 *   • structural mode        → the live page (identity passthrough, no debounce).
 *   • just toggled into live → the live page at once (instant toggle).
 *   • steady-state live      → the last published (settled) page; the timer effect
 *                              advances `published` once editing pauses.
 *
 * Returning the immediate value here (a render-phase derivation, not a setState in
 * an effect) is the recommended "you might not need an effect" pattern — it keeps
 * the structural/toggle paths synchronous and lint-clean, leaving the effect to do
 * exactly one job: the delayed publish.
 */
function resolveRenderedPage(
  page: NodePageConfig,
  mode: PreviewMode,
  published: NodePageConfig,
  prevMode: PreviewMode,
): NodePageConfig {
  if (mode !== 'live') return page          // structural: never debounce
  if (prevMode !== 'live') return page      // just toggled on: publish at once
  return published                          // steady-state live: settled page only
}

/**
 * Quiet interval (ms) the author's DataSpec edits must settle for before the live
 * renderer issues an observation request. One named constant (no magic numbers):
 * long enough to collapse a fast keystroke burst into a single live query, short
 * enough that the live preview still feels responsive once editing pauses.
 */
export const LIVE_PREVIEW_DEBOUNCE_MS = 350

/**
 * Debounce the `page` descriptor that drives the LIVE renderer.
 *
 *   structural mode → returns `page` immediately (identity passthrough — the
 *                     G3.1 path is byte-identical and instant; zero added delay).
 *   live mode       → returns the last page that stayed unchanged for
 *                     LIVE_PREVIEW_DEBOUNCE_MS. A burst of N rapid edits collapses
 *                     to ONE settled page → one specDimKey → one live query.
 *
 * Switching INTO live mode publishes the current page immediately (no initial
 * blank-out); only subsequent edits within live mode are debounced.
 */
export function useDebouncedLivePage(page: NodePageConfig, mode: PreviewMode): NodePageConfig {
  // `published` is the descriptor the live renderer last committed to. It only
  // advances on a settled edit (timer) or instantly on the structural/toggle
  // paths (render-phase, below) — so it is the SSOT for "what the data layer sees".
  const [published, setPublished] = useState(page)

  // Previous mode across renders → lets render distinguish "just toggled into live"
  // (publish at once) from steady-state live editing (debounce). Held as STATE
  // (not a ref) so it can be adjusted with the supported set-state-during-render
  // idiom — the lint config forbids reading/writing refs during render.
  const [prevMode, setPrevMode] = useState(mode)

  // Render-phase derivation: the immediate value for structural + the toggle edge.
  // No setState-in-effect — the synchronous paths are pure here (React's
  // recommended pattern). The effect below owns ONLY the delayed live publish.
  const rendered = resolveRenderedPage(page, mode, published, prevMode)

  // Adjust state during render (React's "store previous value" idiom): re-renders
  // before paint, never loops (both guarded by identity). Keeps `published` in
  // lockstep with the synchronous value so a later debounce has the right baseline.
  if (rendered !== published) setPublished(rendered)
  if (prevMode !== mode) setPrevMode(mode)

  useEffect(() => {
    // Only steady-state live editing debounces. Structural and the toggle edge are
    // already handled synchronously above (rendered === page there).
    if (mode !== 'live' || prevMode !== 'live') return

    // Editing burst: each new `page` resets this timer; only the page that stays
    // unchanged for the quiet interval is published → one settled live query.
    const timer = setTimeout(() => setPublished(page), LIVE_PREVIEW_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [page, mode, prevMode])

  return rendered
}
