import type { PartAddress } from '@statdash/react/engine'
import type {
  DataSourceDef, NamedDataSpec,
  SiteDef,
  CanvasPage,
} from '../types/constructor'

// ── History (undo/redo) ───────────────────────────────────────────────────────
// Command-pattern: each mutating action pushes a snapshot to undoStack.
// Undo pops and restores; Redo pops from redoStack.
//
// Split out of constructor.store.ts (one concern per file): this module owns the
// session shape, the Studio-UI slice, the history slice, and the snapshot/push
// helpers. The store module owns only the action wiring.

export interface HistoryEntry {
  label:    string
  snapshot: ConstructorSession
}

export interface HistorySlice {
  undoStack: HistoryEntry[]
  redoStack: HistoryEntry[]
  canUndo:   boolean
  canRedo:   boolean
}

// ── Session ───────────────────────────────────────────────────────────────────

export interface ConstructorSession {
  // Layer 1
  dataSources: DataSourceDef[]
  dataSpecs:   NamedDataSpec[]
  // Layer 2
  site:        SiteDef
  // Layer 3
  pages:       CanvasPage[]
  activePageId: string | null
}

// ── Selection address — ONE completed Composite address (ADR-039 · ADR-041 R4) ───
//
//  The old selection TRIPLE (`selectedNodeId` · `selectedItemPath` · `chromeSelection`)
//  collapses to this ONE `PartAddress` (ADR-041 ROOT-3 · Delta 1) — arm count 1. Every
//  selectable thing is a part addressed `(nodeId, partPath?)`:
//    • whole node        → `{ nodeId }`                               (partPath undefined)
//    • value-band item   → `{ nodeId, partPath: 'items.0' }`          (positional — value)
//    • sourced item      → `{ nodeId, partPath: 'main.year' }`        (stable key — sourced)
//    • chrome region      → `{ nodeId: SITE_FRAME_ID, partPath: 'chrome.<slot>' }` (S6 —
//        a `sourced` part of the site-frame; the retired `ChromeSelection` `kind:'chrome'`
//        arm folded into this ONE address, so chrome is a part like any other).
//  The two legacy node/item reads are DERIVED projections of THIS one address
//  (constructor.selectors), never independently settable — FF-ONE-SELECTION-ADDRESS.
export type SelectionAddress = PartAddress

// ── Studio UI ───────────────────────────────────────────────────────────────

export interface StudioUiSlice {
  // The Studio activity-rail surface is NO LONGER store state — it is URL state
  // (`/studio/:surface`, the single source of truth; see studio/useStudioRoute.ts).
  // This slice now carries only the EPHEMERAL selection address (node/item/chrome),
  // collapsed to ONE `SelectionAddress` (the selection triple is derived from it).
  selection: SelectionAddress | null
}

// ── Initial state ─────────────────────────────────────────────────────────────

const INITIAL_SITE: SiteDef = {
  name:               '',
  defaultLocale:      'ka',
  // Empty until the site read projects config.locale — useActiveLocales falls
  // back to [defaultLocale]/['ka','en'] so LocaleField never authors empty.
  activeLocales:      [],
  nav:                [],
  themeOverrides:     {},
  dataSourceBindings: {},
  chrome:             {},
}

export const INITIAL_SESSION: ConstructorSession = {
  dataSources:  [],
  dataSpecs:    [],
  site:         INITIAL_SITE,
  pages:        [],
  activePageId: null,
}

// ── Snapshot helpers ──────────────────────────────────────────────────────────

export function snapshot(state: ConstructorSession): ConstructorSession {
  return {
    dataSources:  state.dataSources,
    dataSpecs:    state.dataSpecs,
    site:         state.site,
    pages:        state.pages,
    activePageId: state.activePageId,
  }
}

export function pushHistory(
  state: ConstructorSession & HistorySlice,
  label: string,
): Pick<HistorySlice, 'undoStack' | 'redoStack' | 'canUndo' | 'canRedo'> {
  const entry: HistoryEntry = { label, snapshot: snapshot(state) }
  const undoStack = [...state.undoStack.slice(-49), entry]   // cap at 50
  return { undoStack, redoStack: [], canUndo: true, canRedo: false }
}
