import { useMemo } from 'react'
import {
  Box, Button, IconButton, MenuItem, Select, TextField, Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import CloseIcon from '@mui/icons-material/Close'

// ── FilterBuilder — dimension → ref-type → value rows ─────────────────────────
//
//  Produces ObsQuery.filter: a Record<dim, FilterValue-or-ref>.
//  Ref types mirror the engine's runtime references:
//    literal → "value" | 123        (plain DimVal)
//    $ctx    → { $ctx: 'param' }     (SectionContext.dims lookup)
//    $d      → { $d: 'dim' }         (display ref)
//    $cl     → { $cl: 'dim' }        (classifier ref)
//
//  The Record<string, unknown> in/out keeps this agnostic — the editor never
//  privileges a dimension name (Project Law 1).
//

type RefType = 'literal' | '$ctx' | '$d' | '$cl'

const REF_TYPES: { value: RefType; label: string }[] = [
  { value: 'literal', label: 'ლიტერალი' },
  { value: '$ctx',    label: '$ctx (კონტექსტი)' },
  { value: '$d',      label: '$d (განზომილება)' },
  { value: '$cl',     label: '$cl (კლასიფიკატორი)' },
]

interface Row {
  /** Stable react key — survives dim renames so focus is not lost. */
  rowKey:  string
  dim:     string
  refType: RefType
  /** Inner string the user typed (literal value, or the ref's parameter name). */
  inner:   string
}

export interface FilterBuilderProps {
  value:    Record<string, unknown>
  onChange: (next: Record<string, unknown>) => void
}

// ── Encode a single row → its filter value ────────────────────────────────────
function encodeValue(refType: RefType, inner: string): unknown {
  switch (refType) {
    case '$ctx': return { $ctx: inner }
    case '$d':   return { $d: inner }
    case '$cl':  return { $cl: inner }
    case 'literal': {
      // Numeric literals stay numbers; everything else is a string.
      const trimmed = inner.trim()
      if (trimmed !== '' && !Number.isNaN(Number(trimmed))) return Number(trimmed)
      return inner
    }
  }
}

// ── Decode an existing filter value → editable row fields ─────────────────────
function decodeValue(raw: unknown): { refType: RefType; inner: string } {
  if (raw !== null && typeof raw === 'object') {
    if ('$ctx' in raw) return { refType: '$ctx', inner: String((raw as { $ctx: unknown }).$ctx ?? '') }
    if ('$d'   in raw) return { refType: '$d',   inner: String((raw as { $d: unknown }).$d ?? '') }
    if ('$cl'  in raw) return { refType: '$cl',  inner: String((raw as { $cl: unknown }).$cl ?? '') }
  }
  return { refType: 'literal', inner: raw === undefined || raw === null ? '' : String(raw) }
}

export function FilterBuilder({ value, onChange }: FilterBuilderProps) {
  // Derive rows from the canonical record. Pure — value is the single source of truth.
  const rows: Row[] = useMemo(
    () =>
      Object.entries(value).map(([dim, raw], i) => {
        const { refType, inner } = decodeValue(raw)
        return { rowKey: `${dim}::${i}`, dim, refType, inner }
      }),
    [value],
  )

  // Rebuild the whole record from a row list (handles dim renames / dupes safely).
  const commit = (next: Row[]) => {
    const out: Record<string, unknown> = {}
    for (const r of next) {
      if (r.dim.trim() === '') continue
      out[r.dim] = encodeValue(r.refType, r.inner)
    }
    onChange(out)
  }

  const updateRow = (index: number, patch: Partial<Row>) =>
    commit(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)))

  const addRow = () => {
    const out: Record<string, unknown> = { ...value }
    // Find a non-colliding placeholder key so the new empty row persists.
    let key = 'dim'
    let n = 1
    while (key in out) key = `dim${++n}`
    out[key] = ''
    onChange(out)
  }

  const removeRow = (index: number) => commit(rows.filter((_r, i) => i !== index))

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {rows.length === 0 && (
        <Typography variant="caption" color="text.secondary">
          ფილტრები არ არის განსაზღვრული
        </Typography>
      )}

      {rows.map((row, index) => (
        <Box key={row.rowKey} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <TextField
            size="small"
            label="განზომილება"
            value={row.dim}
            onChange={(e) => updateRow(index, { dim: e.target.value })}
            sx={{ width: 160 }}
          />
          <Select
            size="small"
            value={row.refType}
            onChange={(e) => updateRow(index, { refType: e.target.value as RefType })}
            sx={{ width: 180 }}
          >
            {REF_TYPES.map((rt) => (
              <MenuItem key={rt.value} value={rt.value}>{rt.label}</MenuItem>
            ))}
          </Select>
          <TextField
            size="small"
            label={row.refType === 'literal' ? 'მნიშვნელობა' : 'პარამეტრი'}
            value={row.inner}
            onChange={(e) => updateRow(index, { inner: e.target.value })}
            sx={{ flex: 1 }}
          />
          <IconButton size="small" aria-label="ფილტრის წაშლა" onClick={() => removeRow(index)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      ))}

      <Box>
        <Button size="small" startIcon={<AddIcon />} onClick={addRow}>
          ფილტრის დამატება
        </Button>
      </Box>
    </Box>
  )
}
