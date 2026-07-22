// ── DataSpec publish status — the honest lifecycle signal (Law 11 · C3) ───────────
//
//  Server-sync state for a Publish / Restore gesture, DELIBERATELY separate from the
//  client-side draft (dataSpecDraft.store) and the constructor store: a publish outcome
//  is sync state, NOT a user edit to undo (mirrors the page-lifecycle saveStatus split —
//  it must never enter the undo history). Keyed by spec id so the lifecycle band renders
//  an HONEST state for the doc it edits — never a fake "published" when a PUT was rejected.
//
//    • publishing — the validated PUT is in flight.
//    • published  — the PUT succeeded (a new revision was appended server-side).
//    • error      — a 422 `config-invalid` (carries `violations[]` — rendered AT the
//                   field) or a transport failure (carries `error`). NEVER fake-saved.
//    • forbidden  — a restore was refused (403, needs admin). Honest, never reimplemented.
//
import { create } from 'zustand'
import type { ConfigViolation } from '@statdash/contracts'

export type DataSpecPublishPhase = 'publishing' | 'published' | 'error' | 'forbidden'

export interface DataSpecPublishState {
  phase: DataSpecPublishPhase
  /** Present on a `config-invalid` 422 — the failing checks, rendered at their fields. */
  violations?: ConfigViolation[]
  /** Present on a transport/other error or a 403 — the honest human message. */
  error?: string
}

interface DataSpecPublishStore {
  status: Record<string, DataSpecPublishState>
  setPublish:   (id: string, state: DataSpecPublishState) => void
  clearPublish: (id: string) => void
}

export const useDataSpecPublishStore = create<DataSpecPublishStore>((set) => ({
  status: {},
  setPublish: (id, state) =>
    set((s) => ({ status: { ...s.status, [id]: state } })),
  clearPublish: (id) =>
    set((s) => {
      if (!(id in s.status)) return s
      const next = { ...s.status }
      delete next[id]
      return { status: next }
    }),
}))

/** Reactive read of ONE spec's publish phase (`undefined` = idle). */
export function useDataSpecPublish(id: string | undefined): DataSpecPublishState | undefined {
  return useDataSpecPublishStore((s) => (id ? s.status[id] : undefined))
}
