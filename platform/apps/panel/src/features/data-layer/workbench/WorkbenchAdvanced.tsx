// ── WorkbenchAdvanced — the escape hatches the ONE workbench surface keeps ─────────
//
//  Trust-recovery correction (ADR-051 DU4 · restore-what-Step-A-lost). The workbench is
//  the SOLE spec-editing surface (DU3), so every capability the old `DataSpecEditor` gave
//  must live HERE, not vanish. Three progressive-disclosure escapes, kept quiet so the
//  primary surfaces (the three panes / the dedicated fallback editor) stay the main act:
//
//    • SpecTypePicker  (R1) — create-from-scratch + inter-kind CONVERT via the engine's
//                             `resolveSpecAuthoring(type).make()` seed. The only place a
//                             DataSpec's KIND can be chosen/changed once the picker left
//                             the inspector. `pipeline` is not a catalog kind (it is
//                             authored by the panes, not picked) → shown as an empty,
//                             convert-away-only selection, never an out-of-range warning.
//    • AdvancedRawPanel     — the collapsed "Advanced / raw" disclosure the three panes get:
//                             mounts the generic `SpecBody` against the live value, so a
//                             `query` surfaces QuerySpecEditor's Advanced (encoding /
//                             MeasureSelector / FilterBuilder / FieldWells) and a native
//                             `pipeline` gets a WRITABLE raw-JSON editor (SpecBody →
//                             JsonFallback for the un-catalogued kind). Progressive: the
//                             panes stay primary, this is opt-in for power edits.
//    • ReadOnlyJson    (R6) — the read-only JSON disclosure for any kind (the old
//                             DataSpecEditor "JSON output" pane).
//
//  These are NOT a second parallel editor beside the workbench (the DU3 defect) — they are
//  INSIDE the one surface. SpecBody is the SAME generic dispatch the fallback lane uses, so
//  there is still one editing model, progressively disclosed.
//
import {
  Accordion, AccordionDetails, AccordionSummary, Box, Typography,
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { Select } from '@statdash/react'
import type { DataSpec } from '@statdash/engine'
import { SPEC_CATALOG, resolveSpecAuthoring } from '@statdash/engine'
import { SpecBody } from '../DataSpecEditor'
import { lowerLaneEmission } from './workbenchModel'
import type { Locale } from '../../../types/constructor'

// ── SpecTypePicker — create-from-scratch + inter-kind conversion (R1) ──────────────
//
//  Picking a kind SEEDS a fresh spec of that kind via the engine-declared `make()` factory
//  (the same convert-on-pick semantics the retired DataSpecEditor picker had — a new kind is
//  a new seed, deliberately). `null` value ⇒ from-scratch creation. A current kind absent
//  from SPEC_CATALOG (`pipeline`) shows the placeholder (the panes are how a pipeline itself
//  is authored) — the author can still convert AWAY from it.
//
//  On the OWNED Radix Select (`@statdash/react`), not MUI — new work lands on the migration
//  target (FF-NO-NEW-MUI), so this restores the picker without regrowing the MUI surface.
//
export function SpecTypePicker(
  { value, onChange, locale }: { value: DataSpec | null; onChange: (spec: DataSpec) => void; locale: Locale },
) {
  const en = locale === 'en'
  const currentType = value?.type ?? ''
  const selectValue = currentType in SPEC_CATALOG ? currentType : undefined
  const label = en ? 'Type' : 'ტიპი'

  const handleTypeChange = (type: string) => {
    if (type === value?.type) return
    const seed = resolveSpecAuthoring(type)?.make()
    // W0/Z8 lane emission flip: a pane-shaped seed (`query`) emits as spine so the
    // session opens in the ONE dialect; a dedicated-editor kind seeds unchanged
    // (its editor is the authoring room — DU4). One derived scope, see lowerLaneEmission.
    if (seed) onChange(lowerLaneEmission(seed))
  }

  return (
    <Box data-testid="spec-type-picker" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Typography variant="caption" color="text.secondary" sx={{ minWidth: 44 }}>{label}</Typography>
      <Select.Root value={selectValue} onValueChange={handleTypeChange}>
        <Select.Trigger
          aria-label={label}
          placeholder={en ? 'Pick a type' : 'აირჩიეთ ტიპი'}
          style={{ flex: 1 }}
        />
        <Select.Content>
          {Object.entries(SPEC_CATALOG).map(([key, desc]) => (
            <Select.Item key={key} value={key}>
              {en ? desc.label.en : desc.label.ka} ({key})
            </Select.Item>
          ))}
        </Select.Content>
      </Select.Root>
    </Box>
  )
}

// ── ReadOnlyJson — the read-only JSON disclosure (R6) ──────────────────────────────
export function ReadOnlyJson({ value, locale }: { value: DataSpec; locale: Locale }) {
  const en = locale === 'en'
  return (
    <Accordion disableGutters variant="outlined" data-testid="workbench-json">
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="subtitle2" fontWeight={600}>{en ? 'JSON output' : 'JSON გამოსავალი'}</Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Box
          component="pre"
          sx={{
            m: 0, p: 1.5, bgcolor: 'action.hover', color: 'text.primary', borderRadius: 1,
            fontSize: 12, overflow: 'auto', fontFamily: 'monospace',
          }}
        >
          {JSON.stringify(value, null, 2)}
        </Box>
      </AccordionDetails>
    </Accordion>
  )
}

// ── AdvancedRawPanel — the three-pane "Advanced / raw" escape (owner's complaint) ──
//
//  The three panes shape the pipeline; this collapsed disclosure keeps the deeper edits
//  the panes don't (yet) expose reachable IN the same surface: a `query` → QuerySpecEditor's
//  Advanced (encoding, MeasureSelector, FilterBuilder, FieldWells); a native `pipeline` →
//  writable raw JSON (SpecBody → JsonFallback, the un-catalogued kind). Plus type-conversion
//  and the read-only JSON. Collapsed by default (progressive disclosure — the panes lead).
//
export function AdvancedRawPanel(
  { value, onChange, locale }: { value: DataSpec; onChange: (spec: DataSpec) => void; locale: Locale },
) {
  const en = locale === 'en'
  return (
    <Accordion
      disableGutters variant="outlined"
      className="data-workbench__advanced"
      data-testid="workbench-advanced"
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="subtitle2" fontWeight={600}>
          {en ? 'Advanced / raw' : 'გაფართოებული / დაუმუშავებელი'}
        </Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <SpecTypePicker value={value} onChange={onChange} locale={locale} />
          {/* W0/Z8 lane emission flip: an Advanced edit of a pane-shaped spec (the
              `query` branch) emits SPINE — the same conversion-on-active-edit rule the
              panes apply — so the escape hatch can no longer re-enter sugar into
              storage (leak #3). Non-pane-shaped kinds emit unchanged (DU4). */}
          <SpecBody value={value} onChange={(next) => onChange(lowerLaneEmission(next))} />
          <ReadOnlyJson value={value} locale={locale} />
        </Box>
      </AccordionDetails>
    </Accordion>
  )
}
