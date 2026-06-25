// ── FieldWells — the primary drag-to-bind surface for a query spec (V5) ───────
//
//  The "easy for a non-programmer" binding UX (ADR V5): the author DRAGS a field
//  chip from the palette onto a well (measure / value / label / series / color)
//  to bind it — never typing a code or hand-writing an ObsQuery. A drop writes
//  the SAME ObsQuery.measure / EncodingSpec the typed QuerySpecEditor produces
//  (binding.ts), so the config output is byte-identical (the UX is the
//  improvement, not the output). The typed editors stay as the "advanced"
//  fallback below (progressive disclosure) — this is the primary, default path.
//
//  Two input paths, one write:
//   • POINTER/KEYBOARD DRAG — dnd-kit DndContext (shared sensors → pointer +
//     keyboard, WCAG); onDragEnd recovers the typed chip + well payloads and
//     calls the pure binding write.
//   • PICK → CLICK — click/Enter a chip to ARM it, then click/Enter a well to
//     bind (the explicit keyboard/click equivalent of the drag). Same write.
//
import { useMemo, useState } from 'react'
import { Box, Paper } from '@mui/material'
import { DndContext, type DragEndEvent, closestCenter } from '@dnd-kit/core'
import type { DataSpec, EncodingSpec, ObsQuery } from '@statdash/engine'
import { channelField } from '@statdash/engine'
import { useDndSensors } from '../../../shared/dnd/useDndSensors'
import { useActiveProfile } from '../../../discovery/useActiveProfile'
import { useSite } from '../../../store/constructor.store'
import { fieldChips, type FieldChip } from './fieldChips'
import {
  bindMeasure, bindEncoding, readMeasures, wellAccepts,
  type WellId, type EncodingWell,
} from './binding'
import { asChipData, asWellData } from './dragData'
import { FieldPalette } from './FieldPalette'
import { FieldWell } from './FieldWell'

type QuerySpec = Extract<DataSpec, { type: 'query' }>

export interface FieldWellsProps {
  value:    QuerySpec
  onChange: (next: QuerySpec) => void
}

// The encoding wells shown, with their labels (the core channels — YAGNI bound).
const ENCODING_WELL_LABELS: ReadonlyArray<{ well: EncodingWell; label: string; required?: boolean }> = [
  { well: 'label',  label: 'ეტიკეტი',     required: true },
  { well: 'value',  label: 'მნიშვნელობა' },
  { well: 'series', label: 'სერია' },
  { well: 'color',  label: 'ფერი' },
]

export function FieldWells({ value, onChange }: FieldWellsProps) {
  const active  = useActiveProfile()
  const locale  = useSite().defaultLocale
  const sensors = useDndSensors()

  const [pickedCode, setPickedCode] = useState<string | null>(null)

  const chips = useMemo<FieldChip[]>(
    () => (active.status === 'ready' ? fieldChips(active.profile, locale) : []),
    [active, locale],
  )
  const pickedChip = chips.find((c) => c.code === pickedCode) ?? null

  // ── The one write per well — drag AND click both call these ────────────────
  const applyBind = (well: WellId, chip: FieldChip) => {
    if (!wellAccepts(well, chip.kind)) return
    if (well === 'measure') {
      const nextQuery: ObsQuery = bindMeasure(value.query, chip)
      onChange({ ...value, query: nextQuery })
    } else {
      const nextEnc: EncodingSpec = bindEncoding(value.encoding, well, chip)
      onChange({ ...value, encoding: nextEnc })
    }
  }

  const handleDragEnd = (e: DragEndEvent) => {
    const chipData = asChipData(e.active.data.current)
    const wellData = asWellData(e.over?.data.current)
    if (!chipData || !wellData) return
    applyBind(wellData.well, chipData.chip)
  }

  // pick→click: toggle the armed chip; binding clears the armed state.
  const handlePick = (chip: FieldChip) =>
    setPickedCode((prev) => (prev === chip.code ? null : chip.code))

  const bindArmed = (well: WellId) => {
    if (!pickedChip) return
    applyBind(well, pickedChip)
    setPickedCode(null)
  }

  // ── Current bindings (for the well chips) ──────────────────────────────────
  const measures = readMeasures(value.query.measure)
  const enc = value.encoding

  const clearMeasure = (code: string) =>
    onChange({ ...value, query: { ...value.query, measure: measures.filter((m) => m !== code) } })

  const clearEncoding = (channel: EncodingWell) => {
    const next: EncodingSpec = { ...(enc ?? { label: '' }) }
    if (channel === 'label') next.label = ''
    else delete next[channel]
    onChange({ ...value, encoding: next })
  }

  const armedValidFor = (well: WellId): boolean =>
    pickedChip != null && wellAccepts(well, pickedChip.kind)

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <Paper variant="outlined" sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <FieldPalette chips={chips} pickedCode={pickedCode} onPick={handlePick} />

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {/* Measure well — accepts measure chips; shows each bound code. */}
          <FieldWell
            well="measure"
            label="მაჩვენებელი"
            bound={measures.length > 0 ? measures.join(', ') : null}
            armedValid={armedValidFor('measure')}
            onBindArmed={() => bindArmed('measure')}
            onClear={() => measures.forEach(clearMeasure)}
          />

          {/* Encoding channel wells. */}
          {ENCODING_WELL_LABELS.map(({ well, label, required }) => (
            <FieldWell
              key={well}
              well={well}
              label={label}
              required={required}
              bound={channelField(enc?.[well]) || null}
              armedValid={armedValidFor(well)}
              onBindArmed={() => bindArmed(well)}
              onClear={() => clearEncoding(well)}
            />
          ))}
        </Box>
      </Paper>
    </DndContext>
  )
}
