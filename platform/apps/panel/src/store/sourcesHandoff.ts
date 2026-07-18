import { create } from 'zustand'

// ── sourcesHandoff — the Sources → Model workbench cross-gesture (0091 · ladder) ──
//
//  The ladder survives as NAV ORDER + cross-gestures (owner 2026-07-18): a cube row
//  on the Sources page offers «დაათვალიერე workbench-ში» — open the STEWARD workbench
//  seeded with that cube. Sources (a full-screen Focus-View) and the workbench (behind
//  the Model page's Steward lens, DataModelingPanel) are separate screens with no shared
//  parent, so the handoff is a tiny one-shot signal: Sources sets the pending cube +
//  navigates to /studio/model (Steward lens); the workbench CONSUMES it once on arrival
//  (createDataSpec seeded via withStewardCube — the 0084 seam) and clears it.
//
//  One-shot by construction: `take()` reads AND clears, so a consumed handoff never
//  re-fires on a later re-render/remount (no stale seeding). Pure session state — never
//  persisted; a page reload drops any un-consumed intent (correct: it was a live gesture).

/** A pending "browse this raw cube in the workbench" intent. */
export interface PendingCube {
  /** The dataset code (identity + the seeded spec's name). */
  datasetCode: string
  /** The cube's measure codes — the steward `source(query)` head reads these. */
  measures:    string[]
  /** The cube's store HOME (a `storeKey`) — resolved from `datasetCode` via the session-source
   *  SSOT (`storeKeyForDataset`) at CLICK time, so the seeded steward head reads the PICKED
   *  cube's OWN store, not the page's (0089 · ADR-046 Addendum 3). Resolved at the origin
   *  gesture (race-free — no dependency on when the consumer's session sources hydrate).
   *  Undefined ⇒ the picked cube is not a session source ⇒ the head declares no home. */
  dataSource?: string
}

interface SourcesHandoffState {
  pendingCube: PendingCube | null
  /** Sources: request the workbench open on `cube` (paired with a nav to /studio/model). */
  browseCube: (cube: PendingCube) => void
  /** Workbench: read AND clear the pending intent (one-shot). Null when none is pending. */
  take: () => PendingCube | null
}

export const useSourcesHandoff = create<SourcesHandoffState>((set, get) => ({
  pendingCube: null,
  browseCube: (cube) => set({ pendingCube: cube }),
  take: () => {
    const pending = get().pendingCube
    if (pending) set({ pendingCube: null })
    return pending
  },
}))
