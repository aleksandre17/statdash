// ── Authoring hold — reversible pause of DataSpec durable persistence ─────────────
//
//  URGENT owner ask (2026-07-20): while the live dev tool (:3013) stabilizes, workbench/
//  spec edits must stay IN-SESSION ONLY. The optimistic store still updates (so the UI is
//  live), but NO durable PUT fires — auto-save (39a32e99) was persisting experimental
//  edits and corrupting stored specs. This is the SINGLE reversible guard at the
//  persistence seam (api-actions.updateDataSpec / flushDataSpecSaves): when held, the PUT
//  is skipped, never queued, never flushed on leave.
//
//  ── How to flip the hold back OFF (restore auto-save) when things stabilize ──
//    • Permanent:  set DEFAULT_AUTHORING_HOLD = false below and redeploy — restores the
//                  EXACT auto-save behavior (the fix is gated, never deleted — Law 6/7).
//    • Live/now:   toggle it off in the workbench head ("Enable saving"), or programmatic
//                  useAuthoringHoldStore.getState().setHeld(false) — no redeploy.
//
//  This is the SEED of the real long-term fix — a proper draft → explicit-publish model
//  (edits are drafts by default; an explicit gesture publishes). For now it is only the
//  hold: honest "not saving" (Law 11 — «the canvas never lies»), never a fake-saved.
//
import { create } from 'zustand'

/**
 * The hold default. `true` = PAUSED = no durable PUT (owner's current ask). Flip to
 * `false` to restore auto-save. This single constant is the one obvious flip point.
 */
export const DEFAULT_AUTHORING_HOLD = true

interface AuthoringHoldStore {
  /** true = persistence PAUSED (edits stay in-session only). */
  held: boolean
  setHeld: (held: boolean) => void
}

export const useAuthoringHoldStore = create<AuthoringHoldStore>((set) => ({
  held: DEFAULT_AUTHORING_HOLD,
  setHeld: (held) => set({ held }),
}))

/**
 * Non-reactive read for the persistence seam — the api-action thunks live OUTSIDE React,
 * so they read the flag imperatively (never a hook). Returns true when saving is paused.
 */
export function isAuthoringHeld(): boolean {
  return useAuthoringHoldStore.getState().held
}

/** Reactive read for the workbench head (honest chip + the enable-saving toggle). */
export function useAuthoringHold(): boolean {
  return useAuthoringHoldStore((s) => s.held)
}
