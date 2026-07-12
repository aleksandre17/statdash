import { create } from 'zustand'
import { subscribeWithSelector, devtools } from 'zustand/middleware'
import type { PartAddress } from '@statdash/react/engine'
import { SITE_FRAME_ID, chromePartPath } from '@statdash/react/engine'
import type {
  DataSourceDef, NamedDataSpec,
  SiteDef, NavItem,
  CanvasPage, CanvasNode,
} from '../types/constructor'
import {
  type ConstructorSession,
  type StudioUiSlice,
  type HistorySlice,
  type HistoryEntry,
  type SelectionAddress,
  INITIAL_SESSION,
  snapshot,
  pushHistory,
} from './constructor.history'
import {
  setChromeVariantPatch,
  updateChromeConfigPatch,
} from './constructor.chrome'
import {
  type LifecycleSlice,
  type PageLifecycle,
  type SaveStatus,
  type PublishStatus,
  INITIAL_LIFECYCLE,
  reflectLifecyclePatch,
  markDirtyPatch,
  setSaveStatusPatch,
  setPublishStatusPatch,
} from './constructor.lifecycle'
import {
  addPagePatch,
  setPagesPatch,
  updatePagePatch,
  removePagePatch,
  reorderPageNodesPatch,
  addNodePatch,
  updateNodePatch,
  removeNodePatch,
  insertNodePatch,
  insertNodesPatch,
  moveNodePatch,
} from './constructor.pages'

// ── Full Store ─────────────────────────────────────────────────────────────────

export interface ConstructorStore extends ConstructorSession, StudioUiSlice, HistorySlice, LifecycleSlice {
  /**
   * Select ONE part by its address — the SINGLE selection entry (ADR-041 ROOT-3).
   * `selectNode`/`selectItem`/`selectChrome` are named ergonomic wrappers that
   * construct the address for a whole node / a band item / a chrome region; every
   * selection funnels through this ONE `selection` state, from which the node/item
   * reads (`selectedNodeId`/`selectedItemPath`) are DERIVED (constructor.selectors) —
   * never independently set (FF-ONE-SELECTION-ADDRESS).
   */
  select:         (address: SelectionAddress | null) => void
  selectNode:     (id: string | null) => void
  /**
   * Select a bounded PART within a node — the bounded-element selection (ADR-038/
   * ADR-041). `path` is the part's `PartAddress.partPath`: positional `'items.0'`
   * for a value band, or the Delta-1 STABLE key `'main.year'` for a sourced (filter)
   * band. Derived generically from the node's declared PartField; never keyed by a
   * concrete type. Selecting a part pins its owning node AND the part path together.
   */
  selectItem:     (nodeId: string, path: string) => void

  // Data Layer actions
  addDataSource:     (ds: DataSourceDef) => void
  setDataSources:    (sources: DataSourceDef[]) => void
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
  updateNavItem:    (id: string, patch: Partial<NavItem>) => void
  removeNavItem:    (id: string) => void

  // Chrome authoring — per-slot chrome config + selection (S6: chrome is a Part).
  /**
   * Select a chrome region by its slot — the ergonomic wrapper over the ONE
   * `select({ nodeId: SITE_FRAME_ID, partPath: chromePartPath(slot) })` (ADR-041 R4).
   * `null` clears the selection. Chrome is a `sourced` Part of the site-frame, so this
   * writes the SAME `PartAddress` grammar as `selectItem`; the dock then projects the
   * region's registered per-slot schema through the generic `element.schema` section.
   */
  selectChrome:        (slot: string | null) => void
  setChromeVariant:    (slot: string, key: string) => void
  updateChromeConfig:  (slot: string, field: string, value: unknown) => void

