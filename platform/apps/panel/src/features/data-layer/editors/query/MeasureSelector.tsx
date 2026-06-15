import { ChipInput } from './ChipInput'

// ── MeasureSelector — chip input for ObsQuery.measure codes ───────────────────
//
//  Each measure code (e.g. GDP_SVC) becomes a deletable chip. Free text only.
//

export interface MeasureSelectorProps {
  value:    string[]
  onChange: (codes: string[]) => void
}

export function MeasureSelector({ value, onChange }: MeasureSelectorProps) {
  return (
    <ChipInput
      value={value}
      onChange={onChange}
      label="მაჩვენებლები (Measures)"
      placeholder="GDP_SVC"
    />
  )
}
