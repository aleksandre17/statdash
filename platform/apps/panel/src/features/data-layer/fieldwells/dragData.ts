// ── dragData — the typed drag payload for field-wells (V5) ────────────────────
//
//  dnd-kit carries arbitrary `data` on draggables/droppables. We make the field
//  chip payload a NAMED, typed contract so the DndContext.onDragEnd handler can
//  recover the dropped chip + the target well type-safely (no `any`, no magic
//  string parsing of ids). One discriminant `kind: 'field-chip'` marks our
//  payload so a shared DndContext could host other drag kinds later (OCP).
//
import type { FieldChip } from './fieldChips'
import type { WellId } from './binding'

/** Payload attached to a draggable field chip. */
export interface ChipDragData {
  kind: 'field-chip'
  chip: FieldChip
}

/** Payload attached to a droppable well (its target id). */
export interface WellDropData {
  kind: 'field-well'
  well: WellId
}

/** Narrow an unknown dnd-kit data bag to our chip payload. */
export function asChipData(data: unknown): ChipDragData | null {
  return isRecord(data) && data.kind === 'field-chip' && isRecord(data.chip)
    ? (data as unknown as ChipDragData)
    : null
}

/** Narrow an unknown dnd-kit data bag to our well payload. */
export function asWellData(data: unknown): WellDropData | null {
  return isRecord(data) && data.kind === 'field-well' && typeof data.well === 'string'
    ? (data as unknown as WellDropData)
    : null
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}
