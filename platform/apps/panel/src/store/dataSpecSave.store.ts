// ── Data-spec save status — the honest persistence signal (Law 11) ────────────────
//
//  A DELIBERATELY separate, tiny store from the constructor store: a save outcome is
//  server-sync state, NOT a user edit to undo (mirrors the page-lifecycle saveStatus
//  split — it must never enter the history snapshot). Keyed by spec id so the Model-
//  floor workbench can render an HONEST state for the spec it is editing: saving /
//  saved / error — never a fake "saved" when a PUT failed (AR-52 «the canvas never
//  lies»). The debounced-persistence coordinator (api-actions.updateDataSpec) writes
//  it; DataModelingPanel reads ONE id's phase reactively (useDataSpecSave).
//
import { create } from 'zustand'

export type DataSpecSavePhase = 'saving' | 'saved' | 'error'

export interface DataSpecSaveState {
  phase:  DataSpecSavePhase
  /** Present only on `error` — the honest failure message surfaced to the author. */
  error?: string
}

interface DataSpecSaveStore {
  status: Record<string, DataSpecSaveState>
  setDataSpecSave:   (id: string, state: DataSpecSaveState) => void
  clearDataSpecSave: (id: string) => void
}

export const useDataSpecSaveStore = create<DataSpecSaveStore>((set) => ({
  status: {},
  setDataSpecSave: (id, state) =>
    set((s) => ({ status: { ...s.status, [id]: state } })),
  clearDataSpecSave: (id) =>
    set((s) => {
      if (!(id in s.status)) return s
      const next = { ...s.status }
      delete next[id]
      return { status: next }
    }),
}))

/** Reactive read of ONE spec's save phase (`undefined` = idle / never saved). */
export function useDataSpecSave(id: string | undefined): DataSpecSaveState | undefined {
  return useDataSpecSaveStore((s) => (id ? s.status[id] : undefined))
}
