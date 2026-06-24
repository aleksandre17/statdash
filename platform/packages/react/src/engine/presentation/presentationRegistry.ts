// ── presentationRegistry — open key→projector map [N-ADR-0029 v2] ─────────────
//
//  Mirrors registerStoreBuilder / registeredKinds (storeManifest.ts), middlewareRegistry,
//  and FieldControlRegistry EXACTLY: an open registry the shared layer iterates,
//  per-key behaviour supplied by registered units. Presentation was the lone
//  registry escapee; this brings it home.
//
//  Boot-time wiring: apps register the projectors they ship (color, crumbs, …)
//  beside registerStoreBuilders() / registerSlice(). In a bare test/node env
//  with nothing registered, the loop is a safe no-op (list returns []).
//

import type { PresentationProjector } from './PresentationProjector'
import type { PropField }             from '../slice-meta'

const _projectors = new Map<string, PresentationProjector>()

/**
 * Register (or override) a projector by key. Call once at app/plugin boot —
 * like registerStoreBuilder / registerSlice. Idempotent overwrite by key.
 */
export function registerPresentationProjector(p: PresentationProjector): void {
  _projectors.set(p.key, p)
}

/**
 * Every registered projector — the renderer iterates this generically. The
 * iteration order is registration order (Map insertion order), which is stable.
 */
export function listPresentationProjectors(): PresentationProjector[] {
  return [..._projectors.values()]
}

/**
 * Constructor entry point: the PropSchema for the whole `presentation` slot =
 * the union of every registered projector's schema(). A new projector's
 * PropField appears automatically — same mechanism as registeredKinds()
 * feeding describeApp(). Returns [] before any projector is booted.
 */
export function presentationPropSchema(): PropField[] {
  return listPresentationProjectors().flatMap(p => p.schema())
}
