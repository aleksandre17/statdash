import { Box, ToggleButton, ToggleButtonGroup, Tooltip, Typography } from '@mui/material'
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined'
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined'
import { ModelSurface } from './surfaces/ModelSurface'
import { DataDictionarySurface } from './surfaces/DataDictionarySurface'
import { CanonicalUpload } from './model/CanonicalUpload'
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
//  ── The data-first FRONT DOOR (AR-52 W2 · Canon C1) ──────────────────────────────
//  Onboarding raw data is the spine's origin ("everything starts with raw data"). It
//  used to be BURIED — reachable only after flipping to the Steward lens (ModelSurface).
//  It now sits ABOVE the lens split, so it is ONE intentful step from the shell (rail
//  Data → here) in EITHER lens: the DOOR is front, not behind the lens. Governance is
//  preserved (the canon's refusal of "zero-step governance"): the DOOR is where the
//  author/steward alike SEE it, but PUBLISHING a staged cube is the gated act — the
//  canonical FSM's publish is server-authorised (D-DA1: steward defines), and the full
//  raw-source modeler (define specs/sources) stays behind the Steward "Edit" lens below.
export function DataModelBody({ locale }: { locale: Locale }) {
  const role    = useRole()
  const setRole = useSetRole()
  const en = locale === 'en'

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {/* FRONT DOOR — onboard raw data, one step from the shell, both lenses (C1). */}
      <Box component="section" aria-label={en ? 'Onboard data' : 'მონაცემების ატვირთვა'} data-testid="data-front-door"
        sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, p: 1.25, border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper' }}>
        <Typography variant="overline" color="text.secondary">
          {en ? 'Start here — raw data' : 'დაიწყე აქ — ნედლი მონაცემები'}
        </Typography>
        <CanonicalUpload locale={locale} />
      </Box>

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
