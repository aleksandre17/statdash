// ── RenderTarget: API JSON [N27] ─────────────────────────────────────────
//
//  Produces a structured data snapshot from any NodePageConfig + a static
//  context — the JSON sibling of renderPageToHTML (targets/html.tsx).
//
//  Architecture (multi-target from one config):
//    NodePageRenderer(page)             → interactive DOM (React mount)
//    renderPageToHTML(page, staticCtx)  → static HTML (bulletin · cache · PDF pipeline)
//    renderPageToJSON(page, staticCtx)  → data snapshot (API · cache · export)
//
//  No React, no DOM.  Pure TypeScript data function.
//  Walks the node tree generically — no registry lookups, no JSX.
//  Any field that is an array of objects with `type: string` is treated as
//  child nodes (covers children, sections, items, header, footer, …).
//

import type { DataSpec, SectionContext } from '@statdash/engine'
import { interpretSpec }                  from '@statdash/engine'
import type { NodeDataFrame }             from '@statdash/engine'
import { deriveFieldSchema }              from '@statdash/engine'
import { listExportFormats, getExportFormat } from '@statdash/engine'
import type { NodePageConfig }            from '../types'
import type { StaticRenderContext }       from './html'
import { resolveStore }                   from '../resolveNodeRows'
import { collectChildNodes }              from './nodeWalk'
import { warmPageStore }                  from './warm'
import type { SnapshotScope }             from './warm'
import { activeViewGate }                 from './warm'
import { isNodeVisibleInActiveView }      from './visibilityGate'
import type { VisibilityGate }            from './visibilityGate'

// ── Output types ─────────────────────────────────────────────────────────

export type NodeStatus = 'ok' | 'empty' | 'error'

export interface DataNotice {
  severity:  'error' | 'warning' | 'info'
  text:      string
  specType?: string
}

/**
 * Slim descriptor for a registered export format.
 * Carries only the display/routing fields — the serialize fn is not exposed
 * across the API boundary (not JSON-serialisable).
 */
export interface ExportFormatInfo {
  id:     string
  label?: string
  mime?:  string
  ext?:   string
}

/** One entry per node in the page tree that carries a DataSpec. */
export interface NodeDataEntry {
  /** node.id if present */
  id?:      string
  /** node.type discriminant */
  type:     string
  /** node.variant if present */
  variant?:       string
  /** Display title — from node.view?.title, node.view?.subtitle, or node.title */
  title?:         string
  /** DataSpec type that produced the frame (e.g. 'timeseries', 'query') */
  specType?:      string
  /** Resolution status for this node's data. */
  status:   NodeStatus
  /** Notices (errors, warnings) produced during data resolution. */
  notices?: DataNotice[]
  /** Resolved frame (schema + rows) — absent if no DataSpec or resolution failed. */
  frame?:   NodeDataFrame
  /** Export formats available for this node's data. Present when frame is populated. */
  exportFormats?: ExportFormatInfo[]
  /** Recursive — mirrors the node tree structure. */
  children: NodeDataEntry[]
}

/** Full page data snapshot — the JSON output of renderPageToJSON. */
export interface PageDataSnapshot {
  /** Page node.id if present. */
  pageId?:        string
  /** Config schema version (from page.schemaVersion if present). */
  schemaVersion?: number
  /** Locale used for this snapshot. */
  locale:         string
  /** Fallback locale used for this snapshot. */
  fallbackLocale: string
  /** Active filter params at snapshot time. */
  filterParams:   Record<string, unknown>
  /** The context snapshot used for resolution. */
  sectionCtx:     SectionContext
  /** Rollup status: ok = all nodes ok, partial = some errors, error = all errored. */
  status:         'ok' | 'partial' | 'error'
  /** Top-level entries (the page node + all descendants). */
  nodes:          NodeDataEntry[]
  /** ISO 8601 timestamp of snapshot generation. */
  generatedAt:    string
  /** Wall-clock duration of snapshot generation in milliseconds. */
  durationMs:     number
}

