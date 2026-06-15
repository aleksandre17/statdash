import { create } from 'zustand'
import { subscribeWithSelector, devtools } from 'zustand/middleware'
import type {
  DataSourceDef, NamedDataSpec,
  SiteDef, NavItem,
  CanvasPage, CanvasNode,
  WizardStep,
} from '../types/constructor'
import {
  type ConstructorSession,
  type WizardSlice,
  type HistorySlice,
  type HistoryEntry,
  INITIAL_SESSION,
  snapshot,
  pushHistory,
} from './constructor.history'

// ── Full Store ─────────────────────────────────────────────────────────────────

export interface ConstructorStore extends ConstructorSession, WizardSlice, HistorySlice {
  // Wizard actions
  goToStep:       (step: WizardStep) => void
  markStepDone:   (step: WizardStep) => void
  selectNode:     (id: string | null) => void

  // Data Layer actions
  addDataSource:     (ds: DataSourceDef) => void
  updateDataSource:  (id: string, patch: Partial<DataSourceDef>) => void
  removeDataSource:  (id: string) => void
  reorderDataSources: (orderedIds: string[]) => void
  addDataSpec:       (spec: NamedDataSpec) => void
  updateDataSpec:    (id: string, patch: Partial<NamedDataSpec>) => void
  removeDataSpec:    (id: string) => void
  reorderDataSpecs:  (orderedIds: string[]) => void

  // Site Layer actions
  updateSite:       (patch: Partial<SiteDef>) => void
  reorderNav:       (orderedIds: string[]) => void
  addNavItem:       (item: NavItem) => void
  removeNavItem:    (id: string) => void

  // Page Layer actions
  addPage:          (page: CanvasPage) => void
  updatePage:       (id: string, patch: Partial<Omit<CanvasPage, 'nodes'>>) => void
  removePage:       (id: string) => void
  setActivePage:    (id: string | null) => void
  reorderPageNodes: (pageId: string, orderedNodeIds: string[]) => void
  addNode:          (pageId: string, node: CanvasNode, afterId?: string) => void
  updateNode:       (pageId: string, nodeId: string, patch: Partial<CanvasNode>) => void
  removeNode:       (pageId: string, nodeId: string) => void

  // History
  undo: () => void
  redo: () => void
}

// ── Store factory ─────────────────────────────────────────────────────────────

