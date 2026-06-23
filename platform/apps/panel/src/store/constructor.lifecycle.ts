// ── constructor.lifecycle — server-reflected page FSM + save-report UI state ──
//
//  The page lifecycle (draft → published → archived) is a SERVER FSM (config.page
//  status + page_version.is_published). The Constructor MUST NOT reimplement that
//  state machine client-side; it REFLECTS what the server reports after each
//  read/write. So lifecycle is modelled SEPARATELY from the authored CanvasPage:
//
//    - CanvasPage   = the editable artifact (nodes/title/slug). Round-trips
//                     losslessly through the canvas adapter — adding lifecycle
//                     fields here would break that invariant (Separation of
//                     Concerns: config vs lifecycle).
//    - PageLifecycle = server truth ABOUT a page (status, latest version,
//                     whether the latest version is the published one). Keyed by
//                     page id, updated only from API responses.
//
//  Plus transient authoring UI state: the last save-guard report (so the page
//  workflow can render which node/field blocked the save) and the last publish
//  error (so a 403 surfaces as "needs publisher/admin" without inventing roles).
//
import type { SaveIssue } from '../save/saveGuard'

// ── Server FSM mirror ─────────────────────────────────────────────────────────

/** Lifecycle status as reported by the server FSM. */
export type PageStatus = 'draft' | 'published' | 'archived'

/**
 * Server-reflected lifecycle for one page. Never authored — only set from an API
 * response (list/get/save/publish). `dirty` is the one client-derived bit: the
 * page has unsaved store edits since the last persisted version.
 */
export interface PageLifecycle {
  status:        PageStatus
  /** Latest persisted version number (undefined until first load/save). */
  versionNumber?: number
  /** True when the latest version is the published one (GET /:id LATERAL join). */
  latestPublished: boolean
  /** True when there are local edits not yet persisted to a version. */
  dirty: boolean
}

/** Result of the last save attempt for a page — drives the inline guard UI. */
export interface SaveStatus {
  /** The save-guard issues that blocked the last save (empty when it passed). */
  issues: SaveIssue[]
  /** A non-guard failure message (network/server), if the API call itself failed. */
  error?: string
  /** True the instant a guarded save succeeded (transient success affordance). */
  saved: boolean
}

/** Result of the last publish attempt — `forbidden` reflects a server 403. */
export interface PublishStatus {
  /** True when the server returned 403 — the user lacks the publisher/admin role. */
  forbidden: boolean
  /** Any other publish failure message. */
  error?: string
}

// ── Slice shape ────────────────────────────────────────────────────────────────

export interface LifecycleSlice {
  /** Server FSM mirror, keyed by page id. */
  lifecycle: Record<string, PageLifecycle>
  /** Last save attempt per page id (cleared on a fresh edit). */
  saveStatus: Record<string, SaveStatus>
  /** Last publish attempt per page id. */
  publishStatus: Record<string, PublishStatus>
}

export const INITIAL_LIFECYCLE: LifecycleSlice = {
  lifecycle:     {},
  saveStatus:    {},
  publishStatus: {},
}

// ── Pure reducers (state → patch) ────────────────────────────────────────────
//
//  Mirrors the constructor.chrome split: the store wires thin actions over these
//  pure functions. Each returns ONLY the slice keys it changes (a partial set()).

function defaultLifecycle(): PageLifecycle {
  return { status: 'draft', latestPublished: false, dirty: false }
}

/** Merge a server-reported lifecycle patch for one page (read/save/publish). */
export function reflectLifecyclePatch(
  s: LifecycleSlice,
  id: string,
  patch: Partial<PageLifecycle>,
): Pick<LifecycleSlice, 'lifecycle'> {
  const prev = s.lifecycle[id] ?? defaultLifecycle()
  return { lifecycle: { ...s.lifecycle, [id]: { ...prev, ...patch } } }
}

/** Mark a page dirty (local edit since last persisted version). */
export function markDirtyPatch(
  s: LifecycleSlice,
  id: string,
): Pick<LifecycleSlice, 'lifecycle' | 'saveStatus'> {
  const prev = s.lifecycle[id] ?? defaultLifecycle()
  // A fresh edit invalidates the previous save outcome (no longer accurate).
  const { [id]: _dropped, ...restSave } = s.saveStatus
  return {
    lifecycle:  { ...s.lifecycle, [id]: { ...prev, dirty: true } },
    saveStatus: restSave,
  }
}

/** Record the outcome of a save attempt (guard issues, network error, or success). */
export function setSaveStatusPatch(
  s: LifecycleSlice,
  id: string,
  status: SaveStatus,
): Pick<LifecycleSlice, 'saveStatus'> {
  return { saveStatus: { ...s.saveStatus, [id]: status } }
}

/** Record the outcome of a publish attempt (403 → forbidden, else error/clear). */
export function setPublishStatusPatch(
  s: LifecycleSlice,
  id: string,
  status: PublishStatus,
): Pick<LifecycleSlice, 'publishStatus'> {
  return { publishStatus: { ...s.publishStatus, [id]: status } }
}
