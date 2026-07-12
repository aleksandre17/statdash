// ── constructor.chrome — chrome-authoring state transitions (Phase C) ────────
//
//  Pure reducers for the chrome-authoring slice, split out of the store so the
//  store stays thin wiring (one concern per file). Each function maps the
//  current session to the next state patch; the store binds them to `set` +
//  history. No React, no zustand here — trivially unit-testable.
//
//  Chrome config is per-element (ISP): a slot's authored values live under
//  `site.chrome[slot].config`, the exact shape the engine's ChromeSlot injects
//  into the shell via useSlotConfig. Selecting a chrome element is mutually
//  exclusive with selecting a page node (one Inspector, one element).
//
import { setAtPath } from '../inspector/showWhen'
import type { ConstructorSession } from './constructor.history'

/** Patch type shared by the chrome-config reducers (a partial session). */
type ChromePatch = Partial<ConstructorSession>

//  SELECTING a chrome region is no longer a chrome-specific reducer — it is the ONE
//  `select({ nodeId: SITE_FRAME_ID, partPath: chromePartPath(slot) })` (constructor.store's
//  `selectChrome` wrapper). No variant-seed on select: selection is ephemeral and never
//  dirties the site; `updateChromeConfigPatch` below seeds a real ChromeSlotConfig on the
//  first EDIT (no null hole), so the seed-on-select is unnecessary (S6 fold).

/** Switch a slot's variant, preserving any already-authored per-element config. */
export function setChromeVariantPatch(s: ConstructorSession, slot: string, key: string): ChromePatch {
  return {
    site: {
      ...s.site,
      chrome: { ...s.site.chrome, [slot]: { ...s.site.chrome[slot], variant: key } },
    },
  }
}

/**
 * Write ONE field on a slot's per-element config (merges into chrome[slot].config
 * — the shape ChromeSlot injects into the shell). Seeds a 'default' variant when
 * the slot has no entry yet. `field` is the schema field's dot-path (read by the
 * Inspector via getAtPath); setAtPath is its immutable dual, so a nested chrome
 * field writes to the same location it displays from, sharing untouched branches.
 */
export function updateChromeConfigPatch(
  s: ConstructorSession,
  slot: string,
  field: string,
  value: unknown,
): ChromePatch {
  const existing = s.site.chrome[slot] ?? { variant: 'default' }
  const config = setAtPath({ ...(existing.config ?? {}) }, field, value)
  return {
    site: {
      ...s.site,
      chrome: { ...s.site.chrome, [slot]: { ...existing, config } },
    },
  }
}
