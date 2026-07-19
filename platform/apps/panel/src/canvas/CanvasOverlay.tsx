// ── CanvasOverlay — selection frames + slot drop zones over the renderer ──
//
//  N35: the transparent interaction layer of the WYSIWYG canvas. It does NOT
//  render content — it walks the same NodePageConfig the renderer drew, then
//  positions one frame per node and one drop zone per registered SlotDef.
//
//  Positioning: the canvas-anchor middleware (setupCanvasRegistry) stamps each
//  rendered node with the ONE `data-part-*` node-anchor family (PART_NODE_ID_ATTR).
//  The overlay measures those anchors via getBoundingClientRect() relative to the
//  canvas root, so frames track the real rendered geometry without the engine
//  knowing the editor exists.
//
//  ADR-041 Phase 4 — the anchor merge + slotParts wiring: node anchors AND value/
//  sourced band-item anchors share ONE `data-part-*` query family, so the overlay
//  measures both through a single path. And the node-frame TREE is now derived by
//  RECURSING the ONE Part port (`enumerateParts`): a slot part is a whole child node
//  framed through the port (its merged node anchor), value/sourced parts become item
//  frames. A transitional `walkNodes` pass is retained as a fallback so no node loses
//  its frame (Strangler EXPAND — byte-identical frame set; the walk is removed in a
//  later contract phase).
//
//  Slot taxonomy: drop zones come straight from nodeRegistry.getSlots(type) —
//  the SlotDef.accepts list IS the drag-accept contract. No new fields invented.
//
import { useLayoutEffect, useRef, useState, useCallback } from 'react'
import {
  nodeRegistry,
  PART_FIELD_ATTR, PART_INDEX_ATTR, PART_NODE_ID_ATTR,
  SITE_FRAME_ID, SITE_FRAME_META,
} from '@statdash/react/engine'
import type { NodeBase, SlotDef, ObjectMeta, ChromeSlotConfig, ChromeEntry } from '@statdash/react/engine'
import type { FilterSchemaInput }    from '@statdash/engine'
import { resolveLocaleString }       from '@statdash/engine'
import { walkNodes }                 from './walkNodes'
import type { WalkedNode }           from './walkNodes'
import { enumerateParts }            from './bandSource'
import { AUTOWRAP_CONTAINER, nestAccepts } from './insertNode'
import { hasMetricDrag, readMetricDrag } from '../discovery/metricDrag'

// ── Measured geometry, relative to the canvas root ────────────────────────

interface Rect { left: number; top: number; width: number; height: number }

interface NodeFrame extends WalkedNode { id: string; rect: Rect }
/** A per-slot drop target. `empty` = the slot holds no rendered child (its rect is an
 *  allocated placeholder band, not a measured child-union) — such zones show their
 *  labelled affordance AT REST so the author sees where content goes without dragging. */
interface DropFrame { parentId: string; slotKey: string; slot: SlotDef; rect: Rect; empty: boolean }
/** A selectable value-band item frame — the bounded-element hit target (ADR-038). */
interface ItemFrame { nodeId: string; path: string; rect: Rect }
/** A selectable chrome-region frame (S6) — a `sourced` Part of the site-frame, addressed
 *  by the ONE `PartAddress` (`{ SITE_FRAME_ID, chrome.<slot> }`) like any other part. */
interface ChromeFrame { slot: string; path: string; rect: Rect }

// ── Per-slot drop geometry (0102 R1 — the "no overlap" fix) ────────────────
//
//  The overlay must give EACH declared slot its OWN rect, so a node with ≥2 slots
//  (inner-page = sticky + main) no longer stacks N identical dropzones + labels on the
//  parent's single box. Generic over the declared Part slots (ADR-041) — never a per-type
//  branch: a slot's region is DERIVED from where its declared children actually rendered.
//
//   • populated slot → the UNION of its children's measured anchor boxes (the real region
//     the renderer laid the slot's content into).
//   • empty slot     → an allocated placeholder BAND inside the node box (there is no
//     rendered region to measure). Bands are laid in the residual space NOT occupied by the
//     node's populated slots, so a slot band never shares a box with a sibling slot.
//
//  Minimum band height so an allocated empty-slot zone stays a usable, labelled target.
const EMPTY_BAND_MIN = 32

