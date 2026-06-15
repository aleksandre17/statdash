import { Box, MenuItem, Select, TextField, Typography } from '@mui/material'
import type { EncodingSpec } from '@geostat/engine'

// ── EncodingEditor — channel → field-name mapper ──────────────────────────────
//
//  Maps EncodingSpec channels to obs field names. Five rows shown always:
//    label / value / color / isTotal → plain field name (string)
//    pct → two modes:
//      'field' → read a pre-computed field   → { field: 'pct' }
//      'of'    → auto-compute vs a measure    → { of: 'GDP' }
//  `label` is the only required channel in EncodingSpec; the rest are optional
//  and omitted from output when left blank.
//

export interface EncodingEditorProps {
  value:    EncodingSpec | undefined
  onChange: (next: EncodingSpec) => void
}

type PctMode = 'field' | 'of'

function readPct(pct: EncodingSpec['pct']): { mode: PctMode; value: string } {
  if (pct && 'of' in pct)    return { mode: 'of',    value: pct.of }
  if (pct && 'field' in pct) return { mode: 'field', value: pct.field }
  if (pct && 'sumOf' in pct) return { mode: 'of',    value: pct.sumOf } // surface sumOf as 'of'-like
  return { mode: 'field', value: '' }
}

export function EncodingEditor({ value, onChange }: EncodingEditorProps) {
  const enc: EncodingSpec = value ?? { label: '' }

  // Set a plain string channel; empty string clears the optional channel.
  const setChannel = (key: 'value' | 'color' | 'isTotal', raw: string) => {
    const next: EncodingSpec = { ...enc }
    if (raw.trim() === '') delete next[key]
    else next[key] = raw
    onChange(next)
  }

  const setLabel = (raw: string) => onChange({ ...enc, label: raw })

  const pct = readPct(enc.pct)

  const setPct = (mode: PctMode, raw: string) => {
    const next: EncodingSpec = { ...enc }
    if (raw.trim() === '') delete next.pct
    else next.pct = mode === 'of' ? { of: raw } : { field: raw }
    onChange(next)
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <ChannelRow label="ეტიკეტი" required>
        <TextField
          size="small" fullWidth value={enc.label}
          onChange={(e) => setLabel(e.target.value)}
        />
      </ChannelRow>

      <ChannelRow label="მნიშვნელობა">
        <TextField
          size="small" fullWidth value={enc.value ?? ''}
          placeholder="value"
          onChange={(e) => setChannel('value', e.target.value)}
        />
      </ChannelRow>

      <ChannelRow label="ფერი">
        <TextField
          size="small" fullWidth value={enc.color ?? ''}
          placeholder="color"
          onChange={(e) => setChannel('color', e.target.value)}
        />
      </ChannelRow>

      <ChannelRow label="% (pct)">
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Select
            size="small"
            value={pct.mode}
            onChange={(e) => setPct(e.target.value as PctMode, pct.value)}
            sx={{ width: 130 }}
          >
            <MenuItem value="field">სვეტი</MenuItem>
            <MenuItem value="of">/ (of)</MenuItem>
          </Select>
          <TextField
            size="small" fullWidth value={pct.value}
            placeholder={pct.mode === 'of' ? 'GDP' : 'pct'}
            onChange={(e) => setPct(pct.mode, e.target.value)}
          />
        </Box>
      </ChannelRow>

      <ChannelRow label="სულ (isTotal)">
        <TextField
          size="small" fullWidth value={enc.isTotal ?? ''}
          placeholder="isTotal"
          onChange={(e) => setChannel('isTotal', e.target.value)}
        />
      </ChannelRow>
    </Box>
  )
}

// ── ChannelRow — label column + control column ────────────────────────────────
function ChannelRow({ label, required, children }: {
  label:    string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 1, alignItems: 'center' }}>
      <Typography variant="body2" color="text.secondary">
        {label}{required && <Box component="span" sx={{ color: 'error.main' }}> *</Box>}
      </Typography>
      {children}
    </Box>
  )
}
