// ── CanvasOverlay — selection frames + slot drop zones over the renderer ──
//
//  N35: the transparent interaction layer of the WYSIWYG canvas. It does NOT
//  render content — it walks the same NodePageConfig the renderer drew, then
//  positions one frame per node and one drop zone per registered SlotDef.
//
//  Positioning: the canvas-anchor middleware (setupCanvasRegistry) stamps each
//  rendered node with `data-canvas-node-id`. The overlay measures those anchors
//  via getBoundingClientRect() relative to the canvas root, so frames track the
//  real rendered geometry without the engine knowing the editor exists.
//
//  Slot taxonomy: drop zones come straight from nodeRegistry.getSlots(type) —
//  the SlotDef.accepts list IS the drag-accept contract. No new fields invented.
//
import { useLayoutEffect, useRef, useState, useCallback } from 'react'
import { nodeRegistry }              from '@statdash/react/engine'
import type { NodeBase, SlotDef }    from '@statdash/react/engine'
import { walkNodes }                 from './walkNodes'
import type { WalkedNode }           from './walkNodes'
import { hasMetricDrag, readMetricDrag } from '../discovery/metricDrag'

// ── Measured geometry, relative to the canvas root ────────────────────────

interface Rect { left: number; top: number; width: number; height: number }

interface NodeFrame extends WalkedNode { id: string; rect: Rect }
interface DropFrame { parentId: string; slotKey: string; slot: SlotDef; rect: Rect }

export interface CanvasOverlayProps {
  /** The live NodePageConfig the renderer drew — overlay walks the same tree. */
  page:           NodeBase
  selectedNodeId?: string
  /** True while a palette/move drag is active — reveals drop zones. */
  dragging?:       boolean
  onSelect:       (nodeId: string | null) => void
  onDrop:         (parentId: string, slotKey: string, nodeType: string) => void
  /**
   * Bind a governed metric dragged from the Metric Palette onto a node frame
   * (AR-49 M0 item 9). Each node frame becomes a metric drop target; the host
   * performs the byte-identical bind write. Absent ⇒ metric drops are ignored.
   */
  onBindMetric?:  (nodeId: string, metricId: string) => void
}

export function CanvasOverlay({
  page, selectedNodeId, dragging = false, onSelect, onDrop, onBindMetric,
}: CanvasOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const [frames, setFrames] = useState<NodeFrame[]>([])
  const [drops,  setDrops]  = useState<DropFrame[]>([])
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

    const walked = walkNodes(page).filter((w) => typeof w.node.id === 'string' && w.node.id)
    const nextFrames: NodeFrame[] = []
    const nextDrops:  DropFrame[] = []

    for (const w of walked) {
      const id = w.node.id as string
      const anchor = rootEl.querySelector(`[data-canvas-node-id="${id}"]`)
      // display:contents anchor has no box — measure its first element child.
      const box = anchor?.firstElementChild ?? anchor
      if (!box) continue
      const rect = rel(box)
      nextFrames.push({ ...w, id, rect })

      const slots = nodeRegistry.getSlots(w.type, w.variant)
      if (slots) {
        for (const [slotKey, slot] of Object.entries(slots)) {
          nextDrops.push({ parentId: id, slotKey, slot, rect })
        }
      }
    }

    setFrames(nextFrames)
    setDrops(nextDrops)
  }, [page])

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
    if (d.slot.accepts && d.slot.accepts.length > 0 && !d.slot.accepts.includes(nodeType)) return
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
      {frames.map((f) => (
        <button
          key={`node-${f.id}`}
          type="button"
          className={
            `canvas-node${f.id === selectedNodeId ? ' canvas-node--selected' : ''}` +
            `${f.id === metricOverId ? ' canvas-node--metric-over' : ''}`
          }
          data-node-id={f.id}
          data-node-type={f.type}
          aria-label={`Select ${f.type}`}
          aria-pressed={f.id === selectedNodeId}
          style={{ left: f.rect.left, top: f.rect.top, width: f.rect.width, height: f.rect.height }}
          onClick={(e) => { e.stopPropagation(); onSelect(f.id) }}
          onDragOver={handleMetricOver(f.id)}
          onDragLeave={() => setMetricOverId((s) => (s === f.id ? null : s))}
          onDrop={handleMetricDrop(f.id)}
        >
          {f.id === selectedNodeId && <span className="canvas-node__tag">{f.type}</span>}
        </button>
      ))}

      {dragging && drops.map((d) => {
        const key = `${d.parentId}:${d.slotKey}`
        return (
          <div
            key={`drop-${key}`}
            className={`canvas-dropzone${overSlot === key ? ' canvas-dropzone--over' : ''}`}
            data-parent-id={d.parentId}
            data-slot-key={d.slotKey}
            data-testid={`dropzone-${key}`}
            style={{ left: d.rect.left, top: d.rect.top, width: d.rect.width, height: d.rect.height }}
            onDragOver={(e) => { e.preventDefault(); setOverSlot(key) }}
            onDragLeave={() => setOverSlot((s) => (s === key ? null : s))}
            onDrop={handleDrop(d)}
          >
            <span className="canvas-dropzone__label">
              {typeof d.slot.label === 'string' ? d.slot.label : d.slot.label.en ?? d.slotKey}
            </span>
          </div>
        )
      })}
    </div>
  )
}