/** Smallest axis-aligned box covering every input rect. */
function unionRect(rects: Rect[]): Rect {
  let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity
  for (const x of rects) {
    l = Math.min(l, x.left); t = Math.min(t, x.top)
    r = Math.max(r, x.left + x.width); b = Math.max(b, x.top + x.height)
  }
  return { left: l, top: t, width: r - l, height: b - t }
}

/** The ids of the child nodes residing in `node[field]` (array or single). Generic —
 *  reads the slot's declared residence field, never a per-type child accessor. */
function slotChildIds(node: NodeBase, field: string): string[] {
  const raw = (node as unknown as Record<string, unknown>)[field]
  const arr = Array.isArray(raw) ? raw : raw != null ? [raw] : []
  const ids: string[] = []
  for (const c of arr) {
    const id = c && typeof c === 'object' ? (c as { id?: unknown }).id : undefined
    if (typeof id === 'string') ids.push(id)
  }
  return ids
}

/** Allocate `count` non-overlapping placeholder bands for the node's empty slots. Prefer
 *  the residual space ABOVE the populated content, else BELOW it, else a clamped strip at
 *  the node top (the degenerate "content fills the whole box" case). Deterministic, so a
 *  slot's band is stable across measures. */
function emptyBands(node: Rect, used: Rect[], count: number): Rect[] {
  let top = node.top
  let bottom = node.top + node.height
  if (used.length) {
    const usedTop    = Math.min(...used.map(r => r.top))
    const usedBottom = Math.max(...used.map(r => r.top + r.height))
    const above = usedTop - node.top
    const below = node.top + node.height - usedBottom
    if (above >= count * EMPTY_BAND_MIN)      { top = node.top;    bottom = usedTop }
    else if (below >= count * EMPTY_BAND_MIN) { top = usedBottom;  bottom = node.top + node.height }
    else                                      { bottom = node.top + Math.min(node.height, count * EMPTY_BAND_MIN) }
  }
  const h = (bottom - top) / count
  return Array.from({ length: count }, (_, i) => ({
    left: node.left, top: top + i * h, width: node.width, height: h,
  }))
}

/** Derive one DropFrame per declared slot of `frame`, each with its OWN rect. */
function slotDropsFor(frame: NodeFrame, rectById: Map<string, Rect>): DropFrame[] {
  const slots = nodeRegistry.getSlots(frame.type, frame.variant)
  if (!slots) return []
  const out:     DropFrame[]          = []
  const empties: [string, SlotDef][]  = []
  for (const [slotKey, slot] of Object.entries(slots)) {
    const rects = slotChildIds(frame.node, slot.field)
      .map(id => rectById.get(id))
      .filter((r): r is Rect => !!r)
    if (rects.length) out.push({ parentId: frame.id, slotKey, slot, rect: unionRect(rects), empty: false })
    else empties.push([slotKey, slot])
  }
  if (empties.length) {
    const bands = emptyBands(frame.rect, out.map(d => d.rect), empties.length)
    empties.forEach(([slotKey, slot], i) =>
      out.push({ parentId: frame.id, slotKey, slot, rect: bands[i], empty: true }))
  }
  return out
}

