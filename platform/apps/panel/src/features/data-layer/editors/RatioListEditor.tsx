import { Box, Button, IconButton, TextField, Typography } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import CloseIcon from '@mui/icons-material/Close'
import type { DataSpec } from '@statdash/engine'

// ── RatioListEditor — type=ratio-list: pairs[] ────────────────────────────────
//
//  Each pair = { code, denom, label? } → row value = code / denom × 100.
//  label is optional; blank → omitted from the emitted pair.
//

type RatioListSpec = Extract<DataSpec, { type: 'ratio-list' }>
type Pair = RatioListSpec['pairs'][number]

export interface RatioListEditorProps {
  value:    RatioListSpec
  onChange: (next: RatioListSpec) => void
}

export function RatioListEditor({ value, onChange }: RatioListEditorProps) {
  const setPairs = (pairs: Pair[]) => onChange({ ...value, pairs })

  const updatePair = (index: number, patch: Partial<Pair>) =>
    setPairs(value.pairs.map((p, i) => {
      if (i !== index) return p
      const merged = { ...p, ...patch }
      if (merged.label?.trim() === '') delete merged.label
      return merged
    }))

  const addPair = () => setPairs([...value.pairs, { code: '', denom: '' }])
  const removePair = (index: number) => setPairs(value.pairs.filter((_p, i) => i !== index))

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {value.pairs.length === 0 && (
        <Typography variant="caption" color="text.secondary">წყვილები არ არის</Typography>
      )}

      {value.pairs.map((pair, index) => (
        <Box key={index} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <TextField
            size="small" label="კოდი" value={pair.code}
            onChange={(e) => updatePair(index, { code: e.target.value })}
            sx={{ width: 130 }}
          />
          <TextField
            size="small" label="მნიშვნელი" value={pair.denom}
            onChange={(e) => updatePair(index, { denom: e.target.value })}
            sx={{ width: 130 }}
          />
          <TextField
            size="small" label="ეტიკეტი (არჩევითი)" value={pair.label ?? ''}
            onChange={(e) => updatePair(index, { label: e.target.value })}
            sx={{ flex: 1 }}
          />
          <IconButton size="small" aria-label="წყვილის წაშლა" onClick={() => removePair(index)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      ))}

      <Box>
        <Button size="small" startIcon={<AddIcon />} onClick={addPair}>
          წყვილის დამატება
        </Button>
      </Box>
    </Box>
  )
}
