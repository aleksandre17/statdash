// ── PivotEditor — type=pivot: {rows, keyField, valueFields, colors} [V2] ───────
//
//  A `pivot` DataSpec is the wide→long shorthand (sugar for transform + melt — it
//  desugars internally now, R3). Its FRIENDLY editor is kept (not routed through
//  the transform editor): the author works in pivot's own vocabulary — literal
//  `rows`, the `keyField` to pivot on, the `valueFields` that become series, and an
//  optional `colors` map. This is the right level of astonishment for an author who
//  picked "pivot" (POLA): they should not be confronted with the desugared melt
//  step. The desugaring stays an engine concern; the authored shape round-trips
//  losslessly as a `pivot` spec.
//
//    • rows        → JsonDataField (literal data — the documented escape hatch).
//    • keyField    → plain text (the column that becomes the key).
//    • valueFields → ChipInput (the value columns that become series).
//    • colors      → JsonDataField (an optional series→color map; omitted when {}).
//
import { Box, TextField, Typography } from '@mui/material'
import type { DataSpec, DimVal } from '@statdash/engine'
import { ChipInput } from './query/ChipInput'
import { JsonDataField } from './JsonDataField'

type PivotSpec = Extract<DataSpec, { type: 'pivot' }>
type PivotRows = Record<string, DimVal>[]

export interface PivotEditorProps {
  value:    PivotSpec
  onChange: (next: PivotSpec) => void
}

export function PivotEditor({ value, onChange }: PivotEditorProps) {
  const setRows        = (rows: PivotRows)        => onChange({ ...value, rows })
  const setKeyField    = (keyField: string)       => onChange({ ...value, keyField })
  const setValueFields = (valueFields: string[])  => onChange({ ...value, valueFields })

  // colors is optional: an empty map clears it from the emitted spec.
  const setColors = (colors: Record<string, string>) => {
    const next = { ...value }
    if (colors && Object.keys(colors).length > 0) next.colors = colors
    else delete next.colors
    onChange(next)
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <JsonDataField<PivotRows>
        label="სტრიქონები (rows): Record<string, DimVal>[]"
        hint="სტატიკური wide-ფორმატის მონაცემები"
        value={value.rows}
        onChange={setRows}
      />

      <TextField
        size="small" label="გასაღების სვეტი (keyField)" required
        value={value.keyField}
        onChange={(e) => setKeyField(e.target.value)}
      />

      <Box>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
          მნიშვნელობის სვეტები (valueFields)
        </Typography>
        <ChipInput
          value={value.valueFields}
          onChange={setValueFields}
          label="სვეტები → სერიები"
          placeholder="2022"
        />
      </Box>

      <JsonDataField<Record<string, string>>
        label="ფერები (colors — არჩევითი): Record<series, color>"
        value={value.colors ?? {}}
        onChange={setColors}
      />
    </Box>
  )
}
