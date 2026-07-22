// ── DataSpec drafts — client-side, crash-safe, explicit-publish (ADR-052 · C3) ────
//
//  The Authoring Lifecycle (DESIGN-0104 §2·C3) makes every edit a DRAFT by default:
//  edits accumulate CLIENT-SIDE against the loaded (published) revision and are
//  persisted to localStorage for crash safety. NOTHING durable is written until an
//  explicit Publish gesture (api-actions.publishDataSpec). This store is the SSOT for
//  "is there an unpublished change, and how many?" — it graduates the retired
//  authoring-hold (which had this model with the Publish button missing).
//
//  ── Identity (the base is the key's second half, per C3) ───────────────────────────
//  A draft is keyed by docId and CARRIES the published `base` spec it forked from — the
//  base plays the "base revision" role the design names, but as a content SNAPSHOT (a
//  fingerprint), which is STRONGER than a revision number for the two jobs it must do:
//    • DISCARD — restore the published base verbatim (no server round-trip).
//    • STALENESS — on reload, if the freshly-loaded published spec ≠ the draft's base,
//      the published document advanced underneath the draft; the draft is dropped
//      (published wins — never silently resurrect an edit onto a changed base).
//  Keying by the fetched revisionNumber would cost a /revisions round-trip on every
//  load (DataSpecRow carries no revision number); the base snapshot needs none. Server-
//  side draft slots (multi-device/author) are deferred — the C3 scoping decision.
//
//  Server-sync (publish outcome) is a SEPARATE store (dataSpecPublish.store) — a draft
//  is a user edit, a publish outcome is sync state; they must never share a slot (the
//  same split as page lifecycle saveStatus).
//
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { DataSpec } from '@statdash/engine'

/** One unpublished draft of a DataSpec — the base it forked from + the live edit. */
export interface SpecDraft {
  /** The published spec at first edit — restored on discard, compared for staleness. */
  base:        DataSpec
  /** The latest edited spec (also mirrored optimistically into the constructor store). */
  current:     DataSpec
  /** How many edit gestures have accumulated (the chip's «n ცვლილება»). */
  changeCount: number
  /** Local wall-clock of the last edit (display only; ordering is never by this). */
  updatedAt:   number
}

interface DataSpecDraftStore {
  drafts: Record<string, SpecDraft>
  /**
   * Record one edit. `publishedBefore` is the store value BEFORE the optimistic write
   * (the base on the FIRST edit only — never overwritten thereafter, so discard always
   * returns to the genuinely-published spec, not the previous keystroke).
   */
  recordEdit: (docId: string, publishedBefore: DataSpec, edited: DataSpec) => void
  /** Drop a draft (discard, or after a successful publish). */
  clearDraft: (docId: string) => void
  /** Non-reactive read (thunks live outside React). */
  getDraft:   (docId: string) => SpecDraft | undefined
}

export const useDataSpecDraftStore = create<DataSpecDraftStore>()(
  persist(
    (set, get) => ({
      drafts: {},
      recordEdit: (docId, publishedBefore, edited) =>
        set((s) => {
          const existing = s.drafts[docId]
          const draft: SpecDraft = {
            base:        existing?.base ?? publishedBefore,
            current:     edited,
            changeCount: (existing?.changeCount ?? 0) + 1,
            updatedAt:   Date.now(),
          }
          return { drafts: { ...s.drafts, [docId]: draft } }
        }),
      clearDraft: (docId) =>
        set((s) => {
          if (!(docId in s.drafts)) return s
          const next = { ...s.drafts }
          delete next[docId]
          return { drafts: next }
        }),
      getDraft: (docId) => get().drafts[docId],
    }),
    { name: 'statdash.dataspec-drafts' },
  ),
)

/** Reactive read of ONE spec's draft (`undefined` = clean / published). */
export function useDataSpecDraft(id: string | undefined): SpecDraft | undefined {
  return useDataSpecDraftStore((s) => (id ? s.drafts[id] : undefined))
}
