// ── perspective-state — the active-id SSOT helpers [VISION #3 / P1] ───────────
//
//  `ctx.perspectiveState: Record<param, activeId>` (core/context.ts) is the ONE
//  source for "which perspective is active" — the Harel orthogonal-regions container
//  (HIGH-3). This module is the SSOT for READING it: every mode-reading callsite
//  (renderNode, both SSR walkers, navUtils, the SSR-gate) extracts the active id
//  through `activePerspective(...)` rather than a positional `mode?` sourced from a
//  React `ModeContext`. One record in, one id out — no parallel mode param survives.
//
//  LAW 1 (no privileged dimension): the param NAME is data. The conventional default
//  is the string `'perspective'` (and the legacy `'mode'`), but the engine NEVER
//  branches on the literal — `activePerspective` resolves by param key, falling back
//  to the single-axis value, so a page may name its axis anything.

/**
 * The conventional URL-param name for the (single, time) perspective axis. A
 * DEFAULT, not a privilege — a page may name its axis param anything; the engine
 * reads `perspectiveState[param]` with the param carried as data. Kept beside the
 * legacy `'mode'` so a config mid-migration (still using `?mode=`) resolves too.
 */
export const PERSPECTIVE_PARAM = 'perspective'

/** The legacy time-mode param name (System A) — read as a fallback until P6. */
export const LEGACY_MODE_PARAM = 'mode'

/**
 * Read the active perspective id from the `perspectiveState` SSOT for the *legacy
 * param-less* ops (`mode-is`/`mode-in`/`mode-not`), which name no param. Resolution:
 *   1. the conventional `'perspective'` key,
 *   2. else the legacy `'mode'` key (a config mid-migration),
 *   3. else — when exactly one axis is active — that single value (param-agnostic).
 * Returns undefined when no axis is active (the N=1-free default ⇒ a `mode-*` gate
 * is simply false, exactly as the pre-P1 positional `mode` was undefined).
 *
 * The new `perspective-*` ops (P2) carry an EXPLICIT param and read
 * `perspectiveState[expr.param]` directly — they never need this fallback.
 */
export function activePerspective(
  perspectiveState: Record<string, string> | undefined,
): string | undefined {
  if (!perspectiveState) return undefined
  const byConventional = perspectiveState[PERSPECTIVE_PARAM] ?? perspectiveState[LEGACY_MODE_PARAM]
  if (byConventional !== undefined) return byConventional
  const keys = Object.keys(perspectiveState)
  return keys.length === 1 ? perspectiveState[keys[0]!] : undefined
}
