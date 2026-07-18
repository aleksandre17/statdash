// ── cubeProfile.store — cached cube-profile access for the editor (C3) ────────
//
//  Single source of truth for "the introspection bundle of dataset X" in the
//  Constructor session. Profiles are fetched once per datasetCode and cached
//  (Identity Map by code) so every enum-ref field / palette gate / suggestion
//  that needs the same dataset shares one fetch.
//
//  GRACEFUL DEGRADATION is a first-class state, not an exception: a profile can
//  be 'loading' | 'ready' | 'error'. Consumers (EnumRefField, the palette gate)
//  render their fail-soft path on 'error'/'loading' (empty options, ungated
//  palette) and NEVER crash the editor (verify-gate: "degrades gracefully if a
//  dataset/profile is unavailable"). A 404/409/network fault becomes 'error',
//  not a thrown render.
//
//  The "active dataset" seam: the dataset a data-bound field resolves against is
//  derived from the session — a DataSource declares its datasetCode in config.
//  activeDatasetCode(state) is the one place that derivation lives; when the
//  Constructor grows an explicit per-page dataset binding, change it here only
//  (Protected Variations).
//
import { create } from 'zustand'
import { cubeApi, type CubeProfile } from '../lib/cubeApi'
import type { DataSourceDef } from '../types/constructor'

/** Async-resource state for one dataset's profile. */
export type ProfileEntry =
  | { status: 'loading' }
  | { status: 'ready';   profile: CubeProfile }
  | { status: 'error';   message: string }

interface CubeProfileState {
  /** Profiles by datasetCode (Identity Map). */
  byCode: Record<string, ProfileEntry>
  /**
   * Ensure the profile for `datasetCode` is loading/loaded. Idempotent: a code
   * already loading or ready is a no-op (one fetch per code). Returns nothing —
   * consumers read byCode reactively.
   */
  ensure: (datasetCode: string) => void
  /** Clear a cached profile (e.g. after the dataset's source config changes). */
  invalidate: (datasetCode: string) => void
}

export const useCubeProfileStore = create<CubeProfileState>((set, get) => ({
  byCode: {},

  ensure: (datasetCode) => {
    if (!datasetCode) return
    const existing = get().byCode[datasetCode]
    // One fetch per code: skip if already in-flight or resolved. (An 'error'
    // entry is retried — a transient fault should not be permanent.)
    if (existing && existing.status !== 'error') return

    set((s) => ({ byCode: { ...s.byCode, [datasetCode]: { status: 'loading' } } }))

    cubeApi
      .profile(datasetCode)
      .then((profile) =>
        set((s) => ({ byCode: { ...s.byCode, [datasetCode]: { status: 'ready', profile } } })),
      )
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'profile unavailable'
        set((s) => ({ byCode: { ...s.byCode, [datasetCode]: { status: 'error', message } } }))
      })
  },

  invalidate: (datasetCode) =>
    set((s) => {
      const rest: Record<string, ProfileEntry> = {}
      for (const code of Object.keys(s.byCode)) {
        if (code !== datasetCode) rest[code] = s.byCode[code]
      }
      return { byCode: rest }
    }),
}))

// ── Active-dataset derivation (the one place this rule lives) ─────────────────

/**
 * Read a DataSource's bound dataset code, if any. The convention: a SDMX/cube
 * source declares the cube it targets in `config.datasetCode`. Generic over the
 * source `config` bag (Law 1) — no stat-domain field baked into the type.
 */
export function datasetCodeOf(source: DataSourceDef | undefined): string | undefined {
  const code = source?.config?.['datasetCode']
  return typeof code === 'string' && code.length > 0 ? code : undefined
}

/**
 * The `storeKey` (a session DataSource's `name`) bound to `datasetCode`, or undefined when no
 * session source targets that cube. The INVERSE of `datasetCodeOf` over the session sources —
 * the ONE datasetCode↔storeKey mapping (0089 · ADR-046 Addendum 3), never a second routing
 * rule. `source.name` IS the live store-map key (`deriveLiveDescriptors` emits `id: source.name`,
 * `buildStoreManifest` keys by `id`, `resolveStore` indexes `ctx.stores[pageStoreKey]`), so the
 * returned storeKey routes a steward head to the picked cube's OWN store. Used at the raw-cube
 * PICK gesture to FREEZE the picked cube's store home into the head's config (the head declares
 * its home; a session store map is state config can't replay). Undefined ⇒ the picked cube is
 * not a session source ⇒ the head declares no home and falls through to the page store.
 */
export function storeKeyForDataset(sources: DataSourceDef[], datasetCode: string): string | undefined {
  const match = sources.find((s) => datasetCodeOf(s) === datasetCode)
  return match?.name
}

/**
 * Resolve the active dataset code from the session's data sources. The first
 * source declaring a datasetCode wins (the common single-cube case). Returns
 * undefined when no source is cube-bound — consumers then degrade to ungated
 * authoring (the field falls back to free entry, the palette is not gated).
 */
export function pickActiveDatasetCode(sources: DataSourceDef[]): string | undefined {
  for (const s of sources) {
    const code = datasetCodeOf(s)
    if (code) return code
  }
  return undefined
}
