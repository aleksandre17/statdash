import { Box, ToggleButton, ToggleButtonGroup } from '@mui/material'
import { ChipInput } from './query/ChipInput'

// ── YearsField — YearsSpec editor ('all' | number[]) ──────────────────────────
//
//  Shared by Timeseries and Growth. Toggle 'all' vs 'manual'; in manual mode a
//  chip input collects year numbers. Non-numeric chips are dropped on commit so
//  the output is always a clean readonly number[].
//

export type YearsValue = readonly number[] | 'all'

export interface YearsFieldProps {
  value:    YearsValue
  onChange: (next: YearsValue) => void
}

export function YearsField({ value, onChange }: YearsFieldProps) {
  const mode: 'all' | 'manual' = value === 'all' ? 'all' : 'manual'
  const years = value === 'all' ? [] : value

  const setMode = (next: 'all' | 'manual' | null) => {
    if (next === null) return
    onChange(next === 'all' ? 'all' : years)
  }

  const setYears = (chips: string[]) => {
    const nums = chips.map((c) => Number(c)).filter((n) => Number.isFinite(n))
    onChange(nums)
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <ToggleButtonGroup exclusive size="small" value={mode} onChange={(_e, v) => setMode(v)}>
        <ToggleButton value="all">all</ToggleButton>
        <ToggleButton value="manual">manual</ToggleButton>
      </ToggleButtonGroup>
      {mode === 'manual' && (
        <ChipInput
          label="წლები"
          placeholder="2023"
          value={years.map(String)}
          onChange={setYears}
        />
      )}
    </Box>
  )
}
