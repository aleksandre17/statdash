import { useState } from 'react'
import {
  Accordion, AccordionDetails, AccordionSummary, Box,
  FormControl, InputLabel, MenuItem, Select, TextField, Typography,
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import type { DataSpec } from '@statdash/engine'
import { SPEC_CATALOG } from '@statdash/engine'
import { QuerySpecEditor } from './editors/QuerySpecEditor'
import { TimeseriesEditor } from './editors/TimeseriesEditor'
import { GrowthEditor } from './editors/GrowthEditor'
import { RatioListEditor } from './editors/RatioListEditor'
import { RowListEditor } from './editors/rowlist/RowListEditor'
import { TransformEditor } from './editors/TransformEditor'
import { PivotEditor } from './editors/PivotEditor'

// ── DataSpecEditor — type picker + routes to type-specific editor ─────────────
//
//  Top: Select over SPEC_CATALOG (7 DataSpec discriminants). Changing the type
//  initializes a fresh spec of that type with sensible defaults.
//  Below: the matching editor (query / timeseries / growth / ratio-list) or a
//  raw-JSON fallback for the other types.
//  Bottom: collapsible JSON preview of the live spec.
//

type SpecType = DataSpec['type']

export interface DataSpecEditorProps {
  value:    DataSpec | null
  onChange: (spec: DataSpec) => void
}

// ── Default spec factory — one fresh, valid-ish spec per type ──────────────────
function defaultSpec(type: SpecType): DataSpec {
  switch (type) {
    case 'query':
      return { type: 'query', query: { measure: [] }, pipe: [], encoding: { label: 'label' } }
    case 'row-list':
      return { type: 'row-list', rows: [] }
    case 'timeseries':
      return { type: 'timeseries', code: '', years: 'all' }
    case 'growth':
      return { type: 'growth', code: '', years: 'all' }
    case 'ratio-list':
      return { type: 'ratio-list', pairs: [] }
    case 'pivot':
      return { type: 'pivot', rows: [], keyField: '', valueFields: [] }
    case 'transform':
      return { type: 'transform', source: [], steps: [], encoding: { label: 'label' } }
    default:
      return { type: 'row-list', rows: [] }
  }
}

export function DataSpecEditor({ value, onChange }: DataSpecEditorProps) {
  const currentType = value?.type ?? ''

  const handleTypeChange = (type: SpecType) => {
    if (type === value?.type) return
    onChange(defaultSpec(type))
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <FormControl size="small" fullWidth>
        <InputLabel id="dataspec-type-label">სპეც-ის ტიპი</InputLabel>
        <Select
          labelId="dataspec-type-label"
          label="სპეც-ის ტიპი"
          value={currentType}
          onChange={(e) => handleTypeChange(e.target.value as SpecType)}
        >
          {Object.entries(SPEC_CATALOG).map(([key, desc]) => (
            <MenuItem key={key} value={key}>
              {desc.label.ka} <Box component="span" sx={{ color: 'text.disabled', ml: 1 }}>({key})</Box>
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {value && <SpecBody value={value} onChange={onChange} />}

      {value && (
        <Accordion disableGutters variant="outlined">
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle2" fontWeight={600}>JSON გამოსავალი</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Box
              component="pre"
              sx={{
                m: 0, p: 1.5, bgcolor: 'grey.100', borderRadius: 1,
                fontSize: 12, overflow: 'auto', fontFamily: 'monospace',
              }}
            >
              {JSON.stringify(value, null, 2)}
            </Box>
          </AccordionDetails>
        </Accordion>
      )}
    </Box>
  )
}

// ── SpecBody — route to the type-specific editor ──────────────────────────────
function SpecBody({ value, onChange }: { value: DataSpec; onChange: (spec: DataSpec) => void }) {
  switch (value.type) {
    case 'query':      return <QuerySpecEditor  value={value} onChange={onChange} />
    case 'timeseries': return <TimeseriesEditor value={value} onChange={onChange} />
    case 'growth':     return <GrowthEditor     value={value} onChange={onChange} />
    case 'ratio-list': return <RatioListEditor  value={value} onChange={onChange} />
    case 'row-list':   return <RowListEditor    value={value} onChange={onChange} />
    case 'transform':  return <TransformEditor  value={value} onChange={onChange} />
    case 'pivot':      return <PivotEditor      value={value} onChange={onChange} />
    default:           return <JsonFallback     value={value} onChange={onChange} />
  }
}

// ── JsonFallback — textarea editor for not-yet-visual spec types ──────────────
function JsonFallback({ value, onChange }: { value: DataSpec; onChange: (spec: DataSpec) => void }) {
  const [draft, setDraft] = useState(() => safeStringify(value))
  const [error, setError] = useState<string | null>(null)

  const handleChange = (text: string) => {
    setDraft(text)
    try {
      const parsed = JSON.parse(text) as DataSpec
      if (parsed.type !== value.type) { setError('ტიპის შეცვლა აქ დაუშვებელია'); return }
      setError(null)
      onChange(parsed)
    } catch {
      setError('არასწორი JSON')
    }
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      <Typography variant="caption" color="text.secondary">
        ვიზუალური რედაქტორი ამ ტიპისთვის ჯერ არ არის — დაარედაქტირეთ JSON
      </Typography>
      <TextField
        size="small" multiline minRows={6}
        value={draft}
        onChange={(e) => handleChange(e.target.value)}
        error={error !== null}
        helperText={error ?? undefined}
        slotProps={{ input: { sx: { fontFamily: 'monospace', fontSize: 12 } } }}
      />
    </Box>
  )
}

function safeStringify(spec: DataSpec): string {
  return JSON.stringify(spec, null, 2)
}
