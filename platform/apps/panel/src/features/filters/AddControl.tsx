// ── AddControl — pick a ParamDef type → append a seeded control [D7.3] ──────────
//
//  Shared by both filter-control authoring surfaces (Page drawer + node bridge).
//  The type list is the engine SSOT (PARAMDEF_TYPES via PARAM_TYPE_OPTIONS) — every
//  authorable control type is addable here. Selecting a type appends a seeded
//  control and resets the picker to its placeholder — one gesture, no extra button.
//
import { MenuItem, Select, Stack } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import type { ParamDefType } from '@statdash/engine'
import { PARAM_TYPE_OPTIONS } from './paramFactory'

export function AddControl({ onAdd }: { onAdd: (type: ParamDefType) => void }) {
  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <AddIcon fontSize="small" color="action" aria-hidden />
      <Select
        size="small"
        displayEmpty
        sx={{ minWidth: 200 }}
        inputProps={{ 'aria-label': 'add control' }}
        value=""
        onChange={(e) => { const v = e.target.value as ParamDefType; if (v) onAdd(v) }}
      >
        <MenuItem value="" disabled>+ კონტროლის დამატება…</MenuItem>
        {PARAM_TYPE_OPTIONS.map((t) => (
          <MenuItem key={t} value={t}>{t}</MenuItem>
        ))}
      </Select>
    </Stack>
  )
}