export interface CanvasOverlayProps {
  /** The live NodePageConfig the renderer drew — overlay walks the same tree. */
  page:           NodeBase
  selectedNodeId?: string
  /**
   * The selected value-band item path within the selected node (e.g. `'items.0'`),
   * or undefined for a whole-node selection. Drives the per-item selection frame and
   * suppresses the parent node's own selected chrome while an item is active (so the
   * bounded child, not the whole strip, reads as selected — ADR-038).
   */
  selectedItemPath?: string
  /** True while a palette/move drag is active — reveals drop zones. */
  dragging?:       boolean
  onSelect:       (nodeId: string | null) => void
  /**
   * Select a value-band item (a declared child element) instead of the whole node.
   * Generic — the path is derived from the owning node's declared band field
   * (ADR-038). Absent ⇒ item frames are not rendered (backward-compatible).
   */
  onSelectItem?:  (nodeId: string, path: string) => void
  /**
   * The site's chrome config map (`site.chrome`, keyed by slot) — the SSOT the
   * site-frame's `chromeParts` adapter projects. The overlay enumerates the site-frame's
   * chrome regions through the ONE Part port with this context, then frames each RENDERED
   * region (S6). Absent ⇒ no chrome frames (isolated mounts stay chrome-free). Chrome
   * selection dispatches the ONE `onSelectItem(SITE_FRAME_ID, chrome.<slot>)` — no
   * chrome-specific handler (the `ChromeSelection` arm is retired).
   */
  chrome?:        Record<string, ChromeEntry>
  onDrop:         (parentId: string, slotKey: string, nodeType: string) => void
  /** Active UI locale — resolves each slot's i18n label at render (Law 9). Absent ⇒ 'ka'. */
  locale?:        string
  /**
   * Bind a governed metric dragged from the Metric Palette onto a node frame
   * (AR-49 M0 item 9). Each node frame becomes a metric drop target; the host
   * performs the byte-identical bind write. Absent ⇒ metric drops are ignored.
   */
  onBindMetric?:  (nodeId: string, metricId: string) => void
}

