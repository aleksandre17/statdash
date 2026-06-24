// @vitest-environment node
//
// ── Fitness: ONE shared 'stats' store-builder, both apps register it (G3.0) ──
//
//  SSOT gate for the G3 live-data preview. The 'stats' store-builder used to be
//  duplicated in apps/geostat; it now lives ONCE in @statdash/plugins/datasources
//  so BOTH the geostat runner AND the panel Constructor boot the SAME builder
//  without either app importing the other (Law 3 / dependency arrow).
//
//  This test pins:
//    1. Before any boot, 'stats' is NOT registered (the registry is a clean seam).
//    2. registerStoreBuilders() — the shared boot fn both apps call — makes the
//       'stats' kind registered + reachable via buildStoreManifest's registry.
//    3. The registration is idempotent: a second call (e.g. runner + panel both
//       booting in one process, or StrictMode/HMR re-runs) keeps exactly one
//       'stats' kind — no divergence, no duplicate.
//    4. The builder is NOT invoked here (no network): registeredKinds() proves
//       reachability via the same _registry buildStoreManifest reads.
//
//  buildStoreManifest([]) is asserted to stay a safe no-op so the empty-store
//  preview mode (ADR G3 invariant) never trips the registry.

import { describe, it, expect } from 'vitest'
import {
  registeredKinds,
  buildStoreManifest,
} from '@statdash/react/engine'
import { registerStoreBuilders } from './index'

describe('shared stats store-builder (G3.0 SSOT)', () => {
  it("does not register 'stats' until the shared boot fn runs", () => {
    // Module-load side effects must be ZERO — registration is explicit (a boot
    // call), never a top-level import side effect. The runner and the panel each
    // decide when to register; importing the module must not register for them.
    expect(registeredKinds()).not.toContain('stats')
  })

  it("registerStoreBuilders() registers a reachable 'stats' kind", () => {
    registerStoreBuilders()
    expect(registeredKinds()).toContain('stats')
  })

  it('is idempotent — both apps booting it keeps exactly one stats kind', () => {
    registerStoreBuilders()
    registerStoreBuilders()
    const stats = registeredKinds().filter((k) => k === 'stats')
    expect(stats).toHaveLength(1)
  })

  it('buildStoreManifest([]) stays a safe no-op (empty-store preview mode)', async () => {
    await expect(buildStoreManifest([])).resolves.toEqual({})
  })
})
