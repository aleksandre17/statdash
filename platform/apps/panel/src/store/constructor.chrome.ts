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
import type { ConstructorSession, SelectionAddress } from './constructor.history'
import type { ChromeSelection } from '../types/constructor'

/** Patch type shared by all chrome reducers (a partial session + the ONE selection). */
type ChromePatch = Partial<ConstructorSession> & {
  selection?: SelectionAddress | null
}

/**
 * Select (or clear) a chrome element. Writing the chrome address into the ONE
 * `selection` inherently clears any node/item selection (mutual exclusivity — one
 * address, one element), and seeds the slot with the selected variant so a first
 * edit writes through to a real ChromeSlotConfig (no null hole).
 */
export function selectChromePatch(s: ConstructorSession, sel: ChromeSelection | null): ChromePatch {
  if (sel == null) return { selection: null }
  return {
    selection: sel,
    site: s.site.chrome[sel.slot]
      ? s.site
      : { ...s.site, chrome: { ...s.site.chrome, [sel.slot]: { variant: sel.key } } },
  }
}

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
