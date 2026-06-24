// ── @statdash/plugins/presentation — registered presentation projectors ──────
//
//  The concrete presentation capabilities the platform ships: color → CSS var,
//  crumbs → navContext.crumbs. Both register into the engine's presentation
//  registry [N-ADR-0029 v2]. SSOT entrypoint: BOTH the geostat runner
//  (setupRegistrations) and the panel Constructor (setupCanvasRegistry) call
//  registerPresentationProjectors() at boot — beside registerStoreBuilders() /
//  registerSlice().
//
//  Below apps in the dependency arrow (imports only @statdash/react/engine).
//  Adding a NEW projector here + listing it below is the ENTIRE change to teach
//  the platform a new presentation concern — ZERO renderer edits (OCP / Law 1).
//

import { registerPresentationProjector } from '@statdash/react/engine'
import type { PresentationProjector }     from '@statdash/react/engine'
import { colorProjector }                 from './colorProjector'
import { crumbsProjector }                from './crumbsProjector'

export { colorProjector }  from './colorProjector'
export { crumbsProjector, isCrumbs } from './crumbsProjector'

/** Every projector this package ships — the single list a new concern joins. */
const PROJECTORS: PresentationProjector[] = [
  colorProjector as PresentationProjector,
  crumbsProjector as PresentationProjector,
]

/**
 * Register every shipped presentation projector with the engine registry.
 * Call once at app boot (setupRegistrations.ts / setupCanvasRegistry.ts).
 * Idempotent: registering the same key twice is a no-op overwrite.
 */
export function registerPresentationProjectors(): void {
  for (const p of PROJECTORS) registerPresentationProjector(p)
}
