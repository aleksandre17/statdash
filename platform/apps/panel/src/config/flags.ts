// ── Feature flags — panel-level, boot-time (AR-49 M1.2) ───────────────────────
//
//  A tiny, dependency-free flag reader. Each flag has TWO inputs, checked in
//  precedence order so an owner can preview a flag live without a rebuild:
//
//    1. A persisted panel setting — localStorage. Wins when present. This is the
//       "flip it in the browser" seam: `localStorage.setItem('statdash.studioShell',
//       'on')` then reload. Reversible: set 'off' or removeItem.
//    2. The build-time env default — `import.meta.env.VITE_STUDIO_SHELL`. Off unless
//       explicitly 'true'/'1'. This is the CI / deploy-time switch.
//
//  Off by default on BOTH inputs — the wizard stays the default surface (Strangler:
//  the new shell is purely additive behind the flag until M1.3 flips the default).

/** localStorage key for the Studio-shell override (persisted panel setting). */
export const STUDIO_SHELL_FLAG = 'statdash.studioShell'

const TRUTHY = new Set(['on', 'true', '1', 'yes'])
const FALSY = new Set(['off', 'false', '0', 'no'])

/**
 * Whether the AR-49 Studio shell replaces the 3-step wizard.
 *
 * Read at render time (a pure boolean read — safe to call in a component body).
 * localStorage override wins over the env default so the owner can preview without
 * a redeploy; absent both ⇒ false (wizard is the default).
 */
export function studioShellEnabled(): boolean {
  try {
    const override = globalThis.localStorage?.getItem(STUDIO_SHELL_FLAG)?.toLowerCase()
    if (override && TRUTHY.has(override)) return true
    if (override && FALSY.has(override)) return false
  } catch {
    // No storage (SSR / privacy mode) — fall through to the env default.
  }
  const env = String(import.meta.env.VITE_STUDIO_SHELL ?? '').toLowerCase()
  return TRUTHY.has(env)
}