// ── Status rollup helpers ─────────────────────────────────────────────────

function collectStatuses(entries: NodeDataEntry[]): NodeStatus[] {
  const all: NodeStatus[] = []
  for (const e of entries) {
    all.push(e.status)
    all.push(...collectStatuses(e.children))
  }
  return all
}

function rollupStatus(entries: NodeDataEntry[]): 'ok' | 'partial' | 'error' {
  const statuses = collectStatuses(entries)
  if (statuses.length === 0)              return 'ok'
  if (statuses.every(s => s !== 'error')) return 'ok'
  if (statuses.every(s => s === 'error')) return 'error'
  return 'partial'
}

// ── Internal helpers — see nodeWalk.ts (isNodeObject, collectChildNodes) ─────

/**
 * Recursively walk a node and produce its NodeDataEntry.
 *
 * Data resolution: if node has a `data` field, call interpretSpec and capture
 * the result as a NodeDataFrame.  A data error on one node records a notice and
 * sets status='error' — it must not abort the whole snapshot.
 */
function walkNode(
  node:  Record<string, unknown> & { type: string },
  ctx:   StaticRenderContext,
  gate:  VisibilityGate | undefined,
): NodeDataEntry {
  const entry: NodeDataEntry = {
    type:     node['type'],
    status:   'ok',
    children: [],
  }

  if (typeof node['id'] === 'string') {
    entry.id = node['id']
  }

  // ── P-opt: active-perspective gate ──────────────────────────────────────
  // A node hidden by `view.visibleWhen` in the active perspective is NEVER
  // resolved on the live DOM (renderNode.ts:228 returns null before
  // resolveNodeRows). Mirror that here: no data resolution, no descent into
  // the hidden subtree — the entry is status:'empty' (present in the tree but
  // carrying no frame), exactly the live behaviour. When `gate` is undefined
  // (`snapshot:'all-perspectives'`) every node resolves = the pre-P-opt union.
  if (gate && !isNodeVisibleInActiveView(node, gate)) {
    entry.status = 'empty'
    return entry
  }

  // ── G3: Node metadata (variant, title, specType) ───────────────────────
  const variant  = typeof node['variant'] === 'string' ? node['variant'] : undefined
  const view     = node['view'] as Record<string, unknown> | undefined
  const title    = typeof view?.['title'] === 'string'    ? view['title']
                 : typeof view?.['subtitle'] === 'string' ? view['subtitle']
                 : typeof node['title'] === 'string'      ? node['title']
                 : undefined
  const specType = node['data'] !== undefined && node['data'] !== null
                 ? (node['data'] as Record<string, unknown>)['type'] as string | undefined
                 : undefined

  if (variant)  entry.variant  = variant
  if (title)    entry.title    = title
  if (specType) entry.specType = specType

  // ── Data resolution ────────────────────────────────────────────────────
  if (node['data'] !== undefined && node['data'] !== null) {
    const store = resolveStore({ stores: ctx.stores, pageStoreKey: ctx.pageStoreKey })
    try {
      const allRows  = interpretSpec(node['data'] as DataSpec, ctx.sectionCtx, store)
      const rowLimit = (node['data'] as Record<string, unknown>)['rowLimit']
      const limit    = typeof rowLimit === 'number' ? rowLimit : undefined

      let rows:       typeof allRows
      let totalRows:  number | undefined
      let truncated:  boolean | undefined

      if (limit !== undefined && allRows.length > limit) {
        rows      = allRows.slice(0, limit)
        totalRows = allRows.length
        truncated = true
      } else {
        rows      = allRows
        totalRows = allRows.length
        truncated = false
      }

      if (rows.length === 0) {
        entry.status = 'empty'
      } else {
        entry.status = 'ok'
        entry.frame = {
          schema: { fields: deriveFieldSchema(node['data'] as DataSpec, rows) },
          rows,
          totalRows,
          truncated,
        }
        // ── G7: Per-node export formats ──────────────────────────────────
        const formats = listExportFormats()
        if (formats.length > 0) {
          entry.exportFormats = formats.map(id => {
            const fmt = getExportFormat(id)
            return fmt
              ? { id, label: fmt.label, mime: fmt.mime, ext: fmt.ext }
              : { id }
          })
        }
      }
    } catch (e) {
      entry.status = 'error'
      const errSpecType = (node['data'] as Record<string, unknown>)['type'] as string | undefined
      entry.notices = [{
        severity: 'error',
        text:     e instanceof Error ? e.message : String(e),
        specType: errSpecType,
      }]
    }
  }

  // ── Recurse into child nodes ───────────────────────────────────────────
  const childNodeObjects = collectChildNodes(node)
  for (const child of childNodeObjects) {
    entry.children.push(walkNode(child, ctx, gate))
  }

  return entry
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Walk a `NodePageConfig` and return a structured snapshot of all page data.
 *
 * Every node in the tree that carries a `data` field has its DataSpec
 * resolved against `staticCtx.sectionCtx` + the resolved store.  The
 * result mirrors the node tree structure as `NodeDataEntry` objects.
 *
 * No React rendering occurs — pure TypeScript data function.
 *
 * Pass `opts.warm: true` to pre-warm the store before walking (useful when
 * the store supports batched prefetch — e.g. CachedStore).
 *
 * Perspective-aware (P-opt): by default (`opts.snapshot:'active'`) only the
 * ACTIVE perspective's nodes resolve — a node hidden by `view.visibleWhen` in
 * the active perspective yields `status:'empty'` with no frame, exactly as the
 * live DOM never resolves it (`renderNode.ts:228`). This makes the active-view
 * snapshot render-equivalent to the active-view live render. Pass
 * `opts.snapshot:'all-perspectives'` to resolve the union of every perspective
 * (a self-contained export, preserving Law-9 completeness). `snapshot` is a
 * render-CALL option, not a config field — render-intent (Vision #3 SYNTHESIS).
 *
 * ```ts
 * const snapshot = renderPageToJSON(myPage, {
 *   sectionCtx: { dims: { time: 2024 }, timeMode: 'year' },
 *   stores:     { main: myStore },
 *   filterParams: { time: '2024' },
 *   locale: appLocale, fallbackLocale: 'en',
 *   timeModeKey: 'mode',
 *   mode: { current: 'year', modes: [], set: () => {} },
 *   effects: [],
 * })
 * ```
 */
export function renderPageToJSON(
  page:      NodePageConfig,
  staticCtx: StaticRenderContext,
  opts?:     { warm?: boolean; snapshot?: SnapshotScope },
): PageDataSnapshot {
  const t0 = Date.now()

  const scope: SnapshotScope = opts?.snapshot ?? 'active'
  const gate = activeViewGate(staticCtx, scope)

  if (opts?.warm) {
    warmPageStore(page, staticCtx, { snapshot: scope })
  }

  const pageEntry = walkNode(page as unknown as Record<string, unknown> & { type: string }, staticCtx, gate)

  const nodes = [pageEntry]

  return {
    pageId:        typeof (page as unknown as Record<string, unknown>)['id'] === 'string'
                     ? (page as unknown as Record<string, unknown>)['id'] as string
                     : undefined,
    schemaVersion: typeof (page as unknown as Record<string, unknown>)['schemaVersion'] === 'number'
                     ? (page as unknown as Record<string, unknown>)['schemaVersion'] as number
                     : undefined,
    locale:        staticCtx.locale,
    fallbackLocale: staticCtx.fallbackLocale,
    filterParams:  staticCtx.filterParams,
    sectionCtx:    staticCtx.sectionCtx,
    status:        rollupStatus(nodes),
    nodes,
    generatedAt:   new Date().toISOString(),
    durationMs:    Date.now() - t0,
  }
}
