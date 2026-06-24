// ── useLivePreviewStores — structural | live store map for the canvas (G3.1) ──
//
//  The canvas renders the engine NodePageRenderer against a `stores` map. This
//  hook is the single seam that decides WHICH map:
//
//    structural (default) → { default: staticStore }   — zero-fetch, byte-identical
//                                                          to the pre-G3 canvas.
//    live (opt-in toggle)  → buildStoreManifest(descriptors) routed through the
//                            SHARED 'stats' builder — the SAME seam the geostat
//                            runner uses (Law 3: the panel wires the store; the
//                            renderer/engine stay app-agnostic).
//
//  FAIL-SOFT is the contract (the editor must NEVER crash — graceful degradation,
//  mirroring the runner's emptyManifest()/no-stores precedent). Live mode falls
//  back to the static map AND reports `unavailable` (the caller shows a
//  non-blocking badge) on ANY of:
//    • no cube-bound DataSource (deriveLiveDescriptors → [])
//    • the active cube-profile is absent/error/none (DataSpec unbound or the
//      discovery surface is unreachable — reuse the existing reachability signal
//      rather than a new probe)
//    • buildStoreManifest throws (API unreachable / unknown kind)
//
//  Because the structural map is the fallback, the canvas always renders SOMETHING
//  sane. The live build runs in an effect with a stale-guard so a toggle-off or a
//  source change mid-flight never clobbers the current map.
//
import { useEffect, useMemo, useRef, useState } from 'react'
import type { DataStore } from '@statdash/engine'
import { staticStore } from '@statdash/engine'
import { buildStoreManifest } from '@statdash/react/engine'
import { useActiveProfile } from '../discovery/useActiveProfile'
import { useDataSources } from '../store/constructor.store'
import { deriveLiveDescriptors } from './livePreview'

/** Canvas preview mode — structural (empty store) or live (real cube data). */
export type PreviewMode = 'structural' | 'live'

/**
 * The resolved preview state:
 *   - 'structural' — the empty static store (default mode, or never requested live)
 *   - 'live'       — a live store map is mounted
 *   - 'unavailable'— live was requested but failed soft → static store + show badge
 */
export type PreviewStatus = 'structural' | 'live' | 'unavailable'

export interface LivePreview {
  stores: Record<string, DataStore>
  status: PreviewStatus
}

/** The structural fallback — a single empty static store under `default`. The
 *  engine's resolveStore falls back to the first key, so one entry covers any
 *  pageStoreKey a node references. Identity-stable (module const) so structural
 *  renders are byte-identical and referentially stable across re-renders. */
const STRUCTURAL_STORES: Record<string, DataStore> = { default: staticStore }

/**
 * Resolve the canvas store map for the requested preview `mode`. Live mode is
 * built off the session's cube-bound DataSources; everything that can go wrong
 * degrades to the structural map with `status: 'unavailable'`.
 */
export function useLivePreviewStores(mode: PreviewMode): LivePreview {
  const sources = useDataSources()
  const profile = useActiveProfile()

  // Descriptors are pure-derived from the session sources (memoized on the array
  // identity — the constructor store hands a stable ref until sources change).
  const descriptors = useMemo(() => deriveLiveDescriptors(sources), [sources])

  // The live cube must be reachable/bound before we fetch: the profile discovery
  // surface (same dataset, same /api/cube/:code/profile) already tells us. Only a
  // 'ready' profile proves the cube exists and the API answers — 'none' (no bound
  // dataset), 'loading', and 'error' all gate live OFF (fail-soft, no throw).
  const profileReady = profile.status === 'ready'

  const [live, setLive] = useState<Record<string, DataStore> | null>(null)
  const [failed, setFailed] = useState(false)

  // Monotonic build token — guards against a stale async build resolving after a
  // newer request (toggle flip / source edit) and clobbering the current map.
  const tokenRef = useRef(0)

  const canBuildLive = mode === 'live' && profileReady && descriptors.length > 0

  useEffect(() => {
    // Not live (or cannot be) → drop any prior live map; structural takes over.
    if (!canBuildLive) {
      setLive(null)
      setFailed(false)
      return
    }

    const token = ++tokenRef.current
    setFailed(false)

    buildStoreManifest(descriptors)
      .then((map) => {
        if (token !== tokenRef.current) return   // superseded — ignore
        setLive(map)
      })
      .catch(() => {
        if (token !== tokenRef.current) return
        // API unreachable / unknown kind → fail soft to structural + badge.
        setLive(null)
        setFailed(true)
      })

    // On unmount or dependency change, invalidate the in-flight build.
    return () => { tokenRef.current++ }
  }, [canBuildLive, descriptors])

  return useMemo<LivePreview>(() => {
    if (mode !== 'live') return { stores: STRUCTURAL_STORES, status: 'structural' }

    // Live requested. A built map → live. Otherwise structural fallback, flagged
    // 'unavailable' so the caller surfaces the non-blocking badge. The 'loading'
    // window (descriptors valid, build in flight) also shows structural without a
    // badge — it is the expected transient, not a failure.
    if (live) return { stores: live, status: 'live' }

    const unavailable =
      failed || !profileReady || descriptors.length === 0
    return {
      stores: STRUCTURAL_STORES,
      status: unavailable ? 'unavailable' : 'structural',
    }
  }, [mode, live, failed, profileReady, descriptors])
}
