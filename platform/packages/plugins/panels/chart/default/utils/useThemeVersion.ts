// ── useThemeVersion — re-render charts when the theme flips at runtime ──────
//
//  Chart chrome colours (Apex config strings, custom-SVG `fill` attributes) are
//  resolved from CSS tokens via `cssVar` AT BUILD TIME and baked into SVG — a
//  layer CSS `var()` cannot re-drive. So while every token READ is theme-correct
//  on the render it happens on, an ALREADY-MOUNTED chart keeps its stale, baked
//  colours when the theme switcher flips `[data-theme]` (or the OS preference
//  changes) after mount. This module is the single source of truth for "the
//  active theme changed": bumping a version that callers fold into a React `key`
//  remounts the chart subtree, so every `cssVar` read re-runs against the new
//  cascade. One observer serves every chart on the page (module singleton +
//  useSyncExternalStore) regardless of chart count.
//
//  Agnostic: it reacts to the theme AXIS (the `data-theme` attribute + the
//  prefers-color-scheme query) — never to a specific theme name or tenant hue.

import { useSyncExternalStore } from 'react'

let version = 0
const listeners = new Set<() => void>()
let started = false

function bump() {
  version++
  for (const l of listeners) l()
}

function start() {
  if (started || typeof window === 'undefined' || typeof document === 'undefined') return
  started = true
  // Explicit theme selection: the switcher writes [data-theme] on <html>.
  new MutationObserver(bump).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  })
  // Implicit (OS) selection when no [data-theme] is set.
  const mq = window.matchMedia?.('(prefers-color-scheme: dark)')
  mq?.addEventListener?.('change', bump)
}

function subscribe(cb: () => void): () => void {
  start()
  listeners.add(cb)
  return () => { listeners.delete(cb) }
}

const getSnapshot = () => version
const getServerSnapshot = () => 0

/**
 * A number that increments whenever the effective theme changes. Fold it into a
 * React `key` on a chart's render subtree so JS-baked token colours refresh on a
 * runtime theme flip.
 */
export function useThemeVersion(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
