import type {
  DataSourceDef, NamedDataSpec,
  SiteDef,
  CanvasPage,
  ChromeSelection,
  StudioSurface,
} from '../types/constructor'
import { DEFAULT_STUDIO_SURFACE } from '../types/constructor'

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

// ── Studio UI ───────────────────────────────────────────────────────────────

export interface StudioUiSlice {
  /**
   * The Studio activity-rail surface currently shown in the left dock (AR-49).
   * A NON-ordered lens summoned over the always-mounted canvas — it replaced the
   * retired wizard's ordered `activeStep`/`completedSteps` gating (M1.3b).
   * Preserved across undo/redo like the other UI-navigation fields (view state,
   * not an undoable edit).
   */
  activeSurface:   StudioSurface
  selectedNodeId:  string | null
  /** The selected chrome element (Phase C). Mutually exclusive with a node. */
  chromeSelection: ChromeSelection | null
}

/** The Studio surface the session opens on — re-exported for store init/tests. */
export const INITIAL_STUDIO_SURFACE = DEFAULT_STUDIO_SURFACE

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
