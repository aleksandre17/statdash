import { Box, ToggleButton, ToggleButtonGroup, Tooltip } from '@mui/material'
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined'
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined'
import { ModelSurface } from './surfaces/ModelSurface'
import { DataDictionarySurface } from './surfaces/DataDictionarySurface'
import { useRole, useSetRole } from './useRole'
import type { Locale } from '../types/constructor'

// ── DataModelBody — the role-lens content split for the data-model destination ──
//  (AR-50 M5b)
//
//  The data-model destination is reachable by EVERYONE (an always-visible rail entry —
//  the G6 "built ≠ buried" fix), and its BODY splits by the role LENS, not its
//  visibility: ONE predicate (OCP — content-split, never a visibility gate) —
//    steward → the full modeler (the unchanged ModelSurface);
//    author  → the read-only Data Dictionary.
//  Navigation and identity are decoupled: entering the destination NEVER escalates the
//  lens; the query cliff lives ONLY behind the steward branch (FF-AUTHOR-NO-QUERY).
//  Role is read only through the useRole() seam (FF-ROLE-IS-LENS); the gate is the LENS
//  value, never an auth/tenant primitive. This is the SOLE mount site of ModelSurface
//  (FF-MODEL-IS-FOCUSVIEW) — the focus-view registry renders THIS, never ModelSurface
//  directly.
//
//  A small in-place lens toggle lets the user opt into editing (author→steward) or back
//  to browsing (steward→author) WITHOUT leaving the screen — this is the only place the
//  lens changes what you see, so the control lives exactly here (Least Astonishment).
//  Bilingual, keyboard-reachable native <button aria-pressed> (WCAG 2.1 AA · 4.1.2).
//
//  ── Floor 2 only — sources moved OUT to «წყაროები» (0091) ─────────────────────────
//  The Data Home split (owner 2026-07-18): raw sources are their OWN top-level
//  destination now («წყაროები», FIRST in the nav) — the ONE upload door + the cube
//  inventory + browsable classifiers live there. This page is the GOVERNED semantic
//  MODEL: the dictionary/flow-map (author lens) and the metric/dimension modeler (steward
//  lens). The ladder is the nav order (Sources → Model) + cross-gestures (a cube's
//  «browse in workbench» lands the steward in the modeler below; promote lands a governed
//  metric in the catalog). No upload door here — screen-level SRP is the decoupling.
export function DataModelBody({ locale }: { locale: Locale }) {
  const role    = useRole()
  const setRole = useSetRole()
  const en = locale === 'en'

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }} data-testid="data-model-lens-toggle">
        <ToggleButtonGroup
          exclusive
          size="small"
          value={role}
          onChange={(_, next: 'author' | 'steward' | null) => { if (next) setRole(next) }}
          aria-label={en ? 'Data model view' : 'მონაცემთა მოდელის ხედი'}
        >
          <Tooltip title={en ? 'Browse the governed data model (read-only)' : 'დაათვალიერე მართული მონაცემთა მოდელი (მხოლოდ წასაკითხი)'}>
            <ToggleButton value="author" aria-label={en ? 'Browse (read-only)' : 'დათვალიერება (მხოლოდ წასაკითხი)'}>
              <MenuBookOutlinedIcon fontSize="small" sx={{ mr: 0.5 }} />
              {en ? 'Browse' : 'დათვალიერება'}
            </ToggleButton>
          </Tooltip>
          <Tooltip title={en ? 'Edit the data model (Steward)' : 'მონაცემთა მოდელის რედაქტირება (სტიუარდი)'}>
            <ToggleButton value="steward" aria-label={en ? 'Edit (Steward)' : 'რედაქტირება (სტიუარდი)'}>
              <TuneOutlinedIcon fontSize="small" sx={{ mr: 0.5 }} />
              {en ? 'Edit' : 'რედაქტირება'}
            </ToggleButton>
          </Tooltip>
        </ToggleButtonGroup>
      </Box>

      {role === 'steward'
        ? <ModelSurface locale={locale} />
        : <DataDictionarySurface locale={locale} />}
    </Box>
  )
}