export const useConstructorStore = create<ConstructorStore>()(
  devtools(
    subscribeWithSelector((set) => ({
      // ── Initial state ──────────────────────────────────────────────────────
      ...INITIAL_SESSION,
      activeStep:     0,
      completedSteps: new Set<WizardStep>(),
      selectedNodeId: null,
      undoStack:      [],
      redoStack:      [],
      canUndo:        false,
      canRedo:        false,

      // ── Wizard ─────────────────────────────────────────────────────────────
      goToStep: (step) => set({ activeStep: step }, false, 'wizard/goToStep'),
      markStepDone: (step) =>
        set(
          (s) => ({ completedSteps: new Set([...s.completedSteps, step]) }),
          false,
          'wizard/markStepDone',
        ),
      selectNode: (id) => set({ selectedNodeId: id }, false, 'canvas/selectNode'),

      // ── Data Layer ─────────────────────────────────────────────────────────
      addDataSource: (ds) =>
        set(
          (s) => ({
            ...pushHistory(s as ConstructorStore, `Add DataSource: ${ds.name}`),
            dataSources: [...s.dataSources, ds],
          }),
          false,
          'data/addDataSource',
        ),
      updateDataSource: (id, patch) =>
        set(
          (s) => ({
            ...pushHistory(s as ConstructorStore, `Update DataSource`),
            dataSources: s.dataSources.map((d) => (d.id === id ? { ...d, ...patch } : d)),
          }),
          false,
          'data/updateDataSource',
        ),
      removeDataSource: (id) =>
        set(
          (s) => ({
            ...pushHistory(s as ConstructorStore, `Remove DataSource`),
            dataSources: s.dataSources.filter((d) => d.id !== id),
          }),
          false,
          'data/removeDataSource',
        ),
      reorderDataSources: (orderedIds) =>
        set(
          (s) => {
            const lookup = Object.fromEntries(s.dataSources.map((d) => [d.id, d]))
            return {
              ...pushHistory(s as ConstructorStore, `Reorder Data Sources`),
              dataSources: orderedIds.map((id) => lookup[id]).filter(Boolean),
            }
          },
          false,
          'data/reorderDataSources',
        ),
      addDataSpec: (spec) =>
        set(
          (s) => ({
            ...pushHistory(s as ConstructorStore, `Add DataSpec: ${spec.name}`),
            dataSpecs: [...s.dataSpecs, spec],
          }),
          false,
          'data/addDataSpec',
        ),
      updateDataSpec: (id, patch) =>
        set(
          (s) => ({
            ...pushHistory(s as ConstructorStore, `Update DataSpec`),
            dataSpecs: s.dataSpecs.map((d) => (d.id === id ? { ...d, ...patch } : d)),
          }),
          false,
          'data/updateDataSpec',
        ),
      removeDataSpec: (id) =>
        set(
          (s) => ({
            ...pushHistory(s as ConstructorStore, `Remove DataSpec`),
            dataSpecs: s.dataSpecs.filter((d) => d.id !== id),
          }),
          false,
          'data/removeDataSpec',
        ),
      reorderDataSpecs: (orderedIds) =>
        set(
          (s) => {
            const lookup = Object.fromEntries(s.dataSpecs.map((d) => [d.id, d]))
            return {
              ...pushHistory(s as ConstructorStore, `Reorder Data Specs`),
              dataSpecs: orderedIds.map((id) => lookup[id]).filter(Boolean),
            }
          },
          false,
          'data/reorderDataSpecs',
        ),

      // ── Site Layer ─────────────────────────────────────────────────────────
      updateSite: (patch) =>
        set(
          (s) => ({
            ...pushHistory(s as ConstructorStore, `Update Site`),
            site: { ...s.site, ...patch },
          }),
          false,
          'site/updateSite',
        ),
      reorderNav: (orderedIds) =>
        set(
          (s) => {
            const lookup = Object.fromEntries(s.site.nav.map((n) => [n.id, n]))
            return {
              ...pushHistory(s as ConstructorStore, `Reorder Navigation`),
              site: {
                ...s.site,
                nav: orderedIds.map((id, i) => ({ ...lookup[id], order: i })),
              },
            }
          },
          false,
          'site/reorderNav',
        ),
      addNavItem: (item) =>
        set(
          (s) => ({
            ...pushHistory(s as ConstructorStore, `Add Nav: ${item.label.en}`),
            site: { ...s.site, nav: [...s.site.nav, item] },
          }),
          false,
          'site/addNavItem',
        ),
      removeNavItem: (id) =>
        set(
          (s) => ({
            ...pushHistory(s as ConstructorStore, `Remove Nav Item`),
            site: { ...s.site, nav: s.site.nav.filter((n) => n.id !== id) },
          }),
          false,
          'site/removeNavItem',
        ),

      // ── Page Layer ─────────────────────────────────────────────────────────
      addPage: (page) =>
        set(
          (s) => ({
            ...pushHistory(s as ConstructorStore, `Add Page: ${page.title.en}`),
            pages: [...s.pages, page],
          }),
          false,
          'pages/addPage',
        ),
      updatePage: (id, patch) =>
        set(
          (s) => ({
            ...pushHistory(s as ConstructorStore, `Update Page`),
            pages: s.pages.map((p) => (p.id === id ? { ...p, ...patch } : p)),
          }),
          false,
          'pages/updatePage',
        ),
      removePage: (id) =>
        set(
          (s) => ({
            ...pushHistory(s as ConstructorStore, `Remove Page`),
            pages:        s.pages.filter((p) => p.id !== id),
            activePageId: s.activePageId === id ? null : s.activePageId,
          }),
          false,
          'pages/removePage',
        ),
      setActivePage: (id) => set({ activePageId: id }, false, 'pages/setActivePage'),
      reorderPageNodes: (pageId, orderedNodeIds) =>
        set(
          (s) => ({
            ...pushHistory(s as ConstructorStore, `Reorder Sections`),
            pages: s.pages.map((p) =>
              p.id === pageId ? { ...p, nodeIds: orderedNodeIds } : p,
            ),
          }),
          false,
          'canvas/reorderNodes',
        ),
      addNode: (pageId, node, afterId) =>
        set(
          (s) => {
            const page = s.pages.find((p) => p.id === pageId)
            if (!page) return {}
            const idx = afterId ? page.nodeIds.indexOf(afterId) + 1 : page.nodeIds.length
            const nodeIds = [...page.nodeIds.slice(0, idx), node.id, ...page.nodeIds.slice(idx)]
            return {
              ...pushHistory(s as ConstructorStore, `Add ${node.kind}`),
              pages: s.pages.map((p) =>
                p.id === pageId
                  ? { ...p, nodeIds, nodes: { ...p.nodes, [node.id]: node } }
                  : p,
              ),
            }
          },
          false,
          'canvas/addNode',
        ),
      updateNode: (pageId, nodeId, patch) =>
        set(
          (s) => ({
            ...pushHistory(s as ConstructorStore, `Update node`),
            pages: s.pages.map((p) =>
              p.id === pageId
                ? { ...p, nodes: { ...p.nodes, [nodeId]: { ...p.nodes[nodeId], ...patch } } }
                : p,
            ),
          }),
          false,
          'canvas/updateNode',
        ),
      removeNode: (pageId, nodeId) =>
        set(
          (s) => {
            const page = s.pages.find((p) => p.id === pageId)
            if (!page) return {}
            const { [nodeId]: _removed, ...restNodes } = page.nodes
            return {
              ...pushHistory(s as ConstructorStore, `Remove node`),
              pages: s.pages.map((p) =>
                p.id === pageId
                  ? { ...p, nodeIds: p.nodeIds.filter((id) => id !== nodeId), nodes: restNodes }
                  : p,
              ),
            }
          },
          false,
          'canvas/removeNode',
        ),

      // ── History ────────────────────────────────────────────────────────────
      undo: () =>
        set(
          (s) => {
            const entry = s.undoStack.at(-1)
            if (!entry) return {}
            const redoEntry: HistoryEntry = { label: entry.label, snapshot: snapshot(s as ConstructorStore) }
            return {
              ...entry.snapshot,
              undoStack: s.undoStack.slice(0, -1),
              redoStack: [...s.redoStack, redoEntry],
              canUndo:   s.undoStack.length > 1,
              canRedo:   true,
              // Preserve UI state
              activeStep:     s.activeStep,
              completedSteps: s.completedSteps,
              selectedNodeId: s.selectedNodeId,
            }
          },
          false,
          'history/undo',
        ),
      redo: () =>
        set(
          (s) => {
            const entry = s.redoStack.at(-1)
            if (!entry) return {}
            const undoEntry: HistoryEntry = { label: entry.label, snapshot: snapshot(s as ConstructorStore) }
            return {
              ...entry.snapshot,
              undoStack: [...s.undoStack, undoEntry],
              redoStack: s.redoStack.slice(0, -1),
              canUndo:   true,
              canRedo:   s.redoStack.length > 1,
              activeStep:     s.activeStep,
              completedSteps: s.completedSteps,
              selectedNodeId: s.selectedNodeId,
            }
          },
          false,
          'history/redo',
        ),
    })),
    { name: 'ConstructorStore' },
  ),
)

// ── Typed selectors (ISP: consumers depend only on what they use) ──────────────
export const useWizardStep    = () => useConstructorStore((s) => s.activeStep)
export const useCompletedSteps = () => useConstructorStore((s) => s.completedSteps)
export const useDataSources   = () => useConstructorStore((s) => s.dataSources)
export const useDataSpecs     = () => useConstructorStore((s) => s.dataSpecs)
export const useSite          = () => useConstructorStore((s) => s.site)
export const usePages         = () => useConstructorStore((s) => s.pages)
export const useActivePage    = () => useConstructorStore((s) => s.pages.find((p) => p.id === s.activePageId) ?? null)
export const useSelectedNode  = () => useConstructorStore((s) => s.selectedNodeId)
export const useHistory       = () => useConstructorStore((s) => ({ canUndo: s.canUndo, canRedo: s.canRedo, undo: s.undo, redo: s.redo }))