export function CanvasOverlay({
  page, selectedNodeId, selectedItemPath, dragging = false,
  onSelect, onSelectItem, chrome, onDrop, onBindMetric, locale,
}: CanvasOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const [frames, setFrames] = useState<NodeFrame[]>([])
  const [drops,  setDrops]  = useState<DropFrame[]>([])
  const [items,  setItems]  = useState<ItemFrame[]>([])
  const [chromes, setChromes] = useState<ChromeFrame[]>([])
  const [overSlot, setOverSlot] = useState<string | null>(null)
  // The node frame a metric drag is currently hovering (highlight target).
  const [metricOverId, setMetricOverId] = useState<string | null>(null)

  // Measure anchors after every render/resize. Anchors live in the sibling
  // renderer layer; the overlay's offsetParent is the shared .canvas-root.
  const measure = useCallback(() => {
    const overlay = overlayRef.current
    const rootEl  = overlay?.parentElement
    if (!overlay || !rootEl) return

    const base = rootEl.getBoundingClientRect()
    const rel  = (el: Element): Rect => {
      const r = el.getBoundingClientRect()
      return {
        left:   r.left - base.left + rootEl.scrollLeft,
        top:    r.top  - base.top  + rootEl.scrollTop,
        width:  r.width,
        height: r.height,
      }
    }

    // The page-owned filter SSOT rides on the SAME rendered NodePageConfig the canvas
    // draws (projected from page.meta by toNodePageConfig), so a page-owned band source
    // enumerates from the EXACT object that produced the rendered controls — the overlay
    // frames can never drift from what the renderer laid out.
    const filterSchema = (page as unknown as { filterSchema?: FilterSchemaInput }).filterSchema

    const nextFrames: NodeFrame[] = []
    const nextItems:  ItemFrame[] = []
    const framed = new Set<string>()
    // The measured box of every framed node, keyed by id — the SSOT the per-slot drop
    // geometry reads to derive each slot's region from where its children rendered.
    const rectById = new Map<string, Rect>()

    // Frame ONE node through its merged `data-part-*` node anchor, then RECURSE into
    // its declared parts via the ONE Part port. This is the declaration-driven,
    // kind-free frame derivation (FF-DERIVED-CONTAINMENT): the overlay never reads a
    // node's KIND to decide what it contains — it enumerates the parts the node's
    // contract declares and routes each to its residence adapter (slot / value /
    // sourced), never a per-type branch (FF-NO-EXTERNAL-SPECIAL-CASE / FF-ONE-PART-
    // GRAMMAR). A slot part IS a whole child node → framed through the port by THIS
    // recursion (its own merged node anchor). A value/sourced part carries its anchor
    // coordinate `(field,index)` — matching the anchor the part-owning shell stamped
    // (PartAnchor) — AND its ONE `PartAddress.partPath` (positional for value, the
    // Delta-1 STABLE key for sourced), which becomes the selection wire.
    const frameNode = (node: NodeBase) => {
      const id = typeof node.id === 'string' ? node.id : ''
      if (!id || framed.has(id)) return
      framed.add(id)

      const type    = node.type
      const variant = (node as { variant?: string }).variant ?? 'default'

      const anchor = rootEl.querySelector(`[${PART_NODE_ID_ATTR}="${id}"]`)
      // display:contents anchor has no box — measure its first element child. Absent an
      // anchor (a node not rendered — hidden / perspective-gated) contributes nothing.
      const box = anchor?.firstElementChild ?? anchor
      if (!box) return
      const rect = rel(box)
      nextFrames.push({ node, type, variant, id, rect })
      rectById.set(id, rect)

      if (!anchor) return
      const meta = nodeRegistry.getMeta(type, variant) as ObjectMeta | undefined
      const container = node as unknown as Record<string, unknown>
      for (const part of enumerateParts(container, meta, { filterSchema }, id)) {
        if (part.residence === 'slot') {
          // Slot part — a whole child node, framed THROUGH the port by this recursion.
          frameNode(part.subject as unknown as NodeBase)
          continue
        }
        if (!onSelectItem) continue
        const partPath = part.address.partPath
        if (partPath == null) continue
        const itemAnchor = anchor.querySelector(
          `[${PART_FIELD_ATTR}="${part.field}"][${PART_INDEX_ATTR}="${part.index}"]`,
        )
        const ibox = itemAnchor?.firstElementChild ?? itemAnchor
        if (!ibox) continue
        nextItems.push({ nodeId: id, path: partPath, rect: rel(ibox) })
      }
    }

    // Port-driven from the page root, then a transitional `walkNodes` fallback frames
    // any node the port did not reach (a child outside its parent slot's `accepts`, or
    // a node-bearing field not yet declared as a slot). The `framed` set dedupes, so
    // the frame SET stays byte-identical to the walk while slot children now flow
    // through the port (Strangler EXPAND — the walk is the strangled remnant, removed
    // in a later contract phase once every container child is a declared slot part).
    frameNode(page)
    for (const w of walkNodes(page)) frameNode(w.node)

    // Per-slot drop geometry — computed AFTER every node is framed (so each slot's child
    // rects are known). Each declared slot gets its OWN rect (populated → child-union;
    // empty → an allocated band), so multiple slots on one node no longer overlap.
    const nextDrops: DropFrame[] = []
    for (const f of nextFrames) nextDrops.push(...slotDropsFor(f, rectById))

    // ── Chrome regions (S6) — chrome is a `sourced` Part of the SITE-FRAME element.
    //  Enumerate the site-frame's chrome parts through the ONE Part port (the SAME
    //  `enumerateParts` every node uses), then frame each region that is actually
    //  RENDERED — its `<PartAnchor field={slot} index={0}>` (the ONE `data-part-*`
    //  family) is present in the rail, OUTSIDE any node anchor. Only AUTHORABLE regions
    //  enumerate (the port's own gate), so a non-authorable region is never a dead
    //  selection. No per-type branch, no chrome-specific anchor family, no `selectChrome`
    //  arm: a chrome region is a part addressed by the ONE `PartAddress`.
    const nextChromes: ChromeFrame[] = []
    if (onSelectItem) {
      // The site chrome SSOT the `site-chrome` sourced adapter projects. Normalise the
      // ChromeEntry map (string shorthand → { variant }) to the ChromeSlotConfig shape the
      // port context carries, so variant/config resolution matches what the rail rendered.
      const chromeCtx: Record<string, ChromeSlotConfig> = {}
      for (const [slot, entry] of Object.entries(chrome ?? {})) {
        chromeCtx[slot] = typeof entry === 'string' ? { variant: entry } : entry
      }
      for (const part of enumerateParts({}, SITE_FRAME_META, { chrome: chromeCtx }, SITE_FRAME_ID)) {
        const slot = part.field
        const el   = rootEl.querySelector(
          `[${PART_FIELD_ATTR}="${slot}"][${PART_INDEX_ATTR}="${part.index}"]`,
        )
        if (!el) continue   // registered + authorable but NOT rendered on this canvas
        const box = el.firstElementChild ?? el
        nextChromes.push({ slot, path: part.address.partPath ?? slot, rect: rel(box) })
      }
    }

    setFrames(nextFrames)
    setDrops(nextDrops)
    setItems(nextItems)
    setChromes(nextChromes)
  }, [page, onSelectItem, chrome])

  useLayoutEffect(() => {
    measure()
    const rootEl = overlayRef.current?.parentElement
    if (!rootEl) return
    const ro = new ResizeObserver(measure)
    ro.observe(rootEl)
    window.addEventListener('resize', measure)
    return () => { ro.disconnect(); window.removeEventListener('resize', measure) }
  }, [measure])

  const handleDrop = (d: DropFrame) => (e: React.DragEvent) => {
    e.preventDefault()
    setOverSlot(null)
    const nodeType = e.dataTransfer.getData('nodeType')
    if (!nodeType) return
    // Accept a drop the slot takes DIRECTLY, OR one reachable via the canonical
    // auto-wrap (the slot accepts a `section` and the section accepts the type) — so a
    // chart dropped on the page-root main slot lands via page → section → chart (SPEC
    // S2). The host's `resolveInsertPlan` performs the actual direct-vs-wrap decision;
    // this gate only stops a drop no single-step insert could satisfy. Empty accepts ⇒
    // an open container that takes anything (unchanged).
    const accepts = d.slot.accepts
    const direct  = !accepts || accepts.length === 0 || accepts.includes(nodeType)
    const wrap    = !!accepts && accepts.includes(AUTOWRAP_CONTAINER) && nestAccepts(AUTOWRAP_CONTAINER, nodeType)
    if (!direct && !wrap) return
    onDrop(d.parentId, d.slotKey, nodeType)
  }

  // ── Metric drag → bind onto a node frame (AR-49 M0 item 9) ────────────────
  //  A metric drag is distinct from a palette node-type drag: it carries the
  //  metricDrag custom format, targets a NODE (not a slot), and is available on
  //  the always-present node frames (no `dragging` slot-zone reveal needed).
  const handleMetricOver = (nodeId: string) => (e: React.DragEvent) => {
    if (!onBindMetric || !hasMetricDrag(e.dataTransfer)) return
    e.preventDefault() // signal a valid drop target
    e.dataTransfer.dropEffect = 'copy'
    setMetricOverId(nodeId)
  }
  const handleMetricDrop = (nodeId: string) => (e: React.DragEvent) => {
    if (!onBindMetric || !hasMetricDrag(e.dataTransfer)) return
    e.preventDefault()
    e.stopPropagation()
    setMetricOverId(null)
    const metricId = readMetricDrag(e.dataTransfer)
    if (metricId) onBindMetric(nodeId, metricId)
  }

  return (
    <div
      ref={overlayRef}
      className="canvas-overlay"
      data-testid="canvas-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onSelect(null) }}
    >
      {frames.map((f) => {
        // A node reads as selected only for a WHOLE-node selection: while one of its
        // band items is the active selection, the bounded child owns the selected
        // chrome, not the parent strip (ADR-038 — the child is the element).
        const nodeSelected = f.id === selectedNodeId && !selectedItemPath
        return (
          <button
            key={`node-${f.id}`}
            type="button"
            className={
              `canvas-node${nodeSelected ? ' canvas-node--selected' : ''}` +
              `${f.id === metricOverId ? ' canvas-node--metric-over' : ''}`
            }
            data-node-id={f.id}
            data-node-type={f.type}
            aria-label={`Select ${f.type}`}
            aria-pressed={nodeSelected}
            style={{ left: f.rect.left, top: f.rect.top, width: f.rect.width, height: f.rect.height }}
            onClick={(e) => { e.stopPropagation(); onSelect(f.id) }}
            onDragOver={handleMetricOver(f.id)}
            onDragLeave={() => setMetricOverId((s) => (s === f.id ? null : s))}
            onDrop={handleMetricDrop(f.id)}
          >
            {nodeSelected && <span className="canvas-node__tag">{f.type}</span>}
          </button>
        )
      })}

      {/* Value-band item frames — rendered AFTER the node frames so a card sits ABOVE
          its strip: clicking a card selects the bounded child, clicking the strip's
          gaps still selects the strip. Generic — one frame per declared item. */}
      {onSelectItem && items.map((it) => {
        const sel = it.nodeId === selectedNodeId && it.path === selectedItemPath
        return (
          <button
            key={`item-${it.nodeId}-${it.path}`}
            type="button"
            className={`canvas-item${sel ? ' canvas-item--selected' : ''}`}
            data-item-node-id={it.nodeId}
            data-item-path={it.path}
            aria-label={`Select item ${it.path}`}
            aria-pressed={sel}
            style={{ left: it.rect.left, top: it.rect.top, width: it.rect.width, height: it.rect.height }}
            onClick={(e) => { e.stopPropagation(); onSelectItem(it.nodeId, it.path) }}
          />
        )
      })}

      {/* Chrome region frames (S6) — clicking a header/sidebar/footer selects it on the
          canvas through the ONE part-select (`onSelectItem(SITE_FRAME_ID, chrome.<slot>)`);
          the dock then projects its registered per-slot schema via the generic
          `element.schema` section (no chrome-specific arm). Selected iff the ONE selection
          address names this region. Rendered BEFORE drop zones so a drag reveals slots
          above chrome. */}
      {onSelectItem && chromes.map((c) => {
        const sel = selectedNodeId === SITE_FRAME_ID && selectedItemPath === c.path
        return (
          <button
            key={`chrome-${c.slot}`}
            type="button"
            className={`canvas-chrome${sel ? ' canvas-chrome--selected' : ''}`}
            data-chrome-slot={c.slot}
            aria-label={`Select chrome ${c.slot}`}
            aria-pressed={sel}
            style={{ left: c.rect.left, top: c.rect.top, width: c.rect.width, height: c.rect.height }}
            onClick={(e) => { e.stopPropagation(); onSelectItem(SITE_FRAME_ID, c.path) }}
          >
            {sel && <span className="canvas-chrome__tag">{c.slot}</span>}
          </button>
        )
      })}

      {/* Drop zones. EMPTY slots render AT REST too (a low-emphasis, labelled affordance so
          the author SEES where content goes without already dragging — the Builder/Webflow
          empty-slot pattern); populated-slot zones stay drag-only to avoid clutter. At rest
          every zone is pointer-events:none (CSS), so an at-rest affordance never blocks node
          selection; a drag re-enables pointer-events on all. Labels resolve to the active
          locale (Law 9). */}
      {drops.filter((d) => dragging || d.empty).map((d) => {
        const key = `${d.parentId}:${d.slotKey}`
        return (
          <div
            key={`drop-${key}`}
            className={
              `canvas-dropzone${d.empty ? ' canvas-dropzone--empty' : ''}` +
              `${overSlot === key ? ' canvas-dropzone--over' : ''}`
            }
            data-parent-id={d.parentId}
            data-slot-key={d.slotKey}
            data-testid={`dropzone-${key}`}
            style={{ left: d.rect.left, top: d.rect.top, width: d.rect.width, height: d.rect.height }}
            onDragOver={(e) => { e.preventDefault(); setOverSlot(key) }}
            onDragLeave={() => setOverSlot((s) => (s === key ? null : s))}
            onDrop={handleDrop(d)}
          >
            <span className="canvas-dropzone__label">
              {resolveLocaleString(d.slot.label, locale ?? 'ka', 'en') || d.slotKey}
            </span>
          </div>
        )
      })}
    </div>
  )
}