  // Page Layer actions
  addPage:          (page: CanvasPage) => void
  /** Idempotent HYDRATE — replaces the whole pages collection (boot load, not a user edit). */
  setPages:         (pages: CanvasPage[]) => void
  updatePage:       (id: string, patch: Partial<Omit<CanvasPage, 'nodes'>>) => void
  removePage:       (id: string) => void
  setActivePage:    (id: string | null) => void
  reorderPageNodes: (pageId: string, orderedNodeIds: string[]) => void
  addNode:          (pageId: string, node: CanvasNode, afterId?: string) => void
  updateNode:       (pageId: string, nodeId: string, patch: Partial<CanvasNode>) => void
  removeNode:       (pageId: string, nodeId: string) => void
  /** Insert a NEW node into a container (parentId === pageId ⇒ top-level) at an index. */
  insertNode:       (pageId: string, node: CanvasNode, parentId: string, index?: number) => void
  /** Insert an ORDERED sequence of nodes as ONE undoable action — the auto-wrap
   *  primitive (page → section → node). Ops are folded in order so a wrapper op
   *  precedes any op nesting under it. Byte-identical to the composed single inserts. */
  insertNodes:      (pageId: string, ops: ReadonlyArray<{ node: CanvasNode; parentId: string; index?: number }>) => void
  /** Move an EXISTING node to a container at an index — Outline reorder / re-nest. */
  moveNode:         (pageId: string, nodeId: string, parentId: string, index?: number) => void

  // History
  undo: () => void
  redo: () => void

  // Page lifecycle (server FSM mirror + save/publish UI state)
  reflectLifecycle: (id: string, patch: Partial<PageLifecycle>) => void
  markPageDirty:    (id: string) => void
  setSaveStatus:    (id: string, status: SaveStatus) => void
  setPublishStatus: (id: string, status: PublishStatus) => void
}

// ── Store factory ─────────────────────────────────────────────────────────────

