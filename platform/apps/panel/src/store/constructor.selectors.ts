// ── constructor.selectors — typed read-side hooks (ISP) ───────────────────────
//
//  Consumers depend only on the slice they read. Split out of the store module
//  (one concern per file — the store factory owns action wiring, this owns the
//  read accessors). Re-exported from constructor.store for import stability.
//
import { useConstructorStore } from './constructor.store'

export const useWizardStep      = () => useConstructorStore((s) => s.activeStep)
export const useCompletedSteps  = () => useConstructorStore((s) => s.completedSteps)
export const useDataSources     = () => useConstructorStore((s) => s.dataSources)
export const useDataSpecs       = () => useConstructorStore((s) => s.dataSpecs)
export const useSite            = () => useConstructorStore((s) => s.site)
export const usePages           = () => useConstructorStore((s) => s.pages)
export const useActivePage      = () => useConstructorStore((s) => s.pages.find((p) => p.id === s.activePageId) ?? null)
export const useSelectedNode    = () => useConstructorStore((s) => s.selectedNodeId)
export const useChromeSelection = () => useConstructorStore((s) => s.chromeSelection)
export const useHistory         = () => useConstructorStore((s) => ({ canUndo: s.canUndo, canRedo: s.canRedo, undo: s.undo, redo: s.redo }))

// ── Lifecycle read-side (server FSM mirror + save/publish UI state) ───────────
export const usePageLifecycle = (id: string | null) =>
  useConstructorStore((s) => (id ? s.lifecycle[id] ?? null : null))
export const useSaveStatus = (id: string | null) =>
  useConstructorStore((s) => (id ? s.saveStatus[id] ?? null : null))
export const usePublishStatus = (id: string | null) =>
  useConstructorStore((s) => (id ? s.publishStatus[id] ?? null : null))
