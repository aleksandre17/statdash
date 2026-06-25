// ── ByModeEditor — type=by-mode: a recursive per-ModeId sub-DataSpec editor [V2]
//
//  A `by-mode` DataSpec branches the data query on the active timeMode: a separate
//  DataSpec per ModeId ({ modes: Record<ModeId, DataSpec> }). The author adds a
//  mode branch (picking a REGISTERED ModeId — modeRegistry, pick-don't-type) and
//  authors that branch's nested DataSpec by REUSING the EXISTING DataSpecEditor
//  RECURSIVELY (a DataSpec inside a DataSpec — exactly the recursive composition the
//  VisibilityBuilder uses for nested VisibilityExprs). No parallel form engine: the
//  same type-picker + per-type editor renders one level down.
//
//  Every edit produces a NEW spec handed up via onChange (immutable, unidirectional
//  — Flux). Removing a branch deletes its key; the round-trip is lossless.
//
import { useState } from 'react'
import {
  Accordion, AccordionDetails, AccordionSummary,
  Box, Button, Chip, IconButton, MenuItem, Select, Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import type { DataSpec, ModeId } from '@statdash/engine'
import { modeRegistry } from '@statdash/engine'
import { DataSpecEditor } from '../DataSpecEditor'

type ByModeSpec = Extract<DataSpec, { type: 'by-mode' }>

export interface ByModeEditorProps {
  value:    ByModeSpec
  onChange: (next: ByModeSpec) => void
}

// A sensible default for a freshly-added branch (the simplest authorable spec).
const newBranchSpec = (): DataSpec => ({ type: 'row-list', rows: [] })

export function ByModeEditor({ value, onChange }: ByModeEditorProps) {
  const modeIds = Object.keys(value.modes)

  // Modes registered at boot that are NOT yet a branch — the add-picker options.
  // Picked from the live modeRegistry (pick-don't-type); empty when every
  // registered mode already has a branch.
  const available = modeRegistry.list()
    .map((m) => m.id)
    .filter((id) => !(id in value.modes))

  const [pendingMode, setPendingMode] = useState<ModeId>('')

  const setBranch = (mode: ModeId, spec: DataSpec) =>
    onChange({ ...value, modes: { ...value.modes, [mode]: spec } })

  const removeBranch = (mode: ModeId) => {
    const next = { ...value.modes }
    delete next[mode]
    onChange({ ...value, modes: next })
  }

  const addBranch = (mode: ModeId) => {
    if (!mode || mode in value.modes) return
    setBranch(mode, newBranchSpec())
    setPendingMode('')
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {modeIds.length === 0 && (
        <Typography variant="caption" color="text.secondary">
          რეჟიმის ტოტები არ არის — დაამატეთ ქვემოთ
        </Typography>
      )}

      {modeIds.map((mode) => (
        <Accordion key={mode} defaultExpanded disableGutters variant="outlined">
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
              <Chip size="small" label={mode} color="primary" variant="outlined" />
              <Box sx={{ flex: 1 }} />
              <IconButton
                size="small"
                aria-label={`ტოტის წაშლა: ${mode}`}
                onClick={(e) => { e.stopPropagation(); removeBranch(mode) }}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            {/* Recursion: the nested DataSpec is authored by the SAME editor. */}
            <DataSpecEditor
              value={value.modes[mode]}
              onChange={(spec) => setBranch(mode, spec)}
            />
          </AccordionDetails>
        </Accordion>
      ))}

      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
        <Select
          size="small"
          displayEmpty
          value={pendingMode}
          onChange={(e) => setPendingMode(e.target.value as ModeId)}
          sx={{ width: 180 }}
          renderValue={(v) => (v ? String(v) : 'რეჟიმი...')}
          inputProps={{ 'aria-label': 'mode to add' }}
        >
          {available.length === 0 && (
            <MenuItem value="" disabled>ყველა რეჟიმი დამატებულია</MenuItem>
          )}
          {available.map((id) => (
            <MenuItem key={id} value={id}>{id}</MenuItem>
          ))}
        </Select>
        <Button
          size="small"
          startIcon={<AddIcon />}
          disabled={!pendingMode}
          onClick={() => addBranch(pendingMode)}
        >
          ტოტის დამატება
        </Button>
      </Box>
    </Box>
  )
}