export const useConstructorStore = create<ConstructorStore>()(
  devtools(
    subscribeWithSelector((set) => ({
      // ── Initial state ──────────────────────────────────────────────────────
      ...INITIAL_SESSION,
      ...INITIAL_LIFECYCLE,
      selection:      null,
      undoStack:      [],
      redoStack:      [],
      canUndo:        false,
      canRedo:        false,

      // ── Selection — ONE address, three ergonomic constructors (ADR-041 Ph.3) ─
      //  Every selection writes the ONE `selection` address; the legacy triple is a
      //  DERIVED read of it (constructor.selectors). Because there is ONE address, a
      //  new selection inherently clears the prior one — mutual exclusivity by
      //  construction (one Inspector shows one element; least astonishment).
      select: (address) =>
        set({ selection: address }, false, 'canvas/select'),
      // Whole node — `PartAddress` with no `partPath` (clears item + chrome).
      selectNode: (id) =>
        set({ selection: id == null ? null : { nodeId: id } as PartAddress }, false, 'canvas/selectNode'),
      // A bounded PART (ADR-038/ADR-041): the owning node + the part's `partPath`
      // (positional for value, Delta-1 stable key for sourced) — the address IS the
      // pin; no concrete type is consulted.
      selectItem: (nodeId, path) =>
        set({ selection: { nodeId, partPath: path } as PartAddress }, false, 'canvas/selectItem'),

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
      // Replace the whole sources list with the server's authoritative set — the
      // refresh path after an out-of-band write (e.g. an Excel ingest publishes new
      // gold data + may register a source). Not history-tracked: a server-state sync
      // is not a user edit to undo.
      setDataSources: (sources) =>
        set({ dataSources: sources }, false, 'data/setDataSources'),
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
      updateNavItem: (id, patch) =>
        set(
          (s) => ({
            ...pushHistory(s as ConstructorStore, `Update Nav Item`),
            site: {
              ...s.site,
              nav: s.site.nav.map((n) => (n.id === id ? { ...n, ...patch } : n)),
            },
          }),
          false,
          'site/updateNavItem',
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

      // ── Chrome authoring (S6) — chrome is a Part; select via the ONE address ──
      //  The ergonomic wrapper builds the site-frame chrome PartAddress. Because there
      //  is ONE `selection`, this inherently clears any prior node/item/chrome selection
      //  (mutual exclusivity by construction). Selection never dirties the site — a first
      //  EDIT seeds the ChromeSlotConfig (updateChromeConfigPatch), not selection.
      selectChrome: (slot) =>
        set(
          { selection: slot == null ? null : { nodeId: SITE_FRAME_ID, partPath: chromePartPath(slot) } as PartAddress },
          false,
          'chrome/selectChrome',
        ),
      setChromeVariant: (slot, key) =>
        set(
          (s) => ({ ...pushHistory(s as ConstructorStore, `Set chrome variant: ${slot}`), ...setChromeVariantPatch(s, slot, key) }),
          false,
          'chrome/setVariant',
        ),
      updateChromeConfig: (slot, field, value) =>
        set(
          (s) => ({ ...pushHistory(s as ConstructorStore, `Edit chrome: ${slot}`), ...updateChromeConfigPatch(s, slot, field, value) }),
          false,
          'chrome/updateConfig',
        ),

      // ── Page Layer — thin wiring over pure reducers (constructor.pages) ──────
      addPage: (page) =>
        set((s) => ({ ...pushHistory(s as ConstructorStore, `Add Page: ${page.title.en}`), ...addPagePatch(s, page) }), false, 'pages/addPage'),
      // Replace the whole pages set with the server's authoritative load — mirrors
      // setDataSources: a server-state sync is not a user edit, so it is NOT
      // history-tracked (an undo must never "unload" a hydrated page), and it is a
      // REPLACE, not an append, so re-running hydrate (StrictMode double-invoke,
      // re-init after re-login) is idempotent — no duplicate page ids.
      setPages: (pages) =>
        set(setPagesPatch(pages), false, 'pages/setPages'),
      updatePage: (id, patch) =>
        set((s) => ({ ...pushHistory(s as ConstructorStore, `Update Page`), ...updatePagePatch(s, id, patch) }), false, 'pages/updatePage'),
      removePage: (id) =>
        set((s) => ({ ...pushHistory(s as ConstructorStore, `Remove Page`), ...removePagePatch(s, id) }), false, 'pages/removePage'),
      setActivePage: (id) => set({ activePageId: id }, false, 'pages/setActivePage'),
      reorderPageNodes: (pageId, orderedNodeIds) =>
        set((s) => ({ ...pushHistory(s as ConstructorStore, `Reorder Sections`), ...reorderPageNodesPatch(s, pageId, orderedNodeIds) }), false, 'canvas/reorderNodes'),
      addNode: (pageId, node, afterId) =>
        set((s) => ({ ...pushHistory(s as ConstructorStore, `Add ${node.type}`), ...addNodePatch(s, pageId, node, afterId) }), false, 'canvas/addNode'),
      updateNode: (pageId, nodeId, patch) =>
        set((s) => ({ ...pushHistory(s as ConstructorStore, `Update node`), ...updateNodePatch(s, pageId, nodeId, patch) }), false, 'canvas/updateNode'),
      removeNode: (pageId, nodeId) =>
        set((s) => ({ ...pushHistory(s as ConstructorStore, `Remove node`), ...removeNodePatch(s, pageId, nodeId) }), false, 'canvas/removeNode'),
      insertNode: (pageId, node, parentId, index) =>
        set((s) => ({ ...pushHistory(s as ConstructorStore, `Add ${node.type}`), ...insertNodePatch(s, pageId, node, parentId, index) }), false, 'canvas/insertNode'),
      insertNodes: (pageId, ops) =>
        set((s) => ({ ...pushHistory(s as ConstructorStore, `Add ${ops.at(-1)?.node.type ?? 'node'}`), ...insertNodesPatch(s, pageId, ops) }), false, 'canvas/insertNodes'),
      moveNode: (pageId, nodeId, parentId, index) =>
        set((s) => ({ ...pushHistory(s as ConstructorStore, `Move node`), ...moveNodePatch(s, pageId, nodeId, parentId, index) }), false, 'canvas/moveNode'),

      // ── Page lifecycle (server FSM mirror) — thin wiring over pure reducers ──
      // These reflect SERVER truth + authoring UI state; deliberately NOT pushed
      // to history (lifecycle/save outcomes are not undoable authoring edits).
      reflectLifecycle: (id, patch) =>
        set((s) => reflectLifecyclePatch(s, id, patch), false, 'lifecycle/reflect'),
      markPageDirty: (id) =>
        set((s) => markDirtyPatch(s, id), false, 'lifecycle/markDirty'),
      setSaveStatus: (id, status) =>
        set((s) => setSaveStatusPatch(s, id, status), false, 'lifecycle/setSaveStatus'),
      setPublishStatus: (id, status) =>
        set((s) => setPublishStatusPatch(s, id, status), false, 'lifecycle/setPublishStatus'),

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
              // Preserve the ONE selection address (session UI state — the snapshot
              // carries only ConstructorSession, so history never disturbs selection).
              selection: s.selection,
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
              selection: s.selection,
            }
          },
          false,
          'history/redo',
        ),
    })),
    { name: 'ConstructorStore' },
  ),
)

// Typed read-side selectors live in constructor.selectors (ISP, one concern per
// file). Re-exported here so existing `from './constructor.store'` imports hold.
export * from './constructor.selectors'
